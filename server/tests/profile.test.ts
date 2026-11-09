/**
 * server/tests/profile.test.ts
 * Integration tests for Student and Alumni Profiles (Phase 4).
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

vi.mock('../src/modules/profile/studentProfile.model.js', () => ({
  StudentProfile: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../src/modules/profile/alumniProfile.model.js', () => ({
  AlumniProfile: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../src/modules/verification/verification.model.js', () => ({
  AlumniVerification: {
    findOne: vi.fn(),
  },
}));

const { User } = await import('../src/modules/auth/user.model.js');
const { StudentProfile } = await import('../src/modules/profile/studentProfile.model.js');
const { AlumniProfile } = await import('../src/modules/profile/alumniProfile.model.js');
const { AlumniVerification } = await import('../src/modules/verification/verification.model.js');
const { env } = await import('../src/config/env.js');

// ── Helpers ──────────────────────────────────────────────────────────────────

function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

const mockStudentUser = {
  _id: { toString: () => '507f1f77bcf86cd799439012' },
  fullName: 'Alice Student',
  email: 'alice@student.com',
  role: 'student',
  accountStatus: 'active',
  createdAt: new Date('2024-01-01'),
};

const mockAlumniUser = {
  _id: { toString: () => '507f1f77bcf86cd799439011' },
  fullName: 'Priya Sharma',
  email: 'priya@alumni.com',
  role: 'alumni',
  accountStatus: 'active',
  createdAt: new Date('2024-01-01'),
};

function mockAuthUser(user: typeof mockStudentUser) {
  const chainable = {
    select: vi.fn().mockResolvedValue(user),
    then: (resolve: (v: typeof user) => void) => Promise.resolve(user).then(resolve),
    catch: (reject: (e: unknown) => void) => Promise.resolve(user).catch(reject),
  };
  vi.mocked(User.findById).mockReturnValue(chainable as never);
}

// ── Student Profile Tests ────────────────────────────────────────────────────

describe('Student Profile APIs — GET & PATCH /api/v1/profiles/me', () => {
  afterEach(() => vi.restoreAllMocks());

  it('allows a student to retrieve their profile and calculates completion', async () => {
    mockAuthUser(mockStudentUser);
    vi.mocked(StudentProfile.findOne).mockResolvedValue({
      _id: { toString: () => '607f1f77bcf86cd799439001' },
      programme: 'B.Tech Computer Science',
      department: 'Computer Science & Engineering',
      graduationYear: 2026,
      skills: ['TypeScript', 'React'],
      academicInterests: ['Distributed Systems'],
      careerInterests: ['Full-Stack Engineering'],
      careerGoals: 'To work as a software engineer at a cloud company.',
      bio: 'Enthusiastic CS student passionate about building scalable web apps.',
      preferredMentorshipTopics: ['Resume Review', 'Interview Prep'],
      preferredMentorshipMode: 'online',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const token = signToken(mockStudentUser._id.toString());
    const res = await request(app)
      .get('/api/v1/profiles/me')
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe('student');
    expect(res.body.data.profile.programme).toBe('B.Tech Computer Science');
    expect(res.body.data.profile.completionPercentage).toBe(100);
  });

  it('returns empty default profile with 0% completion if not yet created', async () => {
    mockAuthUser(mockStudentUser);
    vi.mocked(StudentProfile.findOne).mockResolvedValue(null);

    const token = signToken(mockStudentUser._id.toString());
    const res = await request(app)
      .get('/api/v1/profiles/me')
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.completionPercentage).toBe(0);
    expect(res.body.data.profile.programme).toBe('');
  });

  it('allows a student to update their profile', async () => {
    mockAuthUser(mockStudentUser);
    vi.mocked(StudentProfile.findOneAndUpdate).mockResolvedValue({
      _id: { toString: () => '607f1f77bcf86cd799439001' },
      programme: 'B.Tech IT',
      department: 'Information Technology',
      graduationYear: 2026,
      skills: ['Python'],
      academicInterests: ['AI'],
      careerInterests: ['Data Science'],
      careerGoals: 'Become a machine learning engineer.',
      bio: 'Focused on AI research.',
      preferredMentorshipTopics: ['Career Transition'],
      preferredMentorshipMode: 'hybrid',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const token = signToken(mockStudentUser._id.toString());
    const res = await request(app)
      .patch('/api/v1/profiles/me')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send({
        programme: 'B.Tech IT',
        department: 'Information Technology',
        skills: ['Python'],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.programme).toBe('B.Tech IT');
  });

  it('rejects invalid graduation year with 400 validation error', async () => {
    mockAuthUser(mockStudentUser);

    const token = signToken(mockStudentUser._id.toString());
    const res = await request(app)
      .patch('/api/v1/profiles/me')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send({
        graduationYear: 1940,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── Alumni Profile Tests ─────────────────────────────────────────────────────

describe('Alumni Professional Profile APIs', () => {
  afterEach(() => vi.restoreAllMocks());

  it('verified active alumni can create and publish a professional profile', async () => {
    mockAuthUser(mockAlumniUser);
    vi.mocked(AlumniVerification.findOne).mockResolvedValue({
      alumniId: 'ALU-2018-001',
      institutionalEmail: 'priya@alumni.univ.edu',
      programme: 'B.Tech CS',
      department: 'CSE',
      graduationYear: 2022,
      status: 'verified',
    } as never);

    vi.mocked(AlumniProfile.findOneAndUpdate).mockResolvedValue({
      _id: { toString: () => '607f1f77bcf86cd799439002' },
      headline: 'Senior Software Engineer at Google',
      currentDesignation: 'Senior Software Engineer',
      company: 'Google',
      industry: 'Technology',
      yearsOfExperience: 4,
      bio: 'Alumna mentoring students in distributed systems and cloud engineering.',
      skills: ['Go', 'Kubernetes'],
      areasOfExpertise: ['Distributed Systems'],
      mentorshipTopics: ['Career Transition', 'System Design'],
      languages: ['English'],
      preferredMentorshipMode: 'online',
      isPubliclyVisible: true,
      isDraft: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .patch('/api/v1/profiles/me')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send({
        headline: 'Senior Software Engineer at Google',
        company: 'Google',
        isDraft: false,
        isPubliclyVisible: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.profile.isVerified).toBe(true);
    expect(res.body.data.profile.headline).toBe('Senior Software Engineer at Google');
  });

  it('unverified alumni CANNOT publish a public profile (blocked by 403)', async () => {
    mockAuthUser(mockAlumniUser);
    vi.mocked(AlumniVerification.findOne).mockResolvedValue(null); // not verified

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .patch('/api/v1/profiles/me')
      .set('Cookie', [`p11_auth_token=${token}`])
      .send({
        headline: 'Software Engineer',
        isDraft: false,
        isPubliclyVisible: true,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('VERIFICATION_REQUIRED');
  });

  it('alumni can retrieve their own profile with verified institutional credentials attached', async () => {
    mockAuthUser(mockAlumniUser);
    vi.mocked(AlumniVerification.findOne).mockResolvedValue({
      alumniId: 'ALU-2018-001',
      institutionalEmail: 'priya@alumni.univ.edu',
      programme: 'B.Tech CS',
      department: 'CSE',
      graduationYear: 2022,
      status: 'verified',
    } as never);
    vi.mocked(AlumniProfile.findOne).mockResolvedValue({
      _id: { toString: () => '607f1f77bcf86cd799439002' },
      headline: 'Software Engineer',
      company: 'Google',
      isDraft: false,
      isPubliclyVisible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const token = signToken(mockAlumniUser._id.toString());
    const res = await request(app)
      .get('/api/v1/profiles/me')
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.alumniId).toBe('ALU-2018-001');
    expect(res.body.data.profile.programme).toBe('B.Tech CS');
    expect(res.body.data.profile.isVerified).toBe(true);
  });

  it('students can view a public verified alumni profile (GET /api/v1/profiles/alumni/:userId)', async () => {
    vi.mocked(User.findById).mockImplementation((id: any) => {
      const idStr = id?.toString();
      const userToReturn =
        idStr === mockStudentUser._id.toString() ? mockStudentUser : mockAlumniUser;
      const chainable = {
        select: vi.fn().mockResolvedValue(userToReturn),
        then: (resolve: (v: any) => void) => Promise.resolve(userToReturn).then(resolve),
        catch: (reject: (e: unknown) => void) => Promise.resolve(userToReturn).catch(reject),
      };
      return chainable as never;
    });

    vi.mocked(AlumniVerification.findOne).mockResolvedValueOnce({
      programme: 'B.Tech CS',
      department: 'CSE',
      graduationYear: 2022,
      status: 'verified',
    } as never);
    vi.mocked(AlumniProfile.findOne).mockResolvedValueOnce({
      _id: { toString: () => '607f1f77bcf86cd799439002' },
      headline: 'Senior SWE at Google',
      currentDesignation: 'Senior SWE',
      company: 'Google',
      industry: 'Technology',
      yearsOfExperience: 5,
      bio: 'Guiding students in systems engineering.',
      skills: ['Go', 'Kubernetes'],
      areasOfExpertise: ['Cloud'],
      mentorshipTopics: ['Career'],
      languages: ['English'],
      preferredMentorshipMode: 'online',
      isPubliclyVisible: true,
      isDraft: false,
    } as never);

    const token = signToken(mockStudentUser._id.toString());
    const res = await request(app)
      .get(`/api/v1/profiles/alumni/${mockAlumniUser._id.toString()}`)
      .set('Cookie', [`p11_auth_token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.data.profile.fullName).toBe('Priya Sharma');
    expect(res.body.data.profile.headline).toBe('Senior SWE at Google');
    expect(res.body.data.profile).not.toHaveProperty('email'); // personal email redacted
    expect(res.body.data.profile).not.toHaveProperty('passwordHash');
  });
});
