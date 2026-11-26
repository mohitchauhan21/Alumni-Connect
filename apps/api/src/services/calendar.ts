import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { CalendarConnection } from '../models/index.js';

/**
 * Calendar & video integration.
 *  - Google Calendar and Outlook (Microsoft Graph) via OAuth 2.0 authorization-code flow.
 *  - Video links: Google Meet (when the Google event is created with conferenceData) or Jitsi (keyless default).
 *  - ICS download works for everyone with no setup.
 *
 * PRIVACY: events are created in each participant's own calendar WITHOUT an attendee list,
 * because a shared invite would reveal the alumnus's email address to the student.
 */
export type Provider = 'google' | 'outlook';

export function providerConfigured(p: Provider): boolean {
  return p === 'google' ? !!(env.googleClientId && env.googleClientSecret) : !!(env.msClientId && env.msClientSecret);
}

const redirectUri = (p: Provider) => `${env.publicApiUrl}/api/calendar/${p}/callback`;

export function authUrl(p: Provider, userId: string): string {
  const state = jwt.sign({ sub: userId, p }, env.jwtSecret, { expiresIn: '10m' });
  if (p === 'google') {
    const q = new URLSearchParams({
      client_id: env.googleClientId,
      redirect_uri: redirectUri(p),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: 'https://www.googleapis.com/auth/calendar.events',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }
  const q = new URLSearchParams({
    client_id: env.msClientId,
    redirect_uri: redirectUri(p),
    response_type: 'code',
    response_mode: 'query',
    scope: 'offline_access Calendars.ReadWrite OnlineMeetings.ReadWrite',
    state,
  });
  return `https://login.microsoftonline.com/${env.msTenant}/oauth2/v2.0/authorize?${q}`;
}

function tokenEndpoint(p: Provider) {
  return p === 'google' ? 'https://oauth2.googleapis.com/token' : `https://login.microsoftonline.com/${env.msTenant}/oauth2/v2.0/token`;
}
function clientCreds(p: Provider) {
  return p === 'google' ? { client_id: env.googleClientId, client_secret: env.googleClientSecret } : { client_id: env.msClientId, client_secret: env.msClientSecret };
}

export async function handleCallback(p: Provider, code: string, state: string): Promise<string> {
  const payload = jwt.verify(state, env.jwtSecret) as { sub: string; p: Provider };
  if (payload.p !== p) throw new Error('Provider mismatch');
  const res = await fetch(tokenEndpoint(p), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...clientCreds(p), code, grant_type: 'authorization_code', redirect_uri: redirectUri(p) }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const tok = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number };
  const set: Record<string, unknown> = {
    accessToken: tok.access_token,
    expiresAt: new Date(Date.now() + tok.expires_in * 1000),
    accountLabel: p === 'google' ? 'Google Calendar' : 'Outlook Calendar',
  };
  if (tok.refresh_token) set.refreshToken = tok.refresh_token;
  await CalendarConnection.findOneAndUpdate({ user: payload.sub, provider: p }, { $set: set }, { upsert: true });
  return payload.sub;
}

async function accessToken(userId: string, p: Provider): Promise<string | null> {
  const c = await CalendarConnection.findOne({ user: userId, provider: p }).select('+accessToken +refreshToken');
  if (!c) return null;
  if (c.expiresAt && c.expiresAt.getTime() > Date.now() + 60_000) return c.accessToken ?? null;
  if (!c.refreshToken) return null;
  const res = await fetch(tokenEndpoint(p), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...clientCreds(p), refresh_token: c.refreshToken, grant_type: 'refresh_token' }),
  });
  if (!res.ok) {
    logger.warn('Calendar token refresh failed', { provider: p, status: res.status });
    return null;
  }
  const tok = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  c.accessToken = tok.access_token;
  c.expiresAt = new Date(Date.now() + tok.expires_in * 1000);
  if (tok.refresh_token) c.refreshToken = tok.refresh_token;
  await c.save();
  return tok.access_token;
}

export function jitsiLink(): string {
  return `${env.jitsiBaseUrl}/AMN-${crypto.randomBytes(9).toString('base64url')}`;
}

export interface EventInput {
  title: string;
  description: string;
  start: Date;
  end: Date;
  videoLink?: string | null;
  wantMeet?: boolean;
}

/** Creates an event in one user's connected calendar. Returns event id and (Google) Meet link, or null. */
export async function createExternalEvent(userId: string, p: Provider, ev: EventInput): Promise<{ eventId: string; meetLink?: string } | null> {
  if (!providerConfigured(p)) return null;
  const token = await accessToken(userId, p);
  if (!token) return null;
  try {
    if (p === 'google') {
      const body: Record<string, unknown> = {
        summary: ev.title,
        description: `${ev.description}${ev.videoLink ? `\n\nJoin: ${ev.videoLink}` : ''}`,
        start: { dateTime: ev.start.toISOString() },
        end: { dateTime: ev.end.toISOString() },
        reminders: { useDefault: true },
      };
      if (ev.wantMeet) body.conferenceData = { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } };
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=none', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Google ${res.status}`);
      const data = (await res.json()) as { id: string; hangoutLink?: string };
      return { eventId: data.id, meetLink: data.hangoutLink };
    }
    const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: ev.title,
        body: { contentType: 'text', content: `${ev.description}${ev.videoLink ? `\n\nJoin: ${ev.videoLink}` : ''}` },
        start: { dateTime: ev.start.toISOString().replace('Z', ''), timeZone: 'UTC' },
        end: { dateTime: ev.end.toISOString().replace('Z', ''), timeZone: 'UTC' },
        isReminderOn: true,
      }),
    });
    if (!res.ok) throw new Error(`Graph ${res.status}`);
    const data = (await res.json()) as { id: string };
    return { eventId: data.id };
  } catch (e) {
    logger.warn('Calendar event creation failed', { provider: p, e: String(e) });
    return null;
  }
}

export async function deleteExternalEvent(userId: string, p: Provider, eventId: string) {
  if (!providerConfigured(p)) return;
  const token = await accessToken(userId, p);
  if (!token) return;
  const url = p === 'google' ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=none` : `https://graph.microsoft.com/v1.0/me/events/${eventId}`;
  await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** RFC 5545 calendar file, importable into any calendar app. No attendee/organizer emails are included. */
export function buildIcs(uid: string, ev: EventInput): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mentor Bridge//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@alumni-mentor-network`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(ev.start)}`,
    `DTEND:${icsDate(ev.end)}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    `DESCRIPTION:${icsEscape(`${ev.description}${ev.videoLink ? `\n\nJoin: ${ev.videoLink}` : ''}`)}`,
    ev.videoLink ? `URL:${ev.videoLink}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Mentoring session in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}
