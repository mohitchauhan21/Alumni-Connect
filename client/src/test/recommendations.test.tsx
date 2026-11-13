import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import RecommendationsPage from '../app/mentorship/recommendations/page';
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
    apiGetRecommendations: vi.fn(),
    apiGetMatchingWeights: vi.fn(),
  };
});

describe('RecommendationsPage Component Test', () => {
  const mockStudentUser = {
    id: 'user-stud-10',
    email: 'student@example.edu',
    fullName: 'Jane Student',
    role: 'student' as const,
    accountStatus: 'active' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const mockRecommendation: ApiModule.RecommendationDTO = {
    offerId: 'offer-100',
    compatibilityScore: 88,
    dataCoverage: 95,
    matchCategory: 'Strong Match',
    hasInsufficientData: false,
    offering: {
      id: 'offer-100',
      title: 'Cloud Architecture & Distributed Systems',
      description: 'Comprehensive 1-on-1 mentorship on high scale microservices.',
      topics: ['System Design', 'Cloud Architecture', 'Node.js'],
      targetAudience: 'Computer Science undergraduates',
      mode: 'online',
      sessionDurationMinutes: 45,
      maxMenteesCapacity: 5,
    },
    mentor: {
      userId: 'alumni-100',
      name: 'Rohan Verma',
      headline: 'Principal Architect at GlobalCloud',
      company: 'GlobalCloud',
      industry: 'Cloud Computing',
      currentDesignation: 'Principal Architect',
      yearsOfExperience: 9,
      verifiedProgramme: 'B.Tech Computer Science',
      verifiedDepartment: 'School of Computing',
    },
    explanation: {
      summary: 'Strong match driven by shared system architecture topics and skills.',
      strengths: ['Topic alignment: 100%', 'Skills alignment: 100%'],
      gaps: [],
    },
    breakdown: [
      {
        criterionKey: 'topicAlignment',
        criterionLabel: 'Topic & Career Interest Alignment',
        weight: 30,
        score: 1.0,
        weightedContribution: 30,
        assessable: true,
        matchedValues: ['System Design', 'Cloud Architecture'],
        unmatchedStudentValues: [],
        explanation: 'All student topics matched.',
      },
      {
        criterionKey: 'skillsAlignment',
        criterionLabel: 'Skills & Expertise Alignment',
        weight: 25,
        score: 1.0,
        weightedContribution: 25,
        assessable: true,
        matchedValues: ['Node.js'],
        unmatchedStudentValues: [],
        explanation: 'Skills matched.',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders recommendation cards with score badge, mentor info, and allows expanding breakdown', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: mockStudentUser,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    vi.mocked(ApiModule.apiGetMatchingWeights).mockResolvedValue({
      criteria: [
        { key: 'topicAlignment', label: 'Topic Alignment', weight: 30, description: 'Topics' },
      ],
      totalWeight: 100,
      minCoverageThreshold: 40,
      categories: [{ minScore: 80, category: 'Strong Match' }],
    });

    vi.mocked(ApiModule.apiGetRecommendations).mockResolvedValue({
      recommendations: [mockRecommendation],
      studentCoverage: 95,
      hasInsufficientData: false,
      pagination: {
        page: 1,
        limit: 9,
        total: 1,
        totalPages: 1,
      },
    });

    render(<RecommendationsPage />);

    expect(screen.getByText('Recommended Mentors')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('88%')).toBeInTheDocument();
      expect(screen.getByText('Strong Match')).toBeInTheDocument();
      expect(screen.getByText('Rohan Verma')).toBeInTheDocument();
      expect(screen.getByText('Cloud Architecture & Distributed Systems')).toBeInTheDocument();
      expect(screen.getByText(/Profile Evidence: 95%/i)).toBeInTheDocument();
    });

    // Expand "Why this mentor matches you"
    const expandButton = screen.getByText('Why this mentor matches you');
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('6-Criteria Evidence Breakdown')).toBeInTheDocument();
      expect(screen.getByText(/All student topics matched/i)).toBeInTheDocument();
    });
  });

  it('renders insufficient data warning when student profile coverage is low', async () => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      user: mockStudentUser,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    vi.mocked(ApiModule.apiGetMatchingWeights).mockResolvedValue({
      criteria: [],
      totalWeight: 100,
      minCoverageThreshold: 40,
      categories: [],
    });

    vi.mocked(ApiModule.apiGetRecommendations).mockResolvedValue({
      recommendations: [],
      studentCoverage: 20,
      hasInsufficientData: true,
      guidanceMessage: 'Complete your profile to receive higher confidence recommendations.',
      pagination: {
        page: 1,
        limit: 9,
        total: 0,
        totalPages: 0,
      },
    });

    render(<RecommendationsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Incomplete Profile Evidence/i)).toBeInTheDocument();
      expect(
        screen.getAllByText(/Complete your profile to receive higher confidence recommendations/i)
          .length
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
