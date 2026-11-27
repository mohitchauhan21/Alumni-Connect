import { Router } from 'express';
import { z } from 'zod';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { maskContactDetails } from '../lib/mask.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ah, oid, parse } from '../middleware/common.js';
import { ActionItem, CareerGoal, Feedback, Goal, Mentorship, Session } from '../models/index.js';
import { actionItemView, careerGoal, feedbackView, goalView, mentorshipView, sessionView } from '../serializers/index.js';
import { mentorshipAccess, touchMentorship } from '../services/access.js';
import { audit } from '../services/audit.js';
import { buildIcs } from '../services/calendar.js';
import { sendNudge } from '../services/engagement.js';
import { alumnusFor, endMentorship, studentProfileFor } from '../services/requests.js';
import { bookSession, cancelSession, completeSession, proposeSession } from '../services/sessions.js';

const r = Router();
r.use(requireAuth);

const populateBoth = [
  { path: 'alumnus', populate: [{ path: 'user', select: 'name' }, { path: 'expertise' }] },
  { path: 'student', populate: [{ path: 'user', select: 'name' }, { path: 'interests' }] },
];

r.get(
  '/',
  ah(async (req, res) => {
    const v = req.viewer!;
    let filter: Record<string, unknown> = {};
    if (v.role === 'student') filter = { student: (await studentProfileFor(v))._id };
    else if (v.role === 'alumnus') filter = { alumnus: (await alumnusFor(v))._id };
    else if (v.role !== 'aro' && v.role !== 'admin') throw forbidden();
    if (typeof req.query.status === 'string' && req.query.status !== 'all') filter.status = req.query.status;
    if (typeof req.query.health === 'string') filter.health = req.query.health;
    const list = await Mentorship.find(filter).sort({ status: 1, lastActivityAt: -1 }).limit(300).populate(populateBoth).lean();
    const ids = list.map((m) => m._id);
    const upcoming = await Session.aggregate([
      { $match: { mentorship: { $in: ids }, status: 'scheduled', scheduledStart: { $gt: new Date() } } },
      { $sort: { scheduledStart: 1 } },
      { $group: { _id: '$mentorship', next: { $first: '$scheduledStart' } } },
    ]);
    const nextBy = new Map(upcoming.map((u: any) => [String(u._id), u.next]));
    // The next meeting to join, for the countdown card. Includes one already in progress (it hasn't
    // ended yet), and only goes to the two people in the mentorship: staff never get meeting links.
    const participant = v.role === 'student' || v.role === 'alumnus';
    const meetings = participant
      ? await Session.aggregate([
          { $match: { mentorship: { $in: ids }, status: 'scheduled', scheduledEnd: { $gt: new Date() } } },
          { $sort: { scheduledStart: 1 } },
          { $group: { _id: '$mentorship', s: { $first: '$$ROOT' } } },
        ])
      : [];
    const meetingBy = new Map(
      meetings.map((x: any) => [
        String(x._id),
        { id: String(x.s._id), title: x.s.title ?? null, scheduledStart: x.s.scheduledStart?.toISOString() ?? null, scheduledEnd: x.s.scheduledEnd?.toISOString() ?? null, videoLink: x.s.videoLink ?? null },
      ]),
    );
    res.json({
      mentorships: list.map((m) => ({
        ...mentorshipView(m, v)!,
        nextSessionAt: nextBy.get(String(m._id))?.toISOString() ?? null,
        ...(participant ? { nextMeeting: meetingBy.get(String(m._id)) ?? null } : {}),
      })),
    });
  }),
);

r.get(
  '/:id',
  ah(async (req, res) => {
    const acc = await mentorshipAccess(req.viewer!, String(oid(req.params.id, 'Mentorship')));
    const m = await Mentorship.findById(acc.mentorship._id).populate(populateBoth).lean();
    const studentGoals = await CareerGoal.find({ student: acc.mentorship.student }).lean();
    const [sessions, goals, openActions] = await Promise.all([
      Session.countDocuments({ mentorship: m!._id, status: 'completed' }),
      Goal.countDocuments({ mentorship: m!._id }),
      ActionItem.countDocuments({ mentorship: m!._id, status: 'open' }),
    ]);
    res.json({
      mentorship: { ...mentorshipView(m, req.viewer!)!, viewerRole: acc.role },
      careerGoals: studentGoals.map(careerGoal),
      stats: { sessionsCompleted: sessions, goals, openActions },
    });
  }),
);

r.post(
  '/:id/end',
  ah(async (req, res) => {
    const b = parse(z.object({ outcome: z.enum(['completed', 'ended']), reason: z.string().trim().max(500).optional() }), req.body);
    await mentorshipAccess(req.viewer!, String(oid(req.params.id)), { write: true });
    const m = await endMentorship(req.viewer!, req.params.id, b.outcome, b.reason);
    res.json({ mentorship: mentorshipView(m, req.viewer!) });
  }),
);

r.post(
  '/:id/nudge',
  requireRole('aro', 'admin'),
  ah(async (req, res) => {
    const m = await Mentorship.findById(oid(req.params.id)).lean();
    if (!m || m.status !== 'active') throw notFound('Active mentorship');
    const days = Math.floor((Date.now() - new Date(m.lastActivityAt ?? m.startedAt!).getTime()) / 864e5);
    await sendNudge(m, (m.health as any) === 'healthy' ? 'at_risk' : (m.health as any), days);
    await Mentorship.updateOne({ _id: m._id }, { $set: { lastNudgedAt: new Date() } });
    await audit(req.viewer!, 'mentorship.nudged', 'Mentorship', m._id);
    res.json({ ok: true });
  }),
);

/* -------------------------------------------------------------- sessions */
const slotSchema = z.object({ start: z.coerce.date(), end: z.coerce.date() });

r.get(
  '/:id/sessions',
  ah(async (req, res) => {
    const acc = await mentorshipAccess(req.viewer!, String(oid(req.params.id)));
    const q = Session.find({ mentorship: acc.mentorship._id }).sort({ scheduledStart: -1, createdAt: -1 });
    if (acc.isMentor) q.select('+mentorPrivateNotes');
    const list = await q.lean();
    res.json({ sessions: list.map((s) => sessionView(s, req.viewer!, { viewerIsMentor: acc.isMentor })) });
  }),
);

r.post(
  '/:id/sessions',
  ah(async (req, res) => {
    const b = parse(z.object({ slots: z.array(slotSchema).min(1).max(5), title: z.string().trim().max(120).optional(), agenda: z.string().trim().max(2000).optional() }), req.body);
    const s = await proposeSession(req.viewer!, String(oid(req.params.id)), { ...b, agenda: b.agenda ? maskContactDetails(b.agenda).text : undefined });
    res.status(201).json({ session: sessionView(s.toObject(), req.viewer!) });
  }),
);

r.post(
  '/:id/sessions/:sid/book',
  ah(async (req, res) => {
    const b = parse(z.object({ slotIndex: z.number().int().min(0).max(4) }), req.body);
    const s = await bookSession(req.viewer!, String(oid(req.params.id)), String(oid(req.params.sid, 'Session')), b.slotIndex);
    res.json({ session: sessionView(s.toObject(), req.viewer!) });
  }),
);

r.post(
  '/:id/sessions/:sid/cancel',
  ah(async (req, res) => {
    const b = parse(z.object({ reason: z.string().trim().max(300).optional() }), req.body ?? {});
    const { session: s, refund } = await cancelSession(req.viewer!, String(oid(req.params.id)), String(oid(req.params.sid, 'Session')), b.reason);
    res.json({ session: sessionView(s.toObject(), req.viewer!), refund });
  }),
);

r.post(
  '/:id/sessions/:sid/complete',
  ah(async (req, res) => {
    const b = parse(
      z.object({ outcome: z.enum(['completed', 'no_show']).default('completed'), summary: z.string().trim().max(4000).optional(), mentorPrivateNotes: z.string().trim().max(4000).optional() }),
      req.body,
    );
    const s = await completeSession(req.viewer!, String(oid(req.params.id)), String(oid(req.params.sid, 'Session')), { ...b, summary: b.summary ? maskContactDetails(b.summary).text : undefined });
    res.json({ session: sessionView(s.toObject(), req.viewer!, { viewerIsMentor: req.viewer!.role === 'alumnus' }) });
  }),
);

r.get(
  '/:id/sessions/:sid/ics',
  ah(async (req, res) => {
    const acc = await mentorshipAccess(req.viewer!, String(oid(req.params.id)));
    const s = await Session.findOne({ _id: oid(req.params.sid, 'Session'), mentorship: acc.mentorship._id }).lean();
    if (!s || !s.scheduledStart || !s.scheduledEnd) throw notFound('Scheduled session');
    const ics = buildIcs(String(s._id), { title: s.title ?? 'Mentoring session', description: s.agenda ?? 'Alumni mentoring session', start: s.scheduledStart, end: s.scheduledEnd, videoLink: s.videoLink });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="mentoring-session-${s.scheduledStart.toISOString().slice(0, 10)}.ics"`);
    res.send(ics);
  }),
);

/* ---------------------------------------------------------------- goals */
r.get(
  '/:id/goals',
  ah(async (req, res) => {
    const acc = await mentorshipAccess(req.viewer!, String(oid(req.params.id)));
    const [goals, actions] = await Promise.all([
      Goal.find({ mentorship: acc.mentorship._id }).sort({ status: 1, createdAt: 1 }).lean(),
      ActionItem.find({ mentorship: acc.mentorship._id }).sort({ status: 1, dueDate: 1 }).lean(),
    ]);
    res.json({ goals: goals.map(goalView), actionItems: actions.map(actionItemView) });
  }),
);

r.post(
  '/:id/goals',
  ah(async (req, res) => {
    const b = parse(z.object({ title: z.string().trim().min(3).max(200), description: z.string().trim().max(2000).optional(), targetDate: z.coerce.date().optional(), careerGoalId: z.string().optional() }), req.body);
    const acc = await mentorshipAccess(req.viewer!, String(oid(req.params.id)), { write: true });
    if (acc.mentorship.status !== 'active') throw conflict('not_active', 'This mentorship is not active');
    if (b.careerGoalId && !(await CareerGoal.exists({ _id: oid(b.careerGoalId, 'Career goal'), student: acc.mentorship.student }))) throw badRequest('invalid_career_goal', "That career goal isn't one of this student's");
    const g = await Goal.create({ mentorship: acc.mentorship._id, title: b.title, description: b.description, targetDate: b.targetDate, careerGoal: b.careerGoalId ? oid(b.careerGoalId) : undefined, createdBy: req.viewer!.id });
    await touchMentorship(acc.mentorship._id);
    res.status(201).json({ goal: goalView(g.toObject()) });
  }),
);

r.patch(
  '/:id/goals/:gid',
  ah(async (req, res) => {
    const b = parse(z.object({ title: z.string().trim().min(3).max(200).optional(), description: z.string().trim().max(2000).optional(), targetDate: z.coerce.date().nullable().optional(), status: z.enum(['open', 'in_progress', 'achieved', 'dropped']).optional() }), req.body);
    const acc = await mentorshipAccess(req.viewer!, String(oid(req.params.id)), { write: true });
    const set: Record<string, unknown> = { ...b };
    if (b.status === 'achieved') set.achievedAt = new Date();
    const g = await Goal.findOneAndUpdate({ _id: oid(req.params.gid, 'Goal'), mentorship: acc.mentorship._id }, { $set: set }, { new: true }).lean();
    if (!g) throw notFound('Goal');
    await touchMentorship(acc.mentorship._id);
    res.json({ goal: goalView(g) });
  }),
);

/* --------------------------------------------------------- action items */
r.post(
  '/:id/actions',
  ah(async (req, res) => {
    const b = parse(z.object({ title: z.string().trim().min(2).max(300), assignee: z.enum(['student', 'mentor']).default('student'), dueDate: z.coerce.date().optional(), goalId: z.string().optional(), sessionId: z.string().optional() }), req.body);
    const acc = await mentorshipAccess(req.viewer!, String(oid(req.params.id)), { write: true });
    if (acc.mentorship.status !== 'active') throw conflict('not_active', 'This mentorship is not active');
    if (b.goalId && !(await Goal.exists({ _id: oid(b.goalId, 'Goal'), mentorship: acc.mentorship._id }))) throw badRequest('invalid_goal', 'Goal does not belong to this mentorship');
    if (b.sessionId && !(await Session.exists({ _id: oid(b.sessionId, 'Session'), mentorship: acc.mentorship._id }))) throw badRequest('invalid_session', 'Session does not belong to this mentorship');
    const a = await ActionItem.create({ mentorship: acc.mentorship._id, title: b.title, assignee: b.assignee, dueDate: b.dueDate, goal: b.goalId, session: b.sessionId, createdBy: req.viewer!.id });
    await touchMentorship(acc.mentorship._id);
    res.status(201).json({ actionItem: actionItemView(a.toObject()) });
  }),
);

r.patch(
  '/:id/actions/:aid',
  ah(async (req, res) => {
    const b = parse(z.object({ title: z.string().trim().min(2).max(300).optional(), status: z.enum(['open', 'done']).optional(), dueDate: z.coerce.date().nullable().optional() }), req.body);
    const acc = await mentorshipAccess(req.viewer!, String(oid(req.params.id)), { write: true });
    const set: Record<string, unknown> = { ...b };
    if (b.status === 'done') set.completedAt = new Date();
    if (b.status === 'open') set.completedAt = null;
    const a = await ActionItem.findOneAndUpdate({ _id: oid(req.params.aid, 'Action item'), mentorship: acc.mentorship._id }, { $set: set }, { new: true }).lean();
    if (!a) throw notFound('Action item');
    await touchMentorship(acc.mentorship._id);
    res.json({ actionItem: actionItemView(a) });
  }),
);

/* ------------------------------------------------------------- feedback */
r.get(
  '/:id/feedback',
  ah(async (req, res) => {
    const acc = await mentorshipAccess(req.viewer!, String(oid(req.params.id)));
    // Participants see their own feedback plus feedback given to them; staff see all.
    const list = await Feedback.find({ mentorship: acc.mentorship._id }).sort({ createdAt: -1 }).lean();
    res.json({ feedback: list.map(feedbackView) });
  }),
);

r.post(
  '/:id/feedback',
  ah(async (req, res) => {
    const b = parse(
      z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(2000).optional(), wouldRecommend: z.boolean().optional(), sessionId: z.string().optional(), kind: z.enum(['session', 'periodic', 'closing']).default('session') }),
      req.body,
    );
    const acc = await mentorshipAccess(req.viewer!, String(oid(req.params.id)), { write: true });
    if (b.sessionId) {
      const s = await Session.findOne({ _id: oid(b.sessionId, 'Session'), mentorship: acc.mentorship._id }).lean();
      if (!s || s.status !== 'completed') throw badRequest('invalid_session', 'Feedback can be given for completed sessions');
    }
    const f = await Feedback.create({
      mentorship: acc.mentorship._id,
      session: b.sessionId,
      from: req.viewer!.id,
      fromRole: acc.isMentor ? 'mentor' : 'student',
      kind: b.sessionId ? 'session' : b.kind,
      rating: b.rating,
      comment: b.comment ? maskContactDetails(b.comment).text : undefined,
      wouldRecommend: b.wouldRecommend,
    });
    res.status(201).json({ feedback: feedbackView(f.toObject()) });
  }),
);

export default r;
