/**
 * server/tests/matchingApi.test.ts
 * Integration tests for the Explainable Matching Engine API (Phase 5).
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
    findOne: vi.fn(),
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

vi.mock('../src/modules/profile/studentProfile.model.js', () => ({
  StudentProfile: {
    findOne: vi.fn(),
  },
}));

vi.mock('../src/modules/mentorship/mentorshipOffer.model.js', () => ({
  MentorshipOffer: {
    find: vi.fn(),
    findOne: vi.fn(),
  },
}));

const { User } = await import('../src/modules/auth/user.model.js');
const { AlumniVerification } = await import('../src/modules/verification/verification.model.js');
const { AlumniProfile } = await import('../src/modules/profile/alumniProfile.model.js');
const { StudentProfile } = await import('../src/modules/profile/studentProfile.model.js');
const { MentorshipOffer } = await import('../src/modules/mentorship/mentorshipOffer.model.js');
const { env } = await import('../src/config/env.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

const mockStudentUser = {
  _id: { toString: () => '507f1f77bcf86cd799439001' },
  fullName: 'Aarav Patel',
  email: 'aarav@student.edu',
  role: 'student',
  accountStatus: 'active',
};

const mockAlumniUser = {
  _id: { toString: () => '507f1f77bcf86cd799439002' },
  fullName: 'Priya Sharma',
  email: 'priya@alumni.edu',
  role: 'alumni',
  accountStatus: 'active',
};

function mockAuthUser(user: typeof mockStudentUser) {
  const chainable = {
    select: vi.fn().mockResolvedValue(user),
    then: (resolve: (v: typeof user) => void) => Promise.resolve(user).then(resolve),
    catch: (reject: (e: unknown) => void) => Promise.resolve(user).catch(reject),
  };
  vi.mocked(User.findById).mockReturnValue(chainable as never);
}

const mockStudentProfile = {
  _id: { toString: () => '507f1f77bcf86cd799439010' },
  userId: mockStudentUser._id,
  programme: 'B.Tech Computer Science',
  department: 'School of Computing',
  graduationYear: 2026,
  academicInterests: ['Distributed Systems', 'Algorithms'],
  skills: ['TypeScript', 'Node.js', 'React'],
  careerInterests: ['Backend Development', 'Cloud Computing'],
  careerGoals: 'Build high-scale distributed backend systems in cloud infrastructure.',
  preferredMentorshipTopics: ['System Design', 'Code Reviews'],
  preferredMentorshipMode: 'online',
  languages: ['English'],
};

const mockEligibleAlumniProfile = {
  _id: { toString: () => '507f1f77bcf86cd799439020' },
  userId: mockAlumniUser._id,
  headline: 'Staff Software Architect at CloudTech',
  currentDesignation: 'Staff Software Architect',
  company: 'CloudTech',
  industry: 'Cloud Computing',
  yearsOfExperience: 8,
  bio: '8+ years designing resilient backend architectures.',
  skills: ['TypeScript', 'Node.js', 'Kubernetes'],
  areasOfExpertise: ['System Design', 'Distributed Systems'],
  mentorshipTopics: ['System Design', 'Code Reviews', 'Career Growth'],
  languages: ['English', 'Hindi'],
  preferredMentorshipMode: 'online',
  isDraft: false,
  isPubliclyVisible: true,
};

const mockVerifiedRecord = {
  _id: { toString: () => '507f1f77bcf86cd799439030' },
  userId: mockAlumniUser._id,
  alumniId: 'ALUM-2018-001',
  programme: 'B.Tech Computer Science',
  department: 'School of Computing',
  graduationYear: 2018,
  status: 'verified',
};

const mockOffer = {
  _id: { toString: () => '507f1f77bcf86cd799439040' },
  alumniId: mockAlumniUser._id,
  title: 'Backend Engineering & System Design Guidance',
  description: '1-on-1 mentorship on distributed microservices and cloud system design.',
  topics: ['System Design', 'Code Reviews', 'Backend Development'],
  targetAudience: 'Undergraduate computer science students',
  mode: 'online',
  sessionDurationMinutes: 45,
  maxMenteesCapacity: 5,
  status: 'active',
  isDeleted: false,
};

describe('Explainable Matching Engine API', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/matching/weights', () => {
    it('returns configured matching criteria, weights summing to 100, and categories', async () => {
      const res = await request(app).get('/api/v1/matching/weights');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalWeight).toBe(100);
      expect(res.body.data.criteria).toHaveLength(6);
      expect(res.body.data.categories).toBeDefined();
    });
  });

  describe('GET /api/v1/matching/recommendations', () => {
    it('returns 401 when no auth cookie is provided', async () => {
      const res = await request(app).get('/api/v1/matching/recommendations');
      expect(res.status).toBe(401);
    });

    it('returns 403 when an alumni user tries to access student recommendations', async () => {
      mockAuthUser(mockAlumniUser);
      const token = signToken(mockAlumniUser._id.toString());

      const res = await request(app)
        .get('/api/v1/matching/recommendations')
        .set('Cookie', [`${env.COOKIE_NAME}=${token}`]);

      expect(res.status).toBe(403);
    });

    it('returns ranked recommendations with compatibility score, coverage, and breakdown for student', async () => {
      mockAuthUser(mockStudentUser);
      const token = signToken(mockStudentUser._id.toString());

      vi.mocked(StudentProfile.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockStudentProfile),
      } as never);

      vi.mocked(MentorshipOffer.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockOffer]),
      } as never);

      vi.mocked(User.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockAlumniUser]),
      } as never);

      vi.mocked(AlumniVerification.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockVerifiedRecord]),
      } as never);

      vi.mocked(AlumniProfile.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockEligibleAlumniProfile]),
      } as never);

      const res = await request(app)
        .get('/api/v1/matching/recommendations')
        .set('Cookie', [`${env.COOKIE_NAME}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recommendations).toHaveLength(1);

      const rec = res.body.data.recommendations[0];
      expect(rec.offerId).toBe(mockOffer._id.toString());
      expect(rec.compatibilityScore).toBeGreaterThanOrEqual(80);
      expect(rec.matchCategory).toBe('Strong Match');
      expect(rec.dataCoverage).toBe(100);
      expect(rec.breakdown).toHaveLength(6);
      expect(rec.mentor.name).toBe('Priya Sharma');
      expect(rec.mentor.company).toBe('CloudTech');
      expect(rec.offering.title).toBe(mockOffer.title);
    });

    it('filters out ineligible offerings (e.g. unverified alumni, unpublished profile, inactive user)', async () => {
      mockAuthUser(mockStudentUser);
      const token = signToken(mockStudentUser._id.toString());

      vi.mocked(StudentProfile.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockStudentProfile),
      } as never);

      vi.mocked(MentorshipOffer.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockOffer]),
      } as never);

      // AlumniVerification is empty (unverified alumnus)
      vi.mocked(User.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockAlumniUser]),
      } as never);
      vi.mocked(AlumniVerification.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      } as never);
      vi.mocked(AlumniProfile.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([mockEligibleAlumniProfile]),
      } as never);

      const res = await request(app)
        .get('/api/v1/matching/recommendations')
        .set('Cookie', [`${env.COOKIE_NAME}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.recommendations).toHaveLength(0);
    });

    it('returns guidance message when student has insufficient profile data', async () => {
      mockAuthUser(mockStudentUser);
      const token = signToken(mockStudentUser._id.toString());

      // Student has no profile details saved
      vi.mocked(StudentProfile.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      vi.mocked(MentorshipOffer.find).mockReturnValue({
        lean: vi.fn().mockResolvedValue([]),
      } as never);

      const res = await request(app)
        .get('/api/v1/matching/recommendations')
        .set('Cookie', [`${env.COOKIE_NAME}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.data.hasInsufficientData).toBe(true);
      expect(res.body.data.guidanceMessage).toBeDefined();
    });
  });

  describe('GET /api/v1/matching/recommendations/:offerId', () => {
    it('returns detailed recommendation breakdown for a single eligible offering', async () => {
      mockAuthUser(mockStudentUser);
      const token = signToken(mockStudentUser._id.toString());

      vi.mocked(StudentProfile.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockStudentProfile),
      } as never);

      vi.mocked(MentorshipOffer.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockOffer),
      } as never);

      vi.mocked(User.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockAlumniUser),
      } as never);

      vi.mocked(AlumniVerification.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockVerifiedRecord),
      } as never);

      vi.mocked(AlumniProfile.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockEligibleAlumniProfile),
      } as never);

      const res = await request(app)
        .get(`/api/v1/matching/recommendations/${mockOffer._id.toString()}`)
        .set('Cookie', [`${env.COOKIE_NAME}=${token}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recommendation.offerId).toBe(mockOffer._id.toString());
      expect(res.body.data.recommendation.explanation.summary).toBeDefined();
      expect(res.body.data.recommendation.breakdown).toHaveLength(6);
    });

    it('returns 404 if the offering is not found or is inactive', async () => {
      mockAuthUser(mockStudentUser);
      const token = signToken(mockStudentUser._id.toString());

      vi.mocked(StudentProfile.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockStudentProfile),
      } as never);

      vi.mocked(MentorshipOffer.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      } as never);

      const res = await request(app)
        .get(`/api/v1/matching/recommendations/${mockOffer._id.toString()}`)
        .set('Cookie', [`${env.COOKIE_NAME}=${token}`]);

      expect(res.status).toBe(404);
    });

    it('returns 400 when offering ID has an invalid format', async () => {
      mockAuthUser(mockStudentUser);
      const token = signToken(mockStudentUser._id.toString());

      const res = await request(app)
        .get('/api/v1/matching/recommendations/invalid-id-123')
        .set('Cookie', [`${env.COOKIE_NAME}=${token}`]);

      expect(res.status).toBe(400);
    });
  });
});

