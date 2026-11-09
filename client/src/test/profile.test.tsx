import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ProfilePage from '../app/profile/page';
import * as AuthContextModule from '@/contexts/AuthContext';
import * as ApiModule from '@/lib/api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api', async importOriginal => {
  const actual = await importOriginal<typeof ApiModule>();
  return {
    ...actual,
    apiGetMyProfile: vi.fn(),
    apiUpdateMyProfile: vi.fn(),
  };
});

describe('ProfilePage Component Test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders student profile editor with completion percentage for student users', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: {
        id: 'user-stud-1',
        email: 'student@example.edu',
        fullName: 'Jane Student',
        role: 'student',
        accountStatus: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    vi.mocked(ApiModule.apiGetMyProfile).mockResolvedValue({
      role: 'student',
      profile: {
        _id: 'prof-stud-1',
        userId: 'user-stud-1',
        programme: 'B.Tech Computer Science',
        department: 'School of Computing',
        graduationYear: 2027,
        academicInterests: ['Distributed Systems', 'Algorithms'],
        skills: ['TypeScript', 'Node.js'],
        careerInterests: ['Backend Engineering'],
        careerGoals: 'Become a lead distributed systems architect.',
        preferredMentorshipTopics: ['System Design', 'Code Reviews'],
        preferredMentorshipMode: 'online',
        shortBio: 'Enthusiastic CS student eager to learn distributed systems.',
        completionPercentage: 80,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Profile Management')).toBeInTheDocument();
      expect(screen.getByText('Academic Information')).toBeInTheDocument();
      expect(screen.getByDisplayValue('B.Tech Computer Science')).toBeInTheDocument();
      expect(screen.getByDisplayValue('School of Computing')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });
  });

  it('renders alumni professional profile editor for alumni users', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: {
        id: 'user-alum-1',
        email: 'alumnus@alumni.edu',
        fullName: 'John Alum',
        role: 'alumni',
        accountStatus: 'active',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    vi.mocked(ApiModule.apiGetMyProfile).mockResolvedValue({
      role: 'alumni',
      profile: {
        _id: 'prof-alum-1',
        userId: 'user-alum-1',
        headline: 'Staff Software Architect at Acme Tech',
        currentDesignation: 'Staff Software Architect',
        company: 'Acme Tech',
        industry: 'Cloud Computing & Distributed Systems',
        yearsOfExperience: 8,
        bio: '8+ years designing high scale microservices.',
        skills: ['Distributed Systems', 'Go', 'Kubernetes'],
        areasOfExpertise: ['System Architecture', 'Cloud Infrastructure'],
        mentorshipTopics: ['Architecture Review', 'Career Growth'],
        preferredMentorshipMode: 'hybrid',
        isDraft: false,
        isPubliclyVisible: true,
        completionPercentage: 100,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    render(<ProfilePage />);

    await waitFor(() => {
      expect(screen.getByText('Profile Management')).toBeInTheDocument();
      expect(screen.getByText('Professional Identity')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Staff Software Architect at Acme Tech')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Acme Tech')).toBeInTheDocument();
      expect(screen.getByText(/Verified Institutional Credentials/i)).toBeInTheDocument();
    });
  });
});
