import { env } from '../config/env.js';
import { HOUR_MS, type Clock, systemClock } from '../lib/clock.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { Alumnus, CalendarConnection, Mentorship, Payment, Session } from '../models/index.js';
import type { Viewer } from '../serializers/index.js';
import { mentorshipAccess, touchMentorship, type MentorshipAccess } from './access.js';
import { audit } from './audit.js';
import { failOpenPayments, refundOnCancel, refundPayment, rupees, sessionFeeFor } from './payments.js';
import { createExternalEvent, deleteExternalEvent, jitsiLink, type Provider } from './calendar.js';
import { notify } from './notify.js';

type Slot = { start: Date; end: Date };

/** How long a picked slot is held for a paid session while the student pays. */
export const PAYMENT_HOLD_MS = 30 * 60_000;

function validateSlots(slots: Slot[], now: Date) {
  if (!slots.length || slots.length > 5) throw badRequest('invalid_slots', 'Propose between 1 and 5 time slots');
  for (const s of slots) {
    if (!(s.start instanceof Date) || isNaN(s.start.getTime()) || isNaN(s.end.getTime())) throw badRequest('invalid_slots', 'Invalid slot time');
    if (s.start <= now) throw badRequest('invalid_slots', 'Slots must be in the future');
    const mins = (s.end.getTime() - s.start.getTime()) / 60000;
    if (mins < 15 || mins > 180) throw badRequest('invalid_slots', 'Sessions must be between 15 minutes and 3 hours');
  }
}

/** Sessions that already hold the mentor's time (booked or held for payment) and overlap this slot. */
async function mentorBookingsOverlapping(alumnusId: unknown, slot: Slot, excludeSessionId: unknown) {
  const ms = await Mentorship.find({ alumnus: alumnusId }).select('_id').lean();
  return Session.find({
    mentorship: { $in: ms.map((m) => m._id) },
    status: { $in: ['scheduled', 'awaiting_payment'] },
    _id: { $ne: excludeSessionId },
    scheduledStart: { $lt: slot.end },
    scheduledEnd: { $gt: slot.start },
  })
    .select('_id bookedAt')
    .lean();
}

const SLOT_CLASH = 'The mentor already has a session booked at that time';

export async function proposeSession(viewer: Viewer, mentorshipId: string, input: { slots: Slot[]; title?: string; agenda?: string }, clock: Clock = systemClock) {
  const acc = await mentorshipAccess(viewer, mentorshipId, { write: true });
  if (acc.mentorship.status !== 'active') throw conflict('not_active', 'This mentorship is not active');
  validateSlots(input.slots, clock());
  const s = await Session.create({
    mentorship: acc.mentorship._id,
    proposedBy: viewer.id,
    proposedSlots: input.slots,
    title: input.title || 'Mentoring session',
    agenda: input.agenda,
    status: 'proposed',
  });
  await touchMentorship(acc.mentorship._id, clock());
  await notify(acc.counterpartUserId, 'session_proposed', {
    title: 'New session times proposed',
    body: `${input.slots.length} time option${input.slots.length > 1 ? 's' : ''} — pick the one that works for you.`,
    link: `/mentorships/${mentorshipId}?tab=sessions`,
  });
  return s;
}

export async function bookSession(viewer: Viewer, mentorshipId: string, sessionId: string, slotIndex: number, clock: Clock = systemClock) {
  const acc = await mentorshipAccess(viewer, mentorshipId, { write: true });
  if (acc.mentorship.status !== 'active') throw conflict('not_active', 'This mentorship has ended, so its sessions can no longer be booked');
  const found = await Session.findOne({ _id: sessionId, mentorship: acc.mentorship._id }).lean();
  if (!found) throw notFound('Session');
  if (found.status !== 'proposed') throw conflict('not_proposed', 'This session is not awaiting a booking');
  if (String(found.proposedBy) === viewer.id) throw forbidden('The other participant picks a slot from your proposal');
  const slot = found.proposedSlots[slotIndex];
  if (!slot?.start || !slot.end) throw badRequest('invalid_slot', 'Choose one of the proposed slots');
  const now = clock();
  if (slot.start <= now) throw badRequest('slot_past', 'That slot is already in the past — ask for new times');
  const want = { start: slot.start, end: slot.end };
  if ((await mentorBookingsOverlapping(acc.mentorship.alumnus, want, found._id)).length) throw conflict('slot_clash', SLOT_CLASH);

  // Paid mentor: hold the slot until the student pays (at most 30 minutes, never past the start).
  const fee = await sessionFeeFor(acc.mentorship.alumnus);
  const paymentDueAt = fee > 0 ? new Date(Math.max(now.getTime() + 2 * 60_000, Math.min(now.getTime() + PAYMENT_HOLD_MS, slot.start.getTime() - 5 * 60_000))) : undefined;

  // Claim the proposal atomically: of several clicks or devices booking it at once, exactly one wins.
  const s = await Session.findOneAndUpdate(
    { _id: found._id, status: 'proposed' },
    // bookedAt comes from the database clock at the moment of the claim, so it orders the claims themselves.
    { $set: { status: fee > 0 ? 'awaiting_payment' : 'scheduled', scheduledStart: slot.start, scheduledEnd: slot.end, ...(fee > 0 ? { fee, paymentDueAt } : {}) }, $currentDate: { bookedAt: true } },
    { new: true },
  );
  if (!s) throw conflict('not_proposed', 'This session was just booked');

  // Two overlapping sessions with the same mentor booked at the same moment both pass the check
  // above; now that ours holds the time, re-check, and the earlier booking keeps it.
  const rivals = await mentorBookingsOverlapping(acc.mentorship.alumnus, want, s._id);
  const mine = s.bookedAt!.getTime();
  const earlier = (r: { _id: unknown; bookedAt?: Date | null }) => !r.bookedAt || r.bookedAt.getTime() < mine || (r.bookedAt.getTime() === mine && String(r._id) < String(s._id));
  if (rivals.some(earlier)) {
    await Session.updateOne({ _id: s._id, status: s.status }, { $set: { status: 'proposed' }, $unset: { scheduledStart: 1, scheduledEnd: 1, bookedAt: 1, fee: 1, paymentDueAt: 1 } });
    throw conflict('slot_clash', SLOT_CLASH);
  }

  if (fee > 0) {
    await touchMentorship(acc.mentorship._id, clock());
    await audit(viewer, 'session.held_for_payment', 'Session', s._id, { fee });
    if (viewer.id !== acc.studentUserId) {
      await notify(acc.studentUserId, 'payment_due', {
        title: 'Pay to confirm your session',
        body: `${s.title} — ${rupees(fee)}. The slot is held for you until ${paymentDueAt!.toUTCString()}.`,
        link: `/mentorships/${mentorshipId}?tab=sessions`,
      });
    }
    return s;
  }
  return confirmSession(viewer, acc, s, clock);
}

/** Turns a booked slot into a confirmed session: video link, calendar events, notifications. */
export async function confirmSession(viewer: Viewer, acc: MentorshipAccess, s: InstanceType<typeof Session>, clock: Clock = systemClock) {
  const slot = { start: s.scheduledStart!, end: s.scheduledEnd! };
  s.status = 'scheduled';
  s.paymentDueAt = undefined;
  s.videoLink = jitsiLink();

  // Calendar sync for each participant who connected a calendar (own calendar, no attendee list).
  const ev = { title: s.title ?? 'Mentoring session', description: s.agenda ?? 'Alumni mentoring session', start: slot.start, end: slot.end, videoLink: s.videoLink, wantMeet: env.videoProvider === 'google_meet' };
  const conns = await CalendarConnection.find({ user: { $in: [acc.mentorUserId, acc.studentUserId] } }).lean();
  const external: any[] = [];
  for (const c of conns) {
    const r = await createExternalEvent(String(c.user), c.provider as Provider, ev);
    if (r) {
      external.push({ provider: c.provider, userId: c.user, eventId: r.eventId });
      if (r.meetLink && env.videoProvider === 'google_meet') s.videoLink = r.meetLink;
    }
  }
  s.externalEvents = external as any;
  // The mentor's own Google Meet room, when they've set one, wins over a generated link.
  const mentor = await Alumnus.findById(acc.mentorship.alumnus).select('+meetLink').lean();
  if (mentor?.meetLink) s.videoLink = mentor.meetLink;
  await s.save();
  await touchMentorship(acc.mentorship._id, clock());
  await audit(viewer, 'session.scheduled', 'Session', s._id);

  const when = slot.start.toUTCString();
  for (const uid of [acc.mentorUserId, acc.studentUserId]) {
    await notify(uid, 'session_scheduled', {
      title: 'Mentoring session confirmed',
      body: `${s.title} — ${when}. Video link and calendar file are on the session page.`,
      link: `/mentorships/${String(acc.mentorship._id)}?tab=sessions`,
    });
  }
  return s;
}

export async function cancelSession(viewer: Viewer, mentorshipId: string, sessionId: string, reason?: string, clock: Clock = systemClock) {
  const acc = await mentorshipAccess(viewer, mentorshipId, { write: true });
  const s = await Session.findOne({ _id: sessionId, mentorship: acc.mentorship._id });
  if (!s) throw notFound('Session');
  if (!['proposed', 'awaiting_payment', 'scheduled'].includes(s.status)) throw conflict('not_cancellable', 'Only upcoming sessions can be cancelled');
  if (s.status === 'scheduled' && s.scheduledStart && s.scheduledStart <= clock()) {
    throw conflict('already_started', "This session has already started, so it can't be cancelled. Log it instead, as completed or as didn't happen.");
  }
  const wasHeld = s.status === 'awaiting_payment';
  s.status = 'cancelled';
  s.paymentDueAt = undefined;
  s.cancelledBy = viewer.id as any;
  s.cancelReason = reason;
  for (const e of s.externalEvents ?? []) await deleteExternalEvent(String(e.userId), e.provider as Provider, String(e.eventId));
  await s.save();
  if (wasHeld) await failOpenPayments(s._id, 'The session was cancelled before it was paid for');
  // Paid sessions: mentor or staff cancellations are always refunded; a student's only up to the cutoff.
  const refund = await refundOnCancel(s, acc.role === 'student' ? 'student' : 'mentor', clock());
  await notify(acc.counterpartUserId, 'session_cancelled', { title: 'A session was cancelled', body: reason ?? undefined, link: `/mentorships/${mentorshipId}?tab=sessions` });
  return { session: s, refund };
}

/** Cancels a booked session (its calendar events go too) and tells both people why. */
export async function cancelBookedSession(s: InstanceType<typeof Session>, actorId: string | null, reason: string) {
  s.status = 'cancelled';
  s.cancelledBy = (actorId ?? undefined) as any;
  s.cancelReason = reason;
  for (const e of s.externalEvents ?? []) await deleteExternalEvent(String(e.userId), e.provider as Provider, String(e.eventId));
  await s.save();
  const m = await Mentorship.findById(s.mentorship).populate('student', 'user').populate('alumnus', 'user').lean();
  for (const uid of [(m?.student as any)?.user, (m?.alumnus as any)?.user].filter(Boolean)) {
    if (String(uid) === actorId) continue;
    await notify(uid, 'session_cancelled', { title: `Session cancelled: ${s.title}`, body: reason, link: `/mentorships/${s.mentorship}?tab=sessions` });
  }
}

/**
 * When a mentorship closes, nothing in it can go ahead: proposals nobody picked and unpaid holds
 * are cancelled, and so are booked sessions that haven't started, with a full refund if paid.
 * Booked sessions whose time has passed stay as they are, so they can still be logged.
 */
export async function closeUpcomingSessions(mentorshipId: unknown, actorId: string, reason: string, clock: Clock = systemClock) {
  const now = clock();
  const open = await Session.find({ mentorship: mentorshipId, status: { $in: ['proposed', 'awaiting_payment'] } }).select('_id').lean();
  for (const o of open) {
    const closed = await Session.updateOne(
      { _id: o._id, status: { $in: ['proposed', 'awaiting_payment'] } },
      { $set: { status: 'cancelled', cancelledBy: actorId, cancelReason: reason }, $unset: { paymentDueAt: 1 } },
    );
    if (closed.modifiedCount) await failOpenPayments(o._id, `${reason} before the session was paid for`);
  }
  const booked = await Session.find({ mentorship: mentorshipId, status: 'scheduled', scheduledStart: { $gt: now } });
  for (const s of booked) {
    await cancelBookedSession(s, actorId, reason);
    const p = s.payment ? await Payment.findById(s.payment) : null;
    if (p?.status === 'paid') await refundPayment(p, reason, now);
  }
  return { open: open.length, booked: booked.length };
}

export async function completeSession(
  viewer: Viewer,
  mentorshipId: string,
  sessionId: string,
  input: { outcome: 'completed' | 'no_show'; summary?: string; mentorPrivateNotes?: string },
  clock: Clock = systemClock,
) {
  const acc = await mentorshipAccess(viewer, mentorshipId, { write: true });
  const s = await Session.findOne({ _id: sessionId, mentorship: acc.mentorship._id }).select('+mentorPrivateNotes');
  if (!s) throw notFound('Session');
  if (s.status !== 'scheduled') throw conflict('not_scheduled', 'Only scheduled sessions can be logged');
  if (s.scheduledStart && s.scheduledStart.getTime() > clock().getTime() + HOUR_MS / 4) throw badRequest('too_early', 'You can log a session once it has started');
  s.status = input.outcome;
  s.summary = input.summary;
  if (acc.isMentor && input.mentorPrivateNotes !== undefined) s.mentorPrivateNotes = input.mentorPrivateNotes;
  s.completedAt = clock();
  await s.save();
  await touchMentorship(acc.mentorship._id, clock());
  await audit(viewer, `session.${input.outcome}`, 'Session', s._id);
  if (input.outcome === 'completed') {
    for (const uid of [acc.mentorUserId, acc.studentUserId]) {
      await notify(uid, 'feedback_request', {
        title: 'How did the session go?',
        body: 'Rate the session in under a minute — it helps both of you and the programme.',
        link: `/mentorships/${mentorshipId}?tab=feedback&session=${s._id}`,
      }, { email: false });
    }
  }
  return s;
}

/** Reminder job (every 5 minutes): 24h and 1h reminders for scheduled sessions. */
export async function sendSessionReminders(clock: Clock = systemClock): Promise<number> {
  const now = clock();
  let sent = 0;
  const windows: { field: 'reminder24hSentAt' | 'reminder1hSentAt'; ahead: number; label: string }[] = [
    { field: 'reminder24hSentAt', ahead: 24 * HOUR_MS, label: 'tomorrow' },
    { field: 'reminder1hSentAt', ahead: HOUR_MS, label: 'in about an hour' },
  ];
  for (const w of windows) {
    const due = await Session.find({ status: 'scheduled', scheduledStart: { $gt: now, $lte: new Date(now.getTime() + w.ahead) }, [w.field]: { $exists: false } }).lean();
    for (const s of due) {
      const claimed = await Session.findOneAndUpdate({ _id: s._id, [w.field]: { $exists: false } }, { $set: { [w.field]: now } });
      if (!claimed) continue;
      const m = await Mentorship.findById(s.mentorship).populate('student', 'user').populate('alumnus', 'user').lean();
      if (!m) continue;
      for (const uid of [(m.student as any)?.user, (m.alumnus as any)?.user]) {
        await notify(uid, 'session_reminder', {
          title: `Reminder: mentoring session ${w.label}`,
          body: `${s.title} at ${s.scheduledStart!.toUTCString()}`,
          link: `/mentorships/${m._id}?tab=sessions`,
        });
      }
      sent++;
    }
  }
  return sent;
}
