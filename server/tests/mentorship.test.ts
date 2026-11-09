/**
 * server/tests/mentorship.test.ts
 * Integration tests for Mentorship Offering Management and Discovery (Phase 4).
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
  },
}));

vi.mock('../src/modules/profile/alumniProfile.model.js', () => ({
  AlumniProfile: {
    findOne: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('../src/modules/mentorship/mentorshipOffer.model.js', () => ({
  MentorshipOffer: {
    create: vi.fn(),
    find: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

const { User } = await import('../src/modules/auth/user.model.js');
const { AlumniVerification } = await import('../src/modules/verification/verification.model.js');
const { AlumniProfile } = await import('../src/modules/profile/alumniProfile.model.js');
const { MentorshipOffer } = await import('../src/modules/mentorship/mentorshipOffer.model.js');
const { env } = await import('../src/config/env.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

const mockAlumniUser = {
  _id: { toString: () => '507f1f77bcf86cd799439011' },
  fullName: 'Priya Sharma',
  email: 'priya@alumni.com',
  role: 'alumni',
  accountStatus: 'active',
};

const mockOtherAlumniUser = {
  _id: { toString: () => '507f1f77bcf86cd799439099' },
  fullName: 'Other Alum',
  email: 'other@alumni.com',
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

function mockAuthUser(user: typeof mockAlumniUser) {
  const chainable = {
    select: vi.fn().mockResolvedValue(user),
    then: (resolve: (v: typeof user) => void) => Promise.resolve(user).then(resolve),
    catch: (reject: (e: unknown) => void) => Promise.resolve(user).catch(reject),
  };
  vi.mocked(User.findById).mockReturnValue(chainable as never);
}

const VALID_OFFER_INPUT = {
  title: 'Full-Stack Web Development Career Guidance',
  description:
    'Comprehensive 1-on-1 mentorship for full stack web development, covering modern TypeScript, React, and Node.js architectures.',
  topics: ['Web Development', 'TypeScript', 'System Design'],
  targetAudience: 'Undergraduate computer science and IT students',
  mode: 'online',
  sessionDurationMinutes: 45,
  maxMenteesCapacity: 5,
  status: 'active',
};

// ── Mentorship Offering Management Tests ──────────────────────────────────────

describe('Mentorship Offering Management APIs', () => {
  afterEach(() => vi.restoreAllMocks());

  it('verified active alumni can create a mentorship offering', async () => {
    mockAuthUser(mockAlumniUser);
    vi.mocked(AlumniVerification.findOne).mockResolvedValue({ status: 'verified' } as never);
    vi.mocked(MentorshipOffer.create).mockResolvedValue({
      _id: { toString: () => '707f1f77bcf86cd799439001' },
      alumniId: mockAlumniUser._id,
      title: VALID_OFFER_INPUT.title,
      description: VALID_OFFER_INPUT.description,
      topics: VALID_OFFER_INPUT.topics,
      targetAudience: VALID_OFFER_INPUT.targetAudience,
      mode: VALID_OFFER_INPUT.mode,
      sessionDurationMinutes: VALID_OFFER_INPUT.sessionDurationMinutes,
      maxMenteesCapacity: VALID_OFFER_INPUT.maxMenteesCapacity,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .post('/api/v1/mentorship/offers')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send(VALID_OFFER_INPUT);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.offer.title).toBe(VALID_OFFER_INPUT.title);
  });

  it('unverified alumni CANNOT create a mentorship offering (403)', async () => {
    mockAuthUser(mockAlumniUser);
    vi.mocked(AlumniVerification.findOne).mockResolvedValue(null); // unverified

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .post('/api/v1/mentorship/offers')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send(VALID_OFFER_INPUT);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('VERIFICATION_REQUIRED');
  });

  it('students CANNOT create a mentorship offering (403)', async () => {
    mockAuthUser(mockStudentUser);

    const token = signToken(mockStudentUser._id.toString());
    const res = await request(app)
      .post('/api/v1/mentorship/offers')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send(VALID_OFFER_INPUT);

    expect(res.status).toBe(403);
  });

  it('rejects short descriptions with 400 validation error', async () => {
    mockAuthUser(mockAlumniUser);

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .post('/api/v1/mentorship/offers')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send({
        ...VALID_OFFER_INPUT,
        description: 'Too short',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('alumni can retrieve their own offerings via /api/v1/mentorship/offers/mine', async () => {
    mockAuthUser(mockAlumniUser);

    const mockSort = vi.fn().mockResolvedValue([
      {
        _id: { toString: () => '707f1f77bcf86cd799439001' },
        alumniId: mockAlumniUser._id,
        title: VALID_OFFER_INPUT.title,
        description: VALID_OFFER_INPUT.description,
        topics: VALID_OFFER_INPUT.topics,
        targetAudience: VALID_OFFER_INPUT.targetAudience,
        mode: 'online',
        sessionDurationMinutes: 45,
        maxMenteesCapacity: 5,
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    vi.mocked(MentorshipOffer.find).mockReturnValue({ sort: mockSort } as never);

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .get('/api/v1/mentorship/offers/mine')
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.offers).toHaveLength(1);
    expect(res.body.data.offers[0].title).toBe(VALID_OFFER_INPUT.title);
  });

  it('alumni CANNOT edit another alumnus offering (403 forbidden)', async () => {
    mockAuthUser(mockAlumniUser);
    vi.mocked(MentorshipOffer.findOne).mockResolvedValue({
      _id: { toString: () => '707f1f77bcf86cd799439001' },
      alumniId: mockOtherAlumniUser._id, // different owner!
      title: 'Original Title',
    } as never);

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .patch('/api/v1/mentorship/offers/707f1f77bcf86cd799439001')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send({ title: 'Hacked Title' });

    expect(res.status).toBe(403);
  });

  it('alumni can soft delete their own offering', async () => {
    mockAuthUser(mockAlumniUser);
    const mockOfferDoc = {
      _id: { toString: () => '707f1f77bcf86cd799439001' },
      alumniId: mockAlumniUser._id,
      isDeleted: false,
      status: 'active',
      save: vi.fn().mockResolvedValue(true),
    };
    vi.mocked(MentorshipOffer.findOne).mockResolvedValue(mockOfferDoc as never);

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .delete('/api/v1/mentorship/offers/707f1f77bcf86cd799439001')
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(mockOfferDoc.isDeleted).toBe(true);
    expect(mockOfferDoc.status).toBe('inactive');
    expect(mockOfferDoc.save).toHaveBeenCalled();
  });
});

// ── Mentorship Discovery Tests ────────────────────────────────────────────────

describe('Mentorship Discovery APIs — GET /api/v1/mentorship/offers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('students can browse active eligible offerings with search and pagination', async () => {
    mockAuthUser(mockStudentUser);

    // Mock eligible verified alumni
    const mockChainVerified = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([{ userId: mockAlumniUser._id }]),
    };
    vi.mocked(AlumniVerification.find).mockReturnValue(mockChainVerified as never);

    const mockChainUsers = {
      select: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([mockAlumniUser]),
    };
    vi.mocked(User.find).mockReturnValue(mockChainUsers as never);

    const mockChainProfiles = {
      lean: vi.fn().mockResolvedValue([
        {
          _id: { toString: () => '607f1f77bcf86cd799439002' },
          userId: mockAlumniUser._id,
          headline: 'Senior Software Engineer',
          company: 'Google',
          industry: 'Technology',
          isPubliclyVisible: true,
          isDraft: false,
        },
      ]),
    };
    vi.mocked(AlumniProfile.find).mockReturnValue(mockChainProfiles as never);

    const mockChainOffers = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([
        {
          _id: { toString: () => '707f1f77bcf86cd799439001' },
          alumniId: mockAlumniUser._id,
          title: VALID_OFFER_INPUT.title,
          description: VALID_OFFER_INPUT.description,
          topics: VALID_OFFER_INPUT.topics,
          targetAudience: VALID_OFFER_INPUT.targetAudience,
          mode: 'online',
          sessionDurationMinutes: 45,
          maxMenteesCapacity: 5,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    };
    vi.mocked(MentorshipOffer.find).mockReturnValue(mockChainOffers as never);
    vi.mocked(MentorshipOffer.countDocuments).mockResolvedValue(1);

    const token = signToken(mockStudentUser._id.toString());
    const res = await request(app)
      .get('/api/v1/mentorship/offers?page=1&limit=9&search=TypeScript')
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.items[0].alumni.fullName).toBe('Priya Sharma');
  });
});
