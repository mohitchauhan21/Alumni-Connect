/**
 * server/tests/csvImport.test.ts
 * Integration tests for Institutional CSV Roster Import (Preview & Confirm).
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
  },
}));

vi.mock('../src/modules/verification/institutionalRecord.model.js', () => ({
  InstitutionalAlumniRecord: {
    find: vi.fn(),
    bulkWrite: vi.fn(),
    countDocuments: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('../src/modules/audit/audit.model.js', () => ({
  AuditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

const { User } = await import('../src/modules/auth/user.model.js');
const { InstitutionalAlumniRecord } = await import(
  '../src/modules/verification/institutionalRecord.model.js'
);
const { env } = await import('../src/config/env.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

const mockOfficerUser = {
  _id: { toString: () => '507f1f77bcf86cd799439013' },
  fullName: 'Officer Dan',
  email: 'officer@univ.edu',
  role: 'alumni_officer',
  accountStatus: 'active',
};

const mockStudentUser = {
  _id: { toString: () => '507f1f77bcf86cd799439012' },
  fullName: 'Alice Student',
  email: 'alice@student.com',
  role: 'student',
  accountStatus: 'active',
};

function mockAuthUser(user: typeof mockOfficerUser) {
  const chainable = {
    select: vi.fn().mockResolvedValue(user),
    then: (resolve: (v: typeof user) => void) => Promise.resolve(user).then(resolve),
    catch: (reject: (e: unknown) => void) => Promise.resolve(user).catch(reject),
  };
  vi.mocked(User.findById).mockReturnValue(chainable as never);
}

function mockRecordFind(records: unknown[] = []) {
  const query = {
    select: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(records),
    then: (resolve: (v: unknown) => void) => Promise.resolve(records).then(resolve),
    catch: (reject: (e: unknown) => void) => Promise.resolve(records).catch(reject),
  };
  vi.mocked(InstitutionalAlumniRecord.find).mockReturnValue(query as never);
}

const VALID_CSV = `alumni_id,full_name,institutional_email,programme,department,graduation_year
ALU-2018-001,Priya Sharma,priya.sharma@alumni.univ.edu,B.Tech Computer Science,Computer Science & Engineering,2022
ALU-2019-042,Rohan Verma,rohan.verma@alumni.univ.edu,B.Tech Mechanical,Mechanical Engineering,2023`;

const INVALID_HEADERS_CSV = `id,name,email,program,dept,year
ALU-2018-001,Priya Sharma,priya@univ.edu,CS,CSE,2022`;

// ── Test Suites ──────────────────────────────────────────────────────────────

describe('CSV Roster Import API — POST /api/v1/verification/officer/records/import/preview', () => {
  afterEach(() => vi.restoreAllMocks());

  it('generates accurate preview without database mutations', async () => {
    mockAuthUser(mockOfficerUser);
    mockRecordFind([]);

    const token = signToken(mockOfficerUser._id.toString());
    const res = await request(app)
      .post('/api/v1/verification/officer/records/import/preview')
      .set('Cookie', [`p11_auth_token=${token}`])
      .attach('file', Buffer.from(VALID_CSV, 'utf-8'), 'roster.csv');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.preview.totalRows).toBe(2);
    expect(res.body.data.preview.validRowsCount).toBe(2);
    expect(res.body.data.preview.invalidRowsCount).toBe(0);
    expect(res.body.data.preview.previewRecords).toHaveLength(2);
  });

  it('rejects upload with missing mandatory CSV headers', async () => {
    mockAuthUser(mockOfficerUser);

    const token = signToken(mockOfficerUser._id.toString());
    const res = await request(app)
      .post('/api/v1/verification/officer/records/import/preview')
      .set('Cookie', [`p11_auth_token=${token}`])
      .attach('file', Buffer.from(INVALID_HEADERS_CSV, 'utf-8'), 'roster.csv');

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/missing required/i);
  });

  it('rejects access from unauthorized roles with 403', async () => {
    mockAuthUser(mockStudentUser);

    const token = signToken(mockStudentUser._id.toString());
    const res = await request(app)
      .post('/api/v1/verification/officer/records/import/preview')
      .set('Cookie', [`p11_auth_token=${token}`])
      .attach('file', Buffer.from(VALID_CSV, 'utf-8'), 'roster.csv');

    expect(res.status).toBe(403);
  });

  it('rejects requests without an attached file with 400', async () => {
    mockAuthUser(mockOfficerUser);

    const token = signToken(mockOfficerUser._id.toString());
    const res = await request(app)
      .post('/api/v1/verification/officer/records/import/preview')
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/valid \.csv file/i);
  });
});

describe('CSV Roster Import API — POST /api/v1/verification/officer/records/import', () => {
  afterEach(() => vi.restoreAllMocks());

  it('executes idempotent confirm import with bulkWrite and audit logging', async () => {
    mockAuthUser(mockOfficerUser);
    mockRecordFind([]);
    vi.mocked(InstitutionalAlumniRecord.bulkWrite).mockResolvedValue({
      upsertedCount: 2,
      modifiedCount: 0,
      matchedCount: 0,
      insertedCount: 2,
    } as never);

    const token = signToken(mockOfficerUser._id.toString());
    const res = await request(app)
      .post('/api/v1/verification/officer/records/import')
      .set('Cookie', [`p11_auth_token=${token}`])
      .attach('file', Buffer.from(VALID_CSV, 'utf-8'), 'roster.csv');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.result.totalProcessed).toBe(2);
    expect(res.body.data.result.batchId).toBeDefined();
    expect(InstitutionalAlumniRecord.bulkWrite).toHaveBeenCalledTimes(1);
  });
});
