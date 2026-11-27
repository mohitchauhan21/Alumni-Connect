import crypto from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors.js';
import { sniffDocumentType } from '../lib/filetype.js';
import { logger } from '../lib/logger.js';
import { maskContactDetails } from '../lib/mask.js';
import { normalizeMeetLink } from '../lib/meet.js';
import { escapeRegex } from '../lib/regex.js';
import { requireRole, requireVerifiedEmail } from '../middleware/auth.js';
import { ah, oid, parse } from '../middleware/common.js';
import { Alumnus, AvailabilityWindow, DEPARTMENTS, InstitutionRecord, MENTORING_AREAS, MentorCapacity, Mentorship, Session, User, VerificationRequest } from '../models/index.js';
import { availabilityView, capacityView, mentorSelf, verificationView } from '../serializers/index.js';
import { audit } from '../services/audit.js';
import { jitsiLink } from '../services/calendar.js';
import { storage } from '../services/storage.js';
import { getSettings } from '../services/settings.js';
import { decideVerification, normalizeName, submitVerification } from '../services/verification.js';

const r = Router();

const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
// Files are held in memory (max 3 x 5 MB), checked by content, then written to private storage.
const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => (ALLOWED.has(file.mimetype) ? cb(null, true) : cb(badRequest('unsupported_file', 'Only PDF, PNG, JPEG or WEBP documents are accepted'))),
}).array('documents', 3);

/** Upload errors (too big, too many files) become clear 400s instead of server errors. */
function uploadDocuments(req: Request, res: Response, next: NextFunction) {
  multerUpload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Each document must be 5 MB or smaller' : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? 'You can upload up to 3 documents' : 'Upload failed';
      return next(badRequest('upload_error', msg));
    }
    next(err);
  });
}

/* ----------------------------------------------------- own profile (M1) */
r.get(
  '/me',
  requireRole('alumnus'),
  ah(async (req, res) => {
    const a = await Alumnus.findOne({ user: req.viewer!.id }).select('+linkedinUrl +meetLink').populate('expertise').lean();
    if (!a) throw notFound('Alumnus profile');
    const [u, cap, windows, ver] = await Promise.all([
      User.findById(req.viewer!.id).select('+email +phone').lean(),
      MentorCapacity.findOne({ alumnus: a._id }).lean(),
      AvailabilityWindow.find({ alumnus: a._id }).sort({ dayOfWeek: 1, startMinute: 1 }).lean(),
      VerificationRequest.findOne({ alumnus: a._id }).sort({ createdAt: -1 }).lean(),
    ]);
    res.json({
      profile: mentorSelf(a, u),
      capacity: cap ? { ...capacityView(cap), maxPendingRequests: cap.maxPendingRequests, pauseReason: cap.pauseReason ?? null } : null,
      availability: windows.map(availabilityView),
      verification: verificationView(ver, req.viewer!),
    });
  }),
);

const profileSchema = z.object({
  headline: z.string().trim().max(140).optional(),
  currentRole: z.string().trim().max(100).optional(),
  currentCompany: z.string().trim().max(100).optional(),
  industry: z.string().trim().max(60).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  city: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(2000).optional(),
  expertise: z.array(z.string()).max(15).optional(),
  mentoringAreas: z.array(z.enum(MENTORING_AREAS)).max(9).optional(),
  languages: z.array(z.string().trim().max(30)).max(8).optional(),
  linkedinUrl: z.string().url().max(200).optional().or(z.literal('')),
  mentorOptIn: z.boolean().optional(),
  department: z.enum(DEPARTMENTS).optional(),
  degree: z.string().trim().max(60).optional(),
  graduationYear: z.number().int().min(1950).max(2100).optional(),
  sessionFee: z.number().int().min(0).max(100000).optional(),
  /** The mentor's own Google Meet room; '' removes it. */
  meetLink: z.string().trim().max(200).optional(),
});

r.put(
  '/me',
  requireRole('alumnus'),
  ah(async (req, res) => {
    const b = parse(profileSchema, req.body);
    if (b.sessionFee) {
      const max = (await getSettings()).payments?.maxSessionFee ?? 0;
      if (b.sessionFee > max) throw badRequest('fee_too_high', `The programme allows at most ₹${max} per session`);
    }
    let meetLink: string | undefined;
    if (b.meetLink !== undefined) {
      meetLink = b.meetLink === '' ? '' : (normalizeMeetLink(b.meetLink) ?? undefined);
      if (meetLink === undefined) throw badRequest('invalid_meet_link', 'Paste a Google Meet link like https://meet.google.com/abc-defg-hij');
    }
    const a = await Alumnus.findOne({ user: req.viewer!.id }).select('+meetLink');
    if (!a) throw notFound('Alumnus profile');
    const previousMeet = a.meetLink ?? '';
    // Academic identity is locked once verified against institutional records.
    if (a.verificationStatus === 'verified') {
      delete b.department;
      delete b.degree;
      delete b.graduationYear;
    }
    // Student-visible free text is masked so alumni can't accidentally publish contact details.
    for (const k of ['headline', 'bio', 'currentRole', 'currentCompany', 'city'] as const) {
      if (typeof b[k] === 'string') b[k] = maskContactDetails(b[k]!).text;
    }
    delete b.meetLink;
    Object.assign(a, { ...b, expertise: b.expertise ? b.expertise.map((x) => oid(x, 'Tag')) : a.expertise });
    if (meetLink !== undefined) a.meetLink = meetLink || undefined;
    await a.save();
    if (meetLink !== undefined && meetLink !== previousMeet) await relinkUpcomingSessions(a._id, previousMeet, meetLink);
    res.json({ ok: true });
  }),
);

/**
 * Keeps already-booked sessions in step with the mentor's Meet room: a new room replaces the link of
 * every upcoming confirmed session; removing it gives the sessions that used it a fresh Jitsi room.
 */
async function relinkUpcomingSessions(alumnusId: unknown, previous: string, next: string) {
  const ms = await Mentorship.find({ alumnus: alumnusId }).select('_id').lean();
  const upcoming = { mentorship: { $in: ms.map((m) => m._id) }, status: 'scheduled', scheduledStart: { $gt: new Date() } };
  if (next) {
    await Session.updateMany(upcoming, { $set: { videoLink: next } });
    return;
  }
  const using = await Session.find({ ...upcoming, videoLink: previous }).select('_id').lean();
  for (const s of using) await Session.updateOne({ _id: s._id }, { $set: { videoLink: jitsiLink() } });
}

/* ------------------------------------------------------- verification */
r.post(
  '/verify',
  requireRole('alumnus'),
  requireVerifiedEmail,
  uploadDocuments,
  ah(async (req, res) => {
    const b = parse(
      z.object({
        fullName: z.string().trim().min(2).max(100),
        rollNumber: z.string().trim().min(3).max(30),
        graduationYear: z.coerce.number().int().min(1950).max(2100),
        degree: z.string().trim().min(2).max(60),
        department: z.string().trim().min(2).max(80),
        dateOfBirth: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .or(z.literal('').transform(() => undefined)),
      }),
      req.body,
    );
    // Identify each file by its content (not its name or the browser's claim), then store it privately.
    const incoming = (req.files as Express.Multer.File[]) ?? [];
    const typed = incoming.map((f) => ({ f, type: sniffDocumentType(f.buffer) }));
    const bad = typed.find((t) => !t.type);
    if (bad) throw badRequest('unsupported_file', `"${bad.f.originalname}" isn't a valid PDF, PNG, JPEG or WEBP file`);
    const stored: string[] = [];
    let vr;
    try {
      const files = [];
      for (const { f, type } of typed) {
        const key = `verification/${crypto.randomUUID()}.${type!.ext}`;
        await storage().put(key, f.buffer, type!.mime);
        stored.push(key);
        files.push({ originalName: f.originalname.slice(0, 200), storedName: key, mimeType: type!.mime, size: f.size });
      }
      vr = await submitVerification(req.viewer!, b, files);
    } catch (e) {
      // Don't leave orphaned files behind if the submission fails.
      await Promise.all(stored.map((k) => storage().remove(k).catch((err) => logger.warn('Could not remove orphaned upload', { k, err: String(err) }))));
      throw e;
    }
    res.status(201).json({ verification: verificationView(vr.toObject ? vr.toObject() : vr, req.viewer!) });
  }),
);

r.get(
  '/verify',
  requireRole('alumnus'),
  ah(async (req, res) => {
    const a = await Alumnus.findOne({ user: req.viewer!.id }).lean();
    const list = a ? await VerificationRequest.find({ alumnus: a._id }).sort({ createdAt: -1 }).lean() : [];
    res.json({ verifications: list.map((v) => verificationView(v, req.viewer!)) });
  }),
);

r.get(
  '/verify/queue',
  requireRole('aro', 'admin'),
  ah(async (req, res) => {
    const status = parse(z.enum(['pending', 'needs_info', 'approved', 'rejected', 'all']).default('pending'), req.query.status);
    const q = status === 'all' ? {} : { status };
    const list = await VerificationRequest.find(q)
      .sort({ createdAt: 1 })
      .limit(200)
      .populate({ path: 'alumnus', select: '+linkedinUrl', populate: { path: 'user', select: 'name +email +phone' } })
      .populate('matchResult.record')
      .lean();
    const counts = await VerificationRequest.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
    res.json({ verifications: list.map((v) => verificationView(v, req.viewer!)), counts: Object.fromEntries(counts.map((c: any) => [c._id, c.n])) });
  }),
);

r.get(
  '/verify/:id',
  requireRole('aro', 'admin'),
  ah(async (req, res) => {
    const v = await VerificationRequest.findById(oid(req.params.id))
      .populate({ path: 'alumnus', select: '+linkedinUrl', populate: { path: 'user', select: 'name +email +phone' } })
      .populate('matchResult.record')
      .lean();
    if (!v) throw notFound('Verification request');
    res.json({ verification: verificationView(v, req.viewer!) });
  }),
);

r.post(
  '/verify/:id/decision',
  requireRole('aro', 'admin'),
  ah(async (req, res) => {
    const b = parse(z.object({ decision: z.enum(['approve', 'reject', 'needs_info']), note: z.string().trim().max(1000).optional() }), req.body);
    const v = await decideVerification(req.viewer!, String(oid(req.params.id)), b.decision, b.note);
    res.json({ verification: verificationView(v.toObject(), req.viewer!) });
  }),
);

r.get(
  '/verify/:id/documents/:docId',
  requireRole('aro', 'admin'),
  ah(async (req, res) => {
    const v = await VerificationRequest.findById(oid(req.params.id)).lean();
    const d = v?.documents?.find((x: any) => String(x._id) === req.params.docId);
    if (!v || !d?.storedName) throw notFound('Document');
    const stream = await storage().get(d.storedName);
    if (!stream) throw notFound('Document file');
    await audit(req.viewer!, 'verification.document_viewed', 'VerificationRequest', v._id, { doc: d.originalName });
    res.setHeader('Content-Type', d.mimeType ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(d.originalName ?? 'document')}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    stream.on('error', (e) => {
      logger.error('Document stream failed', { e: String(e) });
      res.destroy();
    });
    stream.pipe(res);
  }),
);

/* ------------------------------------------- institutional records (ERP) */
/** CSV columns: rollNumber,fullName,graduationYear,degree,department,dateOfBirth */
export function parseRecordsCsv(csv: string) {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const split = (l: string) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"').trim()).slice(0, -1);
  const header = split(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const need = ['rollnumber', 'fullname', 'graduationyear', 'degree', 'department'];
  for (const n of need) if (col(n) < 0) throw badRequest('csv_header', `CSV is missing column "${n}"`);
  return lines.slice(1).map((l) => {
    const c = split(l);
    return {
      rollNumber: c[col('rollnumber')],
      fullName: c[col('fullname')],
      graduationYear: Number(c[col('graduationyear')]),
      degree: c[col('degree')],
      department: c[col('department')],
      dateOfBirth: col('dateofbirth') >= 0 ? c[col('dateofbirth')] || undefined : undefined,
    };
  });
}

r.post(
  '/records/import',
  requireRole('aro', 'admin'),
  ah(async (req, res) => {
    const b = parse(z.object({ csv: z.string().min(10).max(5_000_000) }), req.body);
    const rows = parseRecordsCsv(b.csv).filter((x) => x.rollNumber && x.fullName && x.graduationYear);
    if (!rows.length) throw badRequest('csv_empty', 'No valid rows found');
    const result = await InstitutionRecord.bulkWrite(
      rows.map((x) => ({
        updateOne: {
          filter: { rollNumber: x.rollNumber.toUpperCase() },
          update: { $set: { ...x, rollNumber: x.rollNumber.toUpperCase(), normalizedName: normalizeName(x.fullName), source: 'csv_import' } },
          upsert: true,
        },
      })),
    );
    await audit(req.viewer!, 'records.imported', 'InstitutionRecord', null, { rows: rows.length, upserted: result.upsertedCount, modified: result.modifiedCount });
    res.json({ imported: rows.length, created: result.upsertedCount, updated: result.modifiedCount });
  }),
);

r.get(
  '/records',
  requireRole('aro', 'admin'),
  ah(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const filter = q ? { $or: [{ rollNumber: q.toUpperCase() }, { normalizedName: { $regex: escapeRegex(normalizeName(q)) } }] } : {};
    const [records, total] = await Promise.all([InstitutionRecord.find(filter).sort({ graduationYear: -1 }).limit(100).lean(), InstitutionRecord.countDocuments()]);
    res.json({
      total,
      records: records.map((x) => ({ id: String(x._id), rollNumber: x.rollNumber, fullName: x.fullName, graduationYear: x.graduationYear, degree: x.degree, department: x.department, source: x.source })),
    });
  }),
);

export default r;
