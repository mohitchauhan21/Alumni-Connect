/**
 * auth.test.ts
 * Backend tests for all /api/v1/auth endpoints.
 * Uses Supertest + Vitest. Mocks Mongoose so no real DB is required.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../src/app.js';

// ── Mock Mongoose User model ──────────────────────────────────────────────────

vi.mock('../src/modules/auth/user.model.js', () => ({
  User: {
    create: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
  },
}));

const { User } = await import('../src/modules/auth/user.model.js');
const { env } = await import('../src/config/env.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

const VALID_STUDENT = {
  fullName: 'Alice Student',
  email: 'alice@test.com',
  password: 'SecurePass1',
  confirmPassword: 'SecurePass1',
  role: 'student',
};

const VALID_ALUMNI = {
  fullName: 'Bob Alumni',
  email: 'bob@test.com',
  password: 'SecurePass1',
  confirmPassword: 'SecurePass1',
  role: 'alumni',
};

const mockUser = {
  _id: { toString: () => '507f1f77bcf86cd799439011' },
  fullName: 'Alice Student',
  email: 'alice@test.com',
  role: 'student',
  accountStatus: 'active',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  comparePassword: vi.fn().mockResolvedValue(true),
};

/**
 * Helper: makes User.findById return an object that works both as:
 * - findById(id).select(...) → resolves to `user`
 * - await findById(id)       → resolves to `user`
 */
function mockFindById(user: typeof mockUser | null) {
  const chainable = {
    select: vi.fn().mockResolvedValue(user),
    then: (resolve: (v: typeof user) => void) => Promise.resolve(user).then(resolve),
    catch: (reject: (e: unknown) => void) => Promise.resolve(user).catch(reject),
  };
  vi.mocked(User.findById).mockReturnValue(chainable as never);
}

// ── Registration ──────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/register', () => {
  beforeEach(() => {
    vi.mocked(User.create).mockResolvedValue(mockUser as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers a student successfully', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(VALID_STUDENT);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('student');
    expect(res.body.data.user.email).toBe('alice@test.com');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('registers an alumni successfully', async () => {
    vi.mocked(User.create).mockResolvedValue({ ...mockUser, role: 'alumni' } as never);
    const res = await request(app).post('/api/v1/auth/register').send(VALID_ALUMNI);

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('alumni');
  });

  it('sets an HTTP-only auth cookie on successful registration', async () => {
    const res = await request(app).post('/api/v1/auth/register').send(VALID_STUDENT);

    expect(res.status).toBe(201);
    const cookieHeader = res.headers['set-cookie'] as string[] | undefined;
    expect(cookieHeader).toBeDefined();
    const authCookie = cookieHeader?.find(c => c.startsWith('p11_auth_token'));
    expect(authCookie).toBeDefined();
    expect(authCookie).toMatch(/HttpOnly/i);
  });

  it('rejects registration as admin', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...VALID_STUDENT, role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects registration as alumni_officer', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...VALID_STUDENT, role: 'alumni_officer' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects registration as placement_officer', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...VALID_STUDENT, role: 'placement_officer' });
    expect(res.status).toBe(400);
  });

  it('rejects missing required fields', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...VALID_STUDENT, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('rejects weak password (no uppercase)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...VALID_STUDENT, password: 'weakpass1', confirmPassword: 'weakpass1' });
    expect(res.status).toBe(400);
  });

  it('rejects password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...VALID_STUDENT, password: 'Short1', confirmPassword: 'Short1' });
    expect(res.status).toBe(400);
  });

  it('rejects mismatched passwords', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...VALID_STUDENT, confirmPassword: 'DifferentPass1' });
    expect(res.status).toBe(400);
  });

  it('returns 409 on duplicate email', async () => {
    vi.mocked(User.create).mockRejectedValue({ code: 11000 } as never);
    const res = await request(app).post('/api/v1/auth/register').send(VALID_STUDENT);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    expect(JSON.stringify(res.body)).not.toMatch(/mongo/i);
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/login', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs in successfully and sets auth cookie', async () => {
    vi.mocked(User.findOne).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue({ ...mockUser, comparePassword: vi.fn().mockResolvedValue(true) }),
    } as never);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@test.com', password: 'SecurePass1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('alice@test.com');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    const cookieHeader = res.headers['set-cookie'] as string[] | undefined;
    expect(cookieHeader?.find(c => c.startsWith('p11_auth_token'))).toBeDefined();
  });

  it('returns 401 for unknown email (generic message)', async () => {
    vi.mocked(User.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as never);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.com', password: 'SecurePass1' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(res.body.error.message).not.toMatch(/not found/i);
    expect(res.body.error.message).not.toMatch(/does not exist/i);
  });

  it('returns 401 for incorrect password (generic message)', async () => {
    vi.mocked(User.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        ...mockUser,
        comparePassword: vi.fn().mockResolvedValue(false),
      }),
    } as never);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@test.com', password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 403 for disabled account', async () => {
    vi.mocked(User.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        ...mockUser,
        accountStatus: 'disabled',
        comparePassword: vi.fn().mockResolvedValue(true),
      }),
    } as never);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@test.com', password: 'SecurePass1' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('returns 403 for suspended account', async () => {
    vi.mocked(User.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue({
        ...mockUser,
        accountStatus: 'suspended',
        comparePassword: vi.fn().mockResolvedValue(true),
      }),
    } as never);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@test.com', password: 'SecurePass1' });

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bad-email', password: 'SecurePass1' });
    expect(res.status).toBe(400);
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

describe('POST /api/v1/auth/logout', () => {
  it('clears the auth cookie and returns success', async () => {
    const res = await request(app).post('/api/v1/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const cookieHeader = res.headers['set-cookie'] as string[] | undefined;
    const clearedCookie = cookieHeader?.find(c => c.startsWith('p11_auth_token'));
    if (clearedCookie) {
      expect(clearedCookie).toMatch(/Max-Age=0|expires=Thu, 01 Jan 1970/i);
    }
  });
});

// ── /me (current user) ───────────────────────────────────────────────────────

describe('GET /api/v1/auth/me', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when no cookie is present', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid JWT', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'p11_auth_token=invalid.jwt.token');
    expect(res.status).toBe(401);
  });

  it('returns 401 for expired JWT', async () => {
    const expiredToken = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: -1,
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `p11_auth_token=${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns current user for valid authenticated session', async () => {
    const validToken = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '1h',
    });

    // Both authenticate (findById + select) and getUserById (findById, no select) use findById.
    // Return a chainable mock that works for both patterns.
    mockFindById(mockUser);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', `p11_auth_token=${validToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('alice@test.com');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });
});

// ── Security ──────────────────────────────────────────────────────────────────

describe('Security: no secret leakage in responses', () => {
  afterEach(() => vi.restoreAllMocks());

  it('registration response does not contain passwordHash or token', async () => {
    vi.mocked(User.create).mockResolvedValue(mockUser as never);
    const res = await request(app).post('/api/v1/auth/register').send(VALID_STUDENT);

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/passwordHash/i);
    expect(body).not.toMatch(/JWT_SECRET/i);
  });

  it('login response does not contain passwordHash', async () => {
    vi.mocked(User.findOne).mockReturnValue({
      select: vi
        .fn()
        .mockResolvedValue({ ...mockUser, comparePassword: vi.fn().mockResolvedValue(true) }),
    } as never);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@test.com', password: 'SecurePass1' });

    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
  });
});
