import bcrypt from 'bcryptjs';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import {
  ActionItem,
  Alumnus,
  AuthToken,
  AvailabilityWindow,
  CalendarConnection,
  CareerGoal,
  Feedback,
  Goal,
  MentorCapacity,
  Mentorship,
  MentorshipRequest,
  Message,
  Notification,
  Payment,
  PaymentMethod,
  Session,
  StudentProfile,
  User,
  VerificationRequest,
} from '../models/index.js';
import {
  actionItemView,
  availabilityView,
  capacityView,
  feedbackView,
  goalView,
  mentorSelf,
  mentorshipView,
  messageView,
  methodView,
  notificationView,
  paymentView,
  requestView,
  selfUser,
  sessionView,
  studentSelf,
  verificationView,
  type Viewer,
} from '../serializers/index.js';
import { audit } from './audit.js';
import { removeMethod } from './payments.js';
import { declineRequest, endMentorship } from './requests.js';
import { storage } from './storage.js';

/*
 * Data rights under India's DPDP Act 2023: a person can download what the platform holds about them,
 * and erase their account. Every export goes through the same allow-list serializers as the app, so
 * it never contains anyone else's contact details.
 */

const both = [
  { path: 'alumnus', populate: [{ path: 'user', select: 'name' }, { path: 'expertise' }] },
  { path: 'student', populate: [{ path: 'user', select: 'name' }, { path: 'interests' }] },
];
const paymentNames = (q: any) =>
  q.populate('session', 'title scheduledStart').populate('payer', 'name').populate({ path: 'alumnus', select: 'user', populate: { path: 'user', select: 'name' } });

/** Everything the platform holds about the signed-in person, as one JSON document. */
export async function exportMyData(viewer: Viewer) {
  const user = await User.findById(viewer.id).select('+email +phone').lean();
  if (!user) throw notFound('Account');
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), account: selfUser(user) };

  let mentorshipFilter: Record<string, unknown> | null = null;
  if (viewer.role === 'student') {
    const p = await StudentProfile.findOne({ user: viewer.id }).populate('interests').lean();
    if (p) {
      const goals = await CareerGoal.find({ student: p._id }).lean();
      out.profile = studentSelf(p, user, goals);
      out.requests = (await MentorshipRequest.find({ student: p._id }).populate(both).populate('goals').lean()).map((r) => requestView(r, viewer));
      mentorshipFilter = { student: p._id };
    }
  } else if (viewer.role === 'alumnus') {
    const a = await Alumnus.findOne({ user: viewer.id }).select('+linkedinUrl +meetLink').populate('expertise').lean();
    if (a) {
      out.profile = mentorSelf(a, user);
      out.capacity = capacityView(await MentorCapacity.findOne({ alumnus: a._id }).lean());
      out.availability = (await AvailabilityWindow.find({ alumnus: a._id }).lean()).map(availabilityView);
      out.verification = (await VerificationRequest.find({ alumnus: a._id }).lean()).map((v) => verificationView(v, viewer));
      out.requests = (await MentorshipRequest.find({ alumnus: a._id }).populate(both).populate('goals').lean()).map((r) => requestView(r, viewer));
      mentorshipFilter = { alumnus: a._id };
    }
  }

  if (mentorshipFilter) {
    const ms = await Mentorship.find(mentorshipFilter).populate(both).lean();
    const ids = ms.map((m) => m._id);
    const isMentor = viewer.role === 'alumnus';
    const sessionsQ = Session.find({ mentorship: { $in: ids } });
    if (isMentor) sessionsQ.select('+mentorPrivateNotes');
    const [sessions, goals, actions, messages, feedback] = await Promise.all([
      sessionsQ.lean(),
      Goal.find({ mentorship: { $in: ids } }).lean(),
      ActionItem.find({ mentorship: { $in: ids } }).lean(),
      Message.find({ mentorship: { $in: ids } }).sort({ createdAt: 1 }).lean(),
      Feedback.find({ mentorship: { $in: ids } }).lean(),
    ]);
    out.mentorships = ms.map((m) => ({
      ...mentorshipView(m, viewer),
      sessions: sessions.filter((s) => String(s.mentorship) === String(m._id)).map((s) => sessionView(s, viewer, { viewerIsMentor: isMentor })),
      goals: goals.filter((g) => String(g.mentorship) === String(m._id)).map(goalView),
      actionItems: actions.filter((x) => String(x.mentorship) === String(m._id)).map(actionItemView),
      messages: messages.filter((x) => String(x.mentorship) === String(m._id)).map(messageView),
      feedback: feedback.filter((x) => String(x.mentorship) === String(m._id)).map(feedbackView),
    }));
  }

  if (viewer.role === 'student') {
    out.payments = (await paymentNames(Payment.find({ payer: viewer.id, status: { $ne: 'created' } })).lean()).map((p: any) => paymentView(p, viewer));
    out.savedCards = (await PaymentMethod.find({ user: viewer.id }).lean()).map((m) => methodView(m));
  } else if (viewer.role === 'alumnus') {
    const a = await Alumnus.findOne({ user: viewer.id }).select('_id').lean();
    out.earnings = a ? (await paymentNames(Payment.find({ alumnus: a._id, status: { $in: ['paid', 'refunded'] } })).lean()).map((p: any) => paymentView(p, viewer)) : [];
  }
  out.notifications = (await Notification.find({ user: viewer.id }).sort({ createdAt: -1 }).lean()).map(notificationView);
  await audit(viewer, 'user.data_exported', 'User', viewer.id);
  return out;
}

/**
 * Erases the account. Personal data is removed; records other people or the law still need
 * (payments, messages in a shared mentorship, feedback, the audit log) stay, attributed to
 * "Deleted user". Mentorships end, which cancels upcoming sessions with full refunds.
 */
export async function deleteMyAccount(viewer: Viewer, input: { confirm: string; password?: string }) {
  if (viewer.role !== 'student' && viewer.role !== 'alumnus') throw forbidden('Staff accounts are removed by an administrator');
  if (input.confirm !== 'DELETE') throw badRequest('confirm_required', 'Type DELETE to confirm');
  const user = await User.findById(viewer.id).select('+passwordHash');
  if (!user) throw notFound('Account');
  if (user.passwordHash && !(input.password && (await bcrypt.compare(input.password, user.passwordHash)))) throw badRequest('wrong_password', 'That password is not right');

  // 1. Close everything in progress (ending a mentorship cancels its upcoming sessions and refunds them).
  const profile = viewer.role === 'student' ? await StudentProfile.findOne({ user: viewer.id }).lean() : await Alumnus.findOne({ user: viewer.id }).lean();
  if (profile) {
    const side = viewer.role === 'student' ? { student: profile._id } : { alumnus: profile._id };
    for (const m of await Mentorship.find({ ...side, status: 'active' }).select('_id').lean()) {
      await endMentorship(viewer, String(m._id), 'ended', 'Account deleted');
    }
    if (viewer.role === 'student') {
      await MentorshipRequest.updateMany({ student: profile._id, status: 'pending' }, { $set: { status: 'withdrawn', respondedAt: new Date() } });
    } else {
      for (const r of await MentorshipRequest.find({ alumnus: profile._id, status: 'pending' }).select('_id').lean()) {
        await declineRequest(viewer, String(r._id), 'other', 'This mentor has left the platform.').catch(() => undefined);
      }
    }
  }

  // 2. Saved cards (and their gateway tokens).
  for (const m of await PaymentMethod.find({ user: viewer.id }).select('_id').lean()) await removeMethod(viewer, String(m._id));

  // 3. Profile data.
  if (viewer.role === 'student' && profile) {
    await StudentProfile.updateOne({ _id: profile._id }, { $set: { interests: [], targetRoles: [], targetIndustries: [], mentoringAreasWanted: [] }, $unset: { rollNumber: 1, program: 1, bio: 1 } });
    await CareerGoal.deleteMany({ student: profile._id });
  }
  if (viewer.role === 'alumnus' && profile) {
    for (const v of await VerificationRequest.find({ alumnus: profile._id }).lean()) {
      for (const d of v.documents ?? []) if (d.storedName) await storage().remove(d.storedName).catch((e) => logger.warn('document removal failed', { e: String(e) }));
    }
    await VerificationRequest.deleteMany({ alumnus: profile._id });
    await Alumnus.updateOne(
      { _id: profile._id },
      {
        $set: { mentorOptIn: false, verificationStatus: 'unverified', expertise: [], mentoringAreas: [], languages: [], sessionFee: 0 },
        $unset: { headline: 1, currentRole: 1, currentCompany: 1, city: 1, bio: 1, linkedinUrl: 1, meetLink: 1, rollNumber: 1, institutionRecord: 1, verifiedAt: 1 },
      },
    );
    await MentorCapacity.updateOne({ alumnus: profile._id }, { $set: { paused: true, pauseReason: 'Account deleted' } });
    await AvailabilityWindow.deleteMany({ alumnus: profile._id });
  }

  // 4. Account-level data, then the account itself becomes an anonymous placeholder.
  await Promise.all([Notification.deleteMany({ user: viewer.id }), CalendarConnection.deleteMany({ user: viewer.id }), AuthToken.deleteMany({ user: viewer.id })]);
  await User.updateOne(
    { _id: viewer.id },
    {
      $set: { name: 'Deleted user', email: `deleted-${viewer.id}@deleted.invalid`, status: 'deleted', deletedAt: new Date(), mfaEnabled: false, 'notificationPrefs.email': false, 'notificationPrefs.sms': false },
      $unset: { phone: 1, passwordHash: 1, googleSub: 1, avatarUrl: 1, emailVerifiedAt: 1, mfaSecret: 1, mfaPendingSecret: 1, mfaLastStep: 1, mfaRecoveryCodes: 1, mfaFailures: 1, mfaLockedUntil: 1, razorpayCustomerId: 1, lastLoginAt: 1, lastActiveAt: 1 },
      $inc: { tokenVersion: 1 }, // signs out every session
    },
  );
  await audit(viewer, 'user.deleted', 'User', viewer.id);
}
