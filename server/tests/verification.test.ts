/**
 * server/tests/verification.test.ts
 * Integration tests for Phase 3: Alumni Institutional Verification & Officer Workflow.
 * Uses Supertest + Vitest with mocked Mongoose models.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';

// ── Mock Mongoose models ──────────────────────────────────────────────────────

vi.mock('../src/modules/auth/user.model.js', () => ({
  User: {
    findById: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('../src/modules/verification/verification.model.js', () => ({
  AlumniVerification: {
    findOne: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    countDocuments: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../src/modules/verification/institutionalRecord.model.js', () => ({
  InstitutionalAlumniRecord: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    bulkWrite: vi.fn(),
    countDocuments: vi.fn().mockResolvedValue(10),
  },
}));

vi.mock('../src/modules/audit/audit.model.js', () => ({
  AuditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

const { User } = await import('../src/modules/auth/user.model.js');
const { AlumniVerification } = await import('../src/modules/verification/verification.model.js');
const { InstitutionalAlumniRecord } =
  await import('../src/modules/verification/institutionalRecord.model.js');
const { env } = await import('../src/config/env.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

const mockAlumniUser = {
  _id: { toString: () => '507f1f77bcf86cd799439011' },
  fullName: 'Priya Sharma',
  email: 'priya@personal.com',
  role: 'alumni',
  accountStatus: 'active',
};

const mockStudentUser = {
  _id: { toString: () => '507f1f77bcf86cd799439012' },
  fullName: 'Alice Student',
  email: 'alice@student.com',
  role: 'student',
  accountStatus: 'active',
};

const mockOfficerUser = {
  _id: { toString: () => '507f1f77bcf86cd799439013' },
  fullName: 'Officer Dan',
  email: 'officer@univ.edu',
  role: 'alumni_officer',
  accountStatus: 'active',
};

function mockAuthUser(user: typeof mockAlumniUser) {
  const chainable = {
    select: vi.fn().mockResolvedValue(user),
    then: (resolve: (v: typeof user) => void) => Promise.resolve(user).then(resolve),
    catch: (reject: (e: unknown) => void) => Promise.resolve(user).catch(reject),
  };
  vi.mocked(User.findById).mockReturnValue(chainable as never);
}

function mockFindOne(result: unknown) {
  const query = {
    sort: vi.fn().mockResolvedValue(result),
    then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve),
    catch: (reject: (e: unknown) => void) => Promise.resolve(result).catch(reject),
  };
  vi.mocked(AlumniVerification.findOne).mockReturnValue(query as never);
}

const mockInstitutionalRecord = {
  _id: { toString: () => '607f1f77bcf86cd799439099' },
  alumniId: 'ALU-2018-001',
  fullName: 'Priya Sharma',
  institutionalEmail: 'priya.sharma@alumni.univ.edu',
  programme: 'B.Tech Computer Science',
  department: 'Computer Science & Engineering',
  graduationYear: 2022,
  isClaimed: false,
  claimedBy: null,
};

const mockPendingVerification = {
  _id: { toString: () => '707f1f77bcf86cd799439055' },
  userId: {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    fullName: 'Priya Sharma',
    email: 'priya@personal.com',
  },
  alumniId: 'ALU-2018-001',
  institutionalEmail: 'priya.sharma@alumni.univ.edu',
  programme: 'B.Tech Computer Science',
  department: 'Computer Science & Engineering',
  graduationYear: 2022,
  status: 'pending',
  matchingResult: 'matched',
  matchingDetails: 'Exact match found in institutional records.',
  matchedRecordId: { toString: () => '607f1f77bcf86cd799439099' },
  submissionVersion: 1,
  history: [],
  reviewedBy: null,
  rejectionReason: null,
  submittedAt: new Date(),
  save: vi.fn().mockResolvedValue(true),
};

// ── Test Suites ──────────────────────────────────────────────────────────────

describe('Alumni Verification API — GET /api/v1/verification/me', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns not_submitted status if no record exists', async () => {
    mockAuthUser(mockAlumniUser);
    mockFindOne(null);

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .get('/api/v1/verification/me')
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verification).toBeNull();
  });

  it('returns existing verification details when record exists', async () => {
    mockAuthUser(mockAlumniUser);
    mockFindOne(mockPendingVerification);

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .get('/api/v1/verification/me')
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.verification.status).toBe('pending');
    expect(res.body.data.verification.alumniId).toBe('ALU-2018-001');
  });

  it('rejects access from unauthenticated users with 401', async () => {
    const res = await request(app).get('/api/v1/verification/me');
    expect(res.status).toBe(401);
  });
});

describe('Alumni Verification API — POST /api/v1/verification/submit', () => {
  afterEach(() => vi.restoreAllMocks());

  const VALID_SUBMISSION = {
    alumniId: 'ALU-2018-001',
    institutionalEmail: 'priya.sharma@alumni.univ.edu',
    programme: 'B.Tech Computer Science',
    department: 'Computer Science & Engineering',
    graduationYear: 2022,
  };

  it('allows alumni to submit and flags matched when record exists', async () => {
    mockAuthUser(mockAlumniUser);
    vi.mocked(AlumniVerification.findOne).mockResolvedValue(null);
    vi.mocked(AlumniVerification.countDocuments).mockResolvedValue(0);
    vi.mocked(InstitutionalAlumniRecord.findOne).mockResolvedValue(
      mockInstitutionalRecord as never
    );
    vi.mocked(AlumniVerification.create).mockResolvedValue(mockPendingVerification as never);

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .post('/api/v1/verification/submit')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send(VALID_SUBMISSION);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.verification.status).toBe('pending');
  });

  it('rejects verification submission from students with 403', async () => {
    mockAuthUser(mockStudentUser);

    const token = signToken(mockStudentUser._id.toString());
    const res = await request(app)
      .post('/api/v1/verification/submit')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send(VALID_SUBMISSION);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects duplicate submission when verification is already pending', async () => {
    mockAuthUser(mockAlumniUser);
    vi.mocked(AlumniVerification.findOne)
      .mockResolvedValueOnce(null) // status: verified -> null
      .mockResolvedValueOnce(mockPendingVerification as never); // status: pending -> exists

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .post('/api/v1/verification/submit')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send(VALID_SUBMISSION);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('VERIFICATION_PENDING_EXISTS');
  });

  it('validates graduation year within permissible range', async () => {
    mockAuthUser(mockAlumniUser);

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .post('/api/v1/verification/submit')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send({ ...VALID_SUBMISSION, graduationYear: 1940 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Officer Verification API — Queue & Metrics', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns metrics summary for authorized officer', async () => {
    mockAuthUser(mockOfficerUser);
    vi.mocked(AlumniVerification.countDocuments)
      .mockResolvedValueOnce(5) // pending
      .mockResolvedValueOnce(8) // verified
      .mockResolvedValueOnce(2); // rejected
    vi.mocked(InstitutionalAlumniRecord.countDocuments).mockResolvedValueOnce(25);

    const token = signToken(mockOfficerUser._id.toString());
    const res = await request(app)
      .get('/api/v1/verification/officer/metrics')
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.metrics.pendingCount).toBe(5);
    expect(res.body.data.metrics.verifiedCount).toBe(8);
    expect(res.body.data.metrics.rejectedCount).toBe(2);
    expect(res.body.data.metrics.totalRecordsCount).toBe(25);
  });

  it('rejects non-officer / non-admin access to metrics with 403', async () => {
    mockAuthUser(mockAlumniUser);

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .get('/api/v1/verification/officer/metrics')
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(403);
  });

  it('returns paginated verification queue', async () => {
    mockAuthUser(mockOfficerUser);

    const mockQuery = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([mockPendingVerification]),
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve([mockPendingVerification]).then(resolve),
    };
    vi.mocked(AlumniVerification.find).mockReturnValue(mockQuery as never);
    vi.mocked(AlumniVerification.countDocuments).mockResolvedValue(1);

    const token = signToken(mockOfficerUser._id.toString());
    const res = await request(app)
      .get('/api/v1/verification/officer/queue?page=1&limit=10')
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });
});

describe('Officer Verification API — Approval & Rejection Actions', () => {
  afterEach(() => vi.restoreAllMocks());

  it('allows officer to approve a pending verification and claims record', async () => {
    mockAuthUser(mockOfficerUser);

    const verificationToApprove = {
      ...mockPendingVerification,
      status: 'pending',
      save: vi.fn().mockResolvedValue(true),
    };
    vi.mocked(AlumniVerification.findById).mockResolvedValue(verificationToApprove as never);
    vi.mocked(InstitutionalAlumniRecord.findOneAndUpdate).mockResolvedValue(
      mockInstitutionalRecord as never
    );

    const token = signToken(mockOfficerUser._id.toString());
    const res = await request(app)
      .post(`/api/v1/verification/officer/${mockPendingVerification._id.toString()}/approve`)
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.verification.status).toBe('verified');
    expect(verificationToApprove.save).toHaveBeenCalled();
  });

  it('rejects approval if already verified', async () => {
    mockAuthUser(mockOfficerUser);

    const alreadyVerified = {
      ...mockPendingVerification,
      status: 'verified',
    };
    vi.mocked(AlumniVerification.findById).mockResolvedValue(alreadyVerified as never);

    const token = signToken(mockOfficerUser._id.toString());
    const res = await request(app)
      .post(`/api/v1/verification/officer/${mockPendingVerification._id.toString()}/approve`)
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Cannot approve request/i);
  });

  it('allows officer to reject a pending verification with mandatory reason', async () => {
    mockAuthUser(mockOfficerUser);

    const verificationToReject = {
      ...mockPendingVerification,
      status: 'pending',
      save: vi.fn().mockResolvedValue(true),
    };
    vi.mocked(AlumniVerification.findById).mockResolvedValue(verificationToReject as never);

    const token = signToken(mockOfficerUser._id.toString());
    const res = await request(app)
      .post(`/api/v1/verification/officer/${mockPendingVerification._id.toString()}/reject`)
      .set('Cookie', [`p11_auth_token=${token}`])
      .send({ reason: 'Degree certificate records could not be reconciled with department roll.' });

    expect(res.status).toBe(200);
    expect(res.body.data.verification.status).toBe('rejected');
    expect(verificationToReject.rejectionReason).toMatch(/Degree certificate/);
  });

  it('requires rejection reason with at least 5 characters', async () => {
    mockAuthUser(mockOfficerUser);

    const token = signToken(mockOfficerUser._id.toString());
    const res = await request(app)
      .post(`/api/v1/verification/officer/${mockPendingVerification._id.toString()}/reject`)
      .set('Cookie', [`p11_auth_token=${token}`])
      .send({ reason: 'no' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
