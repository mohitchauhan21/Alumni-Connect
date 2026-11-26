import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Alumnus, StudentProfile, User, type Role } from '../models/index.js';
import { sendSecurityNotice } from './account.js';
import { audit } from './audit.js';

/**
 * "Sign in with Google" — OAuth 2.0 authorization-code flow with OpenID Connect.
 *  - Only Google-verified email addresses are accepted.
 *  - A returning Google user is recognised by their Google subject id; an existing account with the
 *    same email is linked on first Google sign-in.
 *  - New users choose Student or Alumnus before leaving for Google (carried in the signed `state`).
 *  - The Google email stays private like every other email on the platform.
 */
export const googleConfigured = () => !!(env.googleClientId && env.googleClientSecret);
export const googleRedirectUri = () => `${env.publicApiUrl}/api/auth/google/callback`;

type State = { p: 'login'; role: 'student' | 'alumnus'; next: string; nonce: string };

export function safeNext(next: unknown): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\') ? next.slice(0, 300) : '';
}

export function googleAuthUrl(role: 'student' | 'alumnus', next: string): { url: string; nonce: string } {
  const nonce = crypto.randomBytes(16).toString('base64url');
  const state = jwt.sign({ p: 'login', role, next: safeNext(next), nonce } satisfies State, env.jwtSecret, { expiresIn: '10m' });
  const q = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
    state,
    nonce,
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${q}`, nonce };
}

export class GoogleAuthError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  hd?: string;
}

/** Exchanges the code and validates the ID token (audience, issuer, expiry, nonce, verified email). */
export async function exchangeGoogleCode(code: string, state: string, nonceCookie: string | undefined): Promise<{ profile: GoogleProfile; state: State }> {
  let st: State;
  try {
    st = jwt.verify(state, env.jwtSecret) as State;
  } catch {
    throw new GoogleAuthError('invalid_state');
  }
  if (st.p !== 'login') throw new GoogleAuthError('invalid_state');
  if (!nonceCookie || nonceCookie !== st.nonce) throw new GoogleAuthError('invalid_state');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: env.googleClientId, client_secret: env.googleClientSecret, redirect_uri: googleRedirectUri(), grant_type: 'authorization_code' }),
  });
  if (!tokenRes.ok) throw new GoogleAuthError('token_exchange_failed');
  const { id_token } = (await tokenRes.json()) as { id_token?: string };
  if (!id_token) throw new GoogleAuthError('token_exchange_failed');

  // Google's tokeninfo endpoint verifies the token signature server-side.
  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`);
  if (!infoRes.ok) throw new GoogleAuthError('invalid_token');
  const info = (await infoRes.json()) as Record<string, string>;
  if (info.aud !== env.googleClientId) throw new GoogleAuthError('invalid_token');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(info.iss)) throw new GoogleAuthError('invalid_token');
  if (Number(info.exp) * 1000 < Date.now()) throw new GoogleAuthError('invalid_token');
  if (info.nonce !== st.nonce) throw new GoogleAuthError('invalid_token');
  if (info.email_verified !== 'true' || !info.email) throw new GoogleAuthError('email_not_verified');

  return { profile: { sub: info.sub, email: info.email.toLowerCase(), name: info.name || info.email.split('@')[0], picture: info.picture, hd: info.hd }, state: st };
}

/** Finds, links or creates the platform account for a verified Google profile. */
export async function upsertGoogleUser(profile: GoogleProfile, role: 'student' | 'alumnus') {
  let user = await User.findOne({ googleSub: profile.sub }).select('+email +phone +googleSub');
  let created = false;
  let squatterRemoved = false;
  if (!user) {
    user = await User.findOne({ email: profile.email }).select('+email +phone +googleSub +passwordHash');
    if (user) {
      user.googleSub = profile.sub; // link an existing email/password account
      if (!user.avatarUrl && profile.picture) user.avatarUrl = profile.picture;
      if (!user.emailVerifiedAt) {
        // The address was registered but never confirmed, so it may have been registered by someone
        // else. Google now proves who owns it: remove that unproven password and any two-factor set up
        // with it, and end every session issued before now. The owner can add a password in Settings.
        squatterRemoved = !!user.passwordHash || !!user.mfaEnabled;
        await User.updateOne({ _id: user._id }, { $unset: { mfaSecret: 1, mfaPendingSecret: 1, mfaLastStep: 1, mfaRecoveryCodes: 1, mfaFailures: 1, mfaLockedUntil: 1 } });
        user.passwordHash = undefined;
        user.mfaEnabled = false;
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      }
    }
  }
  if (!user) {
    if (role === 'student' && env.googleStudentDomains.length && !env.googleStudentDomains.includes(profile.email.split('@')[1])) {
      throw new GoogleAuthError('student_domain_required');
    }
    user = await User.create({ name: profile.name, email: profile.email, role, googleSub: profile.sub, avatarUrl: profile.picture });
    if (role === 'student') await StudentProfile.create({ user: user._id });
    else await Alumnus.create({ user: user._id, verificationStatus: 'unverified' });
    created = true;
  }
  if (user.status !== 'active') throw new GoogleAuthError('suspended');
  // Google has verified this address (email_verified is checked above), so it counts as confirmed.
  if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
  user.lastLoginAt = new Date();
  await user.save();
  await audit({ id: String(user._id), role: user.role as Role }, created ? 'user.registered_google' : 'user.login_google', 'User', user._id);
  if (squatterRemoved) {
    await audit({ id: String(user._id), role: user.role as Role }, 'user.unconfirmed_password_removed', 'User', user._id);
    await sendSecurityNotice(
      user.email,
      'Your account is now linked to Google',
      'You signed in with Google using an address that had an account but had never been confirmed. To keep it safe, we removed the earlier password and signed out any other sessions. You can add a new password in Settings → Security.',
    );
  }
  return { user, created };
}
