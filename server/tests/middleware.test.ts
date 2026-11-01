/**
 * middleware.test.ts
 * Tests for authenticate middleware and requireRole RBAC middleware.
 * Uses a minimal test Express application — no production debugging endpoints.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { authenticate } from '../src/middleware/authenticate.js';
import { requireRole } from '../src/middleware/requireRole.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

// ── Mock User model ───────────────────────────────────────────────────────────

vi.mock('../src/modules/auth/user.model.js', () => ({
  User: {
    findById: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

const { User } = await import('../src/modules/auth/user.model.js');
const { env } = await import('../src/config/env.js');

// ── Test application factory ──────────────────────────────────────────────────

function makeTestApp(...roles: Parameters<typeof requireRole>) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());

  const middleware = roles.length > 0 ? [authenticate, requireRole(...roles)] : [authenticate];

  app.get('/test-protected', ...middleware, (req, res) => {
    res.json({ success: true, user: (req as express.Request).user });
  });

  app.use(errorHandler);
  return app;
}

function signToken(userId: string, options: jwt.SignOptions = {}) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
    ...options,
  });
}

const activeUser = {
  _id: { toString: () => '507f1f77bcf86cd799439011' },
  fullName: 'Test User',
  email: 'test@test.com',
  role: 'student' as const,
  accountStatus: 'active' as const,
};

// ── authenticate middleware ───────────────────────────────────────────────────

describe('authenticate middleware', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns 401 when no cookie is present', async () => {
    const app = makeTestApp();
    const res = await request(app).get('/test-protected');
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid JWT', async () => {
    const app = makeTestApp();
    const res = await request(app)
      .get('/test-protected')
      .set('Cookie', 'p11_auth_token=bad.token.here');
    expect(res.status).toBe(401);
  });

  it('returns 401 for expired JWT', async () => {
    const app = makeTestApp();
    const expiredToken = signToken('507f1f77bcf86cd799439011', { expiresIn: -1 });
    const res = await request(app)
      .get('/test-protected')
      .set('Cookie', `p11_auth_token=${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns 401 when user is not found in DB', async () => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as never);

    const app = makeTestApp();
    const token = signToken('507f1f77bcf86cd799439011');
    const res = await request(app).get('/test-protected').set('Cookie', `p11_auth_token=${token}`);
    expect(res.status).toBe(401);
  });

  it('returns 403 when account is disabled', async () => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue({ ...activeUser, accountStatus: 'disabled' }),
    } as never);

    const app = makeTestApp();
    const token = signToken('507f1f77bcf86cd799439011');
    const res = await request(app).get('/test-protected').set('Cookie', `p11_auth_token=${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_INACTIVE');
  });

  it('attaches req.user and returns 200 for valid session', async () => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(activeUser),
    } as never);

    const app = makeTestApp();
    const token = signToken('507f1f77bcf86cd799439011');
    const res = await request(app).get('/test-protected').set('Cookie', `p11_auth_token=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@test.com');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });
});

// ── requireRole middleware ────────────────────────────────────────────────────

describe('requireRole middleware', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns 403 when user has insufficient role (student vs admin)', async () => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue(activeUser), // student
    } as never);

    const app = makeTestApp('admin');
    const token = signToken('507f1f77bcf86cd799439011');
    const res = await request(app).get('/test-protected').set('Cookie', `p11_auth_token=${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('permits access when user has the correct role', async () => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue({ ...activeUser, role: 'admin' }),
    } as never);

    const app = makeTestApp('admin');
    const token = signToken('507f1f77bcf86cd799439011');
    const res = await request(app).get('/test-protected').set('Cookie', `p11_auth_token=${token}`);

    expect(res.status).toBe(200);
  });

  it('permits access when user has one of multiple allowed roles', async () => {
    vi.mocked(User.findById).mockReturnValue({
      select: vi.fn().mockResolvedValue({ ...activeUser, role: 'alumni_officer' }),
    } as never);

    const app = makeTestApp('admin', 'alumni_officer');
    const token = signToken('507f1f77bcf86cd799439011');
    const res = await request(app).get('/test-protected').set('Cookie', `p11_auth_token=${token}`);

    expect(res.status).toBe(200);
  });

  it('returns 401 (not 403) when no authentication is present', async () => {
    const app = makeTestApp('admin');
    const res = await request(app).get('/test-protected');
    expect(res.status).toBe(401);
  });
});
