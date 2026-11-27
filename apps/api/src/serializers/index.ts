/**
 * PRIVACY LAYER — the single place where database documents become API output.
 *
 * Every route and every Socket.IO emit passes documents through these functions.
 * Each view is an explicit ALLOWLIST: a field reaches a client only if it is named here.
 * Alumni email, phone and LinkedIn URL are never part of any student- or mentor-facing view.
 * (docs/PRIVACY.md lists every student-visible field and must be kept in sync with this file.)
 */
import { maskContactDetails } from '../lib/mask.js';
import type { Role } from '../models/constants.js';

type Doc = Record<string, any> | null | undefined;

/**
 * Free text written by one person and shown to another passes through `txt()`, which masks
 * emails, phone numbers and social links at serialization time. Write paths also mask before
 * storage; this second pass covers every field (titles, names, goals, …) and any legacy/imported rows.
 */
const txt = (s: unknown): string | null => (typeof s === 'string' ? maskContactDetails(s).text : null);
const txts = (a: unknown): string[] => (Array.isArray(a) ? a.map((x) => txt(x) ?? '').filter(Boolean) : []);

export interface Viewer {
  id: string;
  role: Role;
  email?: string;
  phone?: string;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
}

const id = (v: any): string | null => (v == null ? null : String(v._id ?? v));
const iso = (d: any): string | null => (d ? new Date(d).toISOString() : null);
const isStaff = (v: Viewer) => v.role === 'aro' || v.role === 'admin' || v.role === 'placement';
const canSeeContact = (v: Viewer) => v.role === 'aro' || v.role === 'admin';

/* ---------------------------------------------------------------- users */
export function selfUser(u: Doc) {
  if (!u) return null;
  return {
    id: id(u),
    name: u.name,
    email: u.email,
    phone: u.phone ?? null,
    role: u.role,
    avatarUrl: u.avatarUrl ?? null,
    timezone: u.timezone,
    notificationPrefs: u.notificationPrefs ?? { email: true, sms: false },
    emailVerified: !!u.emailVerifiedAt,
    mfaEnabled: !!u.mfaEnabled,
    createdAt: iso(u.createdAt),
  };
}

/** Identity of another person inside the platform: a name and a role. No contact data, ever. */
export function publicUser(u: Doc) {
  if (!u) return null;
  return { id: id(u), name: txt(u.name), role: u.role };
}

export function staffUser(u: Doc) {
  if (!u) return null;
  return { ...publicUser(u)!, email: u.email, phone: u.phone ?? null, status: u.status, lastLoginAt: iso(u.lastLoginAt) };
}

/* ----------------------------------------------------------------- tags */
export const tag = (t: Doc) => (t && typeof t === 'object' && 'name' in t ? { id: id(t), name: t.name, category: t.category } : null);
const tags = (arr: any[] | undefined) => (arr ?? []).map(tag).filter(Boolean);

/* ------------------------------------------------------------- capacity */
export function capacityView(c: Doc) {
  if (!c) return { maxMentees: 0, activeCount: 0, openSlots: 0, accepting: false, paused: false, pausedUntil: null };
  const open = Math.max(0, (c.maxMentees ?? 0) - (c.activeCount ?? 0));
  return {
    maxMentees: c.maxMentees,
    activeCount: c.activeCount,
    openSlots: open,
    paused: !!c.paused,
    pausedUntil: iso(c.pausedUntil),
    accepting: !c.paused && open > 0,
  };
}

export function availabilityView(w: Doc) {
  if (!w) return null;
  return { id: id(w), dayOfWeek: w.dayOfWeek, startMinute: w.startMinute, endMinute: w.endMinute, timezone: w.timezone };
}

/* -------------------------------------------------------------- mentors */
/**
 * The mentor card shown to students (discovery, matching, profile page, mentorship header).
 * Allowlist — see docs/PRIVACY.md §2.
 */
export function mentorPublic(a: Doc, extra?: { capacity?: Doc; availability?: Doc[]; match?: { score: number; reasons: string[]; breakdown?: Record<string, number> } }) {
  if (!a) return null;
  const u = a.user && typeof a.user === 'object' ? a.user : null;
  return {
    id: id(a),
    name: txt(u?.name) ?? 'Alumnus',
    verified: a.verificationStatus === 'verified',
    headline: txt(a.headline),
    currentRole: txt(a.currentRole),
    currentCompany: txt(a.currentCompany),
    industry: a.industry ?? null,
    yearsExperience: a.yearsExperience ?? null,
    city: txt(a.city),
    department: a.department ?? null,
    degree: a.degree ?? null,
    graduationYear: a.graduationYear ?? null,
    bio: txt(a.bio),
    expertise: tags(a.expertise),
    mentoringAreas: a.mentoringAreas ?? [],
    languages: txts(a.languages),
    sessionFee: typeof a.sessionFee === 'number' ? a.sessionFee : 0,
    capacity: extra?.capacity !== undefined ? capacityView(extra.capacity) : undefined,
    availability: extra?.availability ? extra.availability.map(availabilityView) : undefined,
    match: extra?.match,
  };
}

/** The alumnus viewing/editing their own profile. Contact data is theirs, so it is included. */
export function mentorSelf(a: Doc, user: Doc) {
  if (!a) return null;
  return {
    ...mentorPublic(a)!,
    verificationStatus: a.verificationStatus,
    verifiedAt: iso(a.verifiedAt),
    mentorOptIn: a.mentorOptIn,
    rollNumber: a.rollNumber ?? null,
    linkedinUrl: a.linkedinUrl ?? null,
    meetLink: a.meetLink ?? null,
    user: selfUser(user),
  };
}

/** Alumni Relations Officer / Admin view (verification, overload management). */
export function mentorStaff(a: Doc, viewer: Viewer, extra?: { capacity?: Doc }) {
  if (!a) return null;
  const base = {
    ...mentorPublic(a, { capacity: extra?.capacity })!,
    verificationStatus: a.verificationStatus,
    verifiedAt: iso(a.verifiedAt),
    mentorOptIn: a.mentorOptIn,
    rollNumber: a.rollNumber ?? null,
  };
  if (!canSeeContact(viewer)) return base;
  const u = a.user && typeof a.user === 'object' ? a.user : null;
  return { ...base, contact: { email: u?.email ?? null, phone: u?.phone ?? null, linkedinUrl: a.linkedinUrl ?? null } };
}

/* ------------------------------------------------------------- students */
/** What a mentor sees about a student. Symmetric privacy: no student contact data either. */
export function studentForMentor(s: Doc, goals?: Doc[]) {
  if (!s) return null;
  const u = s.user && typeof s.user === 'object' ? s.user : null;
  return {
    id: id(s),
    name: txt(u?.name) ?? 'Student',
    program: txt(s.program),
    department: s.department ?? null,
    graduationYear: s.graduationYear ?? null,
    bio: txt(s.bio),
    interests: tags(s.interests),
    targetRoles: txts(s.targetRoles),
    targetIndustries: txts(s.targetIndustries),
    mentoringAreasWanted: s.mentoringAreasWanted ?? [],
    goals: goals ? goals.map(careerGoal) : undefined,
  };
}

export function studentSelf(s: Doc, user: Doc, goals?: Doc[]) {
  if (!s) return null;
  return { ...studentForMentor(s, goals)!, rollNumber: s.rollNumber ?? null, user: selfUser(user) };
}

export function careerGoal(g: Doc) {
  if (!g) return null;
  return {
    id: id(g),
    title: txt(g.title),
    description: txt(g.description),
    targetRole: txt(g.targetRole),
    targetIndustry: txt(g.targetIndustry),
    timeframe: g.timeframe,
    priority: g.priority,
  };
}

/* ------------------------------------------------------------- requests */
export function requestView(r: Doc, viewer: Viewer) {
  if (!r) return null;
  const base = {
    id: id(r),
    status: r.status,
    message: txt(r.message),
    createdAt: iso(r.createdAt),
    expiresAt: iso(r.expiresAt),
    respondedAt: iso(r.respondedAt),
    declineReason: r.declineReason ?? null,
    declineNote: txt(r.declineNote),
    matchScore: r.matchScore ?? null,
    matchReasons: txts(r.matchReasons),
    goals: Array.isArray(r.goals) && r.goals[0] && typeof r.goals[0] === 'object' && 'title' in r.goals[0] ? r.goals.map(careerGoal) : undefined,
  };
  const mentor = r.alumnus && typeof r.alumnus === 'object' && 'user' in r.alumnus ? mentorPublic(r.alumnus) : { id: id(r.alumnus) };
  const student = r.student && typeof r.student === 'object' && 'user' in r.student ? studentForMentor(r.student) : { id: id(r.student) };
  if (viewer.role === 'student') return { ...base, mentor };
  if (viewer.role === 'alumnus') return { ...base, student };
  return { ...base, mentor, student };
}

/* ---------------------------------------------------------- mentorships */
export function mentorshipView(m: Doc, viewer: Viewer) {
  if (!m) return null;
  return {
    id: id(m),
    status: m.status,
    startedAt: iso(m.startedAt),
    endedAt: iso(m.endedAt),
    endReason: m.endReason ?? null,
    lastActivityAt: iso(m.lastActivityAt),
    health: m.health,
    healthScore: m.healthScore,
    mentor: m.alumnus && typeof m.alumnus === 'object' && 'user' in m.alumnus ? mentorPublic(m.alumnus) : { id: id(m.alumnus) },
    student: m.student && typeof m.student === 'object' && 'user' in m.student ? studentForMentor(m.student) : { id: id(m.student) },
    viewerRole: viewer.role === 'student' ? 'student' : viewer.role === 'alumnus' ? 'mentor' : 'staff',
  };
}

export function sessionView(s: Doc, viewer: Viewer, opts?: { viewerIsMentor?: boolean }) {
  if (!s) return null;
  const out: Record<string, any> = {
    id: id(s),
    mentorshipId: id(s.mentorship),
    status: s.status,
    title: txt(s.title),
    agenda: txt(s.agenda),
    proposedBy: id(s.proposedBy),
    proposedSlots: (s.proposedSlots ?? []).map((x: any) => ({ start: iso(x.start), end: iso(x.end) })),
    scheduledStart: iso(s.scheduledStart),
    scheduledEnd: iso(s.scheduledEnd),
    videoLink: s.status === 'scheduled' || s.status === 'completed' ? s.videoLink ?? null : null,
    calendarSynced: (s.externalEvents ?? []).some((e: any) => String(e.userId) === viewer.id),
    summary: txt(s.summary),
    cancelReason: txt(s.cancelReason),
    fee: typeof s.fee === 'number' ? s.fee : 0, // paise
    paymentDueAt: s.status === 'awaiting_payment' ? iso(s.paymentDueAt) : null,
    paid: !!s.payment,
    paymentId: id(s.payment),
    completedAt: iso(s.completedAt),
    createdAt: iso(s.createdAt),
  };
  if (opts?.viewerIsMentor && s.mentorPrivateNotes !== undefined) out.mentorPrivateNotes = s.mentorPrivateNotes ?? null;
  return out;
}

export function goalView(g: Doc) {
  if (!g) return null;
  return {
    id: id(g),
    title: txt(g.title),
    description: txt(g.description),
    targetDate: iso(g.targetDate),
    status: g.status,
    achievedAt: iso(g.achievedAt),
    careerGoalId: id(g.careerGoal),
    createdBy: id(g.createdBy),
    createdAt: iso(g.createdAt),
  };
}

export function actionItemView(a: Doc) {
  if (!a) return null;
  return {
    id: id(a),
    title: txt(a.title),
    goalId: id(a.goal),
    sessionId: id(a.session),
    assignee: a.assignee,
    dueDate: iso(a.dueDate),
    status: a.status,
    completedAt: iso(a.completedAt),
    createdAt: iso(a.createdAt),
  };
}

export function feedbackView(f: Doc) {
  if (!f) return null;
  return {
    id: id(f),
    sessionId: id(f.session),
    fromRole: f.fromRole,
    from: id(f.from),
    kind: f.kind,
    rating: f.rating,
    wouldRecommend: f.wouldRecommend ?? null,
    comment: txt(f.comment),
    createdAt: iso(f.createdAt),
  };
}

export function messageView(m: Doc) {
  if (!m) return null;
  return {
    id: id(m),
    mentorshipId: id(m.mentorship),
    senderId: id(m.sender),
    senderRole: m.senderRole,
    body: txt(m.body),
    masked: (m.maskedCount ?? 0) > 0,
    readAt: iso(m.readAt),
    createdAt: iso(m.createdAt),
  };
}

export function notificationView(n: Doc) {
  if (!n) return null;
  return {
    id: id(n),
    type: n.type,
    title: txt(n.title),
    body: txt(n.body),
    link: n.link ?? null,
    actions: n.actions ?? [],
    readAt: iso(n.readAt),
    createdAt: iso(n.createdAt),
  };
}

export function verificationView(v: Doc, viewer: Viewer) {
  if (!v) return null;
  const out: Record<string, any> = {
    id: id(v),
    status: v.status,
    submitted: v.submitted,
    documents: (v.documents ?? []).map((d: any) => ({ id: id(d), originalName: d.originalName, mimeType: d.mimeType, size: d.size, uploadedAt: iso(d.uploadedAt) })),
    matchResult: v.matchResult
      ? {
          matched: !!v.matchResult.matched,
          confidence: v.matchResult.confidence ?? 0,
          matchedFields: v.matchResult.matchedFields ?? [],
          mismatchedFields: v.matchResult.mismatchedFields ?? [],
        }
      : null,
    reviewNote: v.reviewNote ?? null,
    decidedAt: iso(v.decidedAt),
    createdAt: iso(v.createdAt),
    history: (v.history ?? []).map((h: any) => ({ status: h.status, byName: h.byName ?? null, note: h.note ?? null, at: iso(h.at) })),
  };
  if (isStaff(viewer)) {
    const a = v.alumnus && typeof v.alumnus === 'object' ? v.alumnus : null;
    out.alumnus = a ? mentorStaff(a, viewer) : { id: id(v.alumnus) };
    if (v.matchResult?.record && typeof v.matchResult.record === 'object') {
      const r = v.matchResult.record;
      out.institutionRecord = { rollNumber: r.rollNumber, fullName: r.fullName, graduationYear: r.graduationYear, degree: r.degree, department: r.department, dateOfBirth: r.dateOfBirth ?? null };
    }
  }
  return out;
}

/* --------------------------------------------------------- leak guard */
const ALWAYS_FORBIDDEN = new Set(['passwordHash', 'accessToken', 'refreshToken']);
const CONTACT_KEYS = new Set(['email', 'phone']);

/**
 * Defence in depth: scans an outgoing payload for fields a viewer must never receive.
 * Returns the JSON paths of violations (empty = safe). Used by middleware/leakGuard.ts and the socket layer.
 */
export function findPrivacyViolations(payload: unknown, viewer: Viewer | null): string[] {
  const violations: string[] = [];
  const staffContact = viewer && canSeeContact(viewer);
  const own = new Set([viewer?.email, viewer?.phone].filter(Boolean).map((x) => String(x).toLowerCase()));

  const walk = (node: unknown, path: string, depth: number) => {
    if (depth > 30 || node == null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((x, i) => walk(x, `${path}[${i}]`, depth + 1));
      return;
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const p = `${path}.${k}`;
      if (ALWAYS_FORBIDDEN.has(k) && v != null) violations.push(p);
      else if (!staffContact && CONTACT_KEYS.has(k) && typeof v === 'string' && v !== '' && !own.has(v.toLowerCase())) violations.push(p);
      else if (viewer?.role === 'student' && (k === 'linkedinUrl' || k === 'meetLink' || k === 'mentorPrivateNotes' || k === 'contact') && v != null) violations.push(p);
      else walk(v, p, depth + 1);
    }
  };
  walk(payload, '$', 0);
  return violations;
}

/* ------------------------------------------------------------- payments */
const nameOf = (u: any) => (u && typeof u === 'object' && 'name' in u ? txt(u.name) : null);

function methodSummary(m: Doc) {
  if (!m?.kind) return null;
  const NET: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', rupay: 'RuPay', amex: 'Amex' };
  const label =
    m.kind === 'card'
      ? `${NET[m.network] ?? 'Card'} •••• ${m.last4 ?? ''}`.trim()
      : m.kind === 'upi'
        ? `UPI ${m.vpa ?? ''}`.trim()
        : m.kind === 'netbanking'
          ? 'Net banking'
          : m.kind === 'wallet'
            ? 'Wallet'
            : 'Other';
  return { kind: m.kind, network: m.network ?? null, last4: m.last4 ?? null, vpa: m.vpa ?? null, label };
}

/**
 * A payment as each party sees it. The payer sees how they paid; the mentor sees the split
 * (platform fee, their share) but not the student's card; staff see both. Gateway ids never leave.
 */
export function paymentView(p: Doc, viewer: Viewer) {
  if (!p) return null;
  const isPayer = id(p.payer) === viewer.id;
  const staff = viewer.role === 'admin' || viewer.role === 'aro';
  const mentorUser = p.alumnus && typeof p.alumnus === 'object' ? p.alumnus.user : null;
  const isMentor = viewer.role === 'alumnus' && id(mentorUser) === viewer.id;
  const out: Record<string, any> = {
    id: id(p),
    receiptNo: p.receiptNo,
    status: p.status,
    amount: p.amount,
    currency: p.currency ?? 'INR',
    sessionId: id(p.session),
    sessionTitle: p.session && typeof p.session === 'object' ? txt(p.session.title) : null,
    sessionStart: p.session && typeof p.session === 'object' ? iso(p.session.scheduledStart) : null,
    mentorshipId: id(p.mentorship),
    mentorName: nameOf(mentorUser),
    studentName: nameOf(p.payer),
    refund: p.refund?.status ? { amount: p.refund.amount ?? 0, status: p.refund.status, reason: txt(p.refund.reason), at: iso(p.refund.at) } : null,
    paidAt: iso(p.paidAt),
    createdAt: iso(p.createdAt),
  };
  if (isPayer || staff) {
    out.method = methodSummary(p.method);
    out.failureReason = txt(p.failureReason);
  }
  if (isMentor || staff) {
    out.platformFee = p.platformFee;
    out.mentorShare = p.mentorShare;
  }
  return out;
}

/** A saved card, for its owner only. The gateway token is never serialized. */
export function methodView(m: Doc, extra?: { totalPaid?: number; recent?: Doc[] }) {
  if (!m) return null;
  return {
    id: id(m),
    network: m.network,
    cardType: m.cardType,
    issuer: m.issuer ?? null,
    nickname: m.nickname ?? null,
    last4: m.last4,
    expMonth: m.expMonth,
    expYear: m.expYear,
    holder: m.holder ?? null,
    finish: m.finish,
    isDefault: !!m.isDefault,
    totalPaid: extra?.totalPaid ?? 0,
    recent: (extra?.recent ?? []).map((p: any) => ({
      id: id(p),
      mentorName: nameOf(p.alumnus?.user),
      title: txt(p.session?.title) ?? 'Mentoring session',
      amount: p.status === 'refunded' ? p.amount : -p.amount,
      status: p.status,
      at: iso(p.paidAt ?? p.createdAt),
    })),
  };
}
