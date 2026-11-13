/**
 * matching.service.ts
 * Core domain service for the explainable mentor-student matching engine.
 * Retrieves student profile, performs batch eligibility joins, calculates scores, and ranks recommendations.
 */

import { StudentProfile } from '../profile/studentProfile.model.js';
import { AlumniProfile } from '../profile/alumniProfile.model.js';
import { MentorshipOffer } from '../mentorship/mentorshipOffer.model.js';
import { AlumniVerification } from '../verification/verification.model.js';
import { User } from '../auth/user.model.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  MATCHING_CRITERIA,
  TOTAL_WEIGHT,
  MIN_DATA_COVERAGE_THRESHOLD,
  MATCH_CATEGORIES,
} from './matching.config.js';
import {
  calculateMatchScore,
  type StudentMatchingInput,
  type MentorMatchingInput,
  type OfferingMatchingInput,
} from './matching.scoring.js';
import type {
  RecommendationDTO,
  PaginatedRecommendationsDTO,
  MatchingWeightsDTO,
  RecommendationQuery,
} from './matching.types.js';

/**
 * Escapes regex special characters for safe query filtering.
 */
function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export class MatchingService {
  /**
   * Retrieves active matching criteria, weights, and recommendation categories.
   */
  static getWeights(): MatchingWeightsDTO {
    return {
      criteria: Object.values(MATCHING_CRITERIA).map(c => ({
        key: c.key,
        label: c.label,
        weight: c.weight,
        description: c.description,
      })),
      totalWeight: TOTAL_WEIGHT,
      minCoverageThreshold: MIN_DATA_COVERAGE_THRESHOLD,
      categories: MATCH_CATEGORIES.map(cat => ({
        minScore: cat.minScore,
        category: cat.category,
      })),
    };
  }

  /**
   * Calculates and returns ranked personalized mentorship recommendations for the authenticated student.
   */
  static async getRecommendations(
    studentUserId: string,
    query: RecommendationQuery
  ): Promise<PaginatedRecommendationsDTO> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));

    // 1. Retrieve Student Profile
    const studentProfile = await StudentProfile.findOne({ userId: studentUserId }).lean();

    const studentInput: StudentMatchingInput = {
      programme: studentProfile?.programme || '',
      department: studentProfile?.department || '',
      academicInterests: studentProfile?.academicInterests || [],
      skills: studentProfile?.skills || [],
      careerInterests: studentProfile?.careerInterests || [],
      careerGoals: studentProfile?.careerGoals || '',
      preferredMentorshipTopics: studentProfile?.preferredMentorshipTopics || [],
      preferredMentorshipMode: studentProfile?.preferredMentorshipMode || 'online',
      languages: (studentProfile as any)?.languages || [],
    };

    // Check if student profile is empty/sparse
    const hasAnyStudentData = Boolean(
      studentInput.programme ||
      studentInput.department ||
      studentInput.skills?.length ||
      studentInput.careerInterests?.length ||
      studentInput.preferredMentorshipTopics?.length ||
      studentInput.careerGoals
    );

    // 2. Query Active & Non-Deleted Offerings
    const offerFilter: Record<string, any> = {
      status: 'active',
      isDeleted: false,
    };

    if (query.mode && query.mode !== 'all') {
      offerFilter.mode = query.mode;
    }

    if (query.topic && query.topic !== 'all') {
      offerFilter.topics = { $regex: escapeRegex(query.topic), $options: 'i' };
    }

    const candidateOffers = await MentorshipOffer.find(offerFilter).lean();

    if (candidateOffers.length === 0) {
      return {
        recommendations: [],
        studentCoverage: hasAnyStudentData ? 60 : 0,
        hasInsufficientData: !hasAnyStudentData,
        guidanceMessage: !hasAnyStudentData
          ? 'Complete your student profile with topics, skills, and career goals to receive personalized mentor recommendations.'
          : 'No eligible mentorship offerings currently match the selected criteria.',
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // 3. Batch Query Alumni Eligibility (Strict 4-layer check: Active User + Verified Status + Published Profile + Owner Match)
    const alumniUserIds = Array.from(new Set(candidateOffers.map(o => o.alumniId.toString())));

    const [activeUsers, verifiedRecords, publishedProfiles] = await Promise.all([
      User.find({
        _id: { $in: alumniUserIds },
        accountStatus: 'active',
        role: 'alumni',
      }).lean(),
      AlumniVerification.find({
        userId: { $in: alumniUserIds },
        status: 'verified',
      }).lean(),
      AlumniProfile.find({
        userId: { $in: alumniUserIds },
        isDraft: false,
        isPubliclyVisible: true,
      }).lean(),
    ]);

    const activeUserMap = new Map(activeUsers.map(u => [u._id.toString(), u]));
    const verifiedMap = new Map(verifiedRecords.map(v => [v.userId.toString(), v]));
    const profileMap = new Map(publishedProfiles.map(p => [p.userId.toString(), p]));

    // 4. Score and filter eligible recommendations
    const scoredRecommendations: RecommendationDTO[] = [];

    for (const offer of candidateOffers) {
      const alumniIdStr = offer.alumniId.toString();
      const user = activeUserMap.get(alumniIdStr);
      const verification = verifiedMap.get(alumniIdStr);
      const profile = profileMap.get(alumniIdStr);

      // Must satisfy all eligibility conditions
      if (!user || !verification || !profile) {
        continue;
      }

      // Optional industry filter on alumni profile
      if (
        query.industry &&
        query.industry !== 'all' &&
        profile.industry?.toLowerCase() !== query.industry.toLowerCase()
      ) {
        continue;
      }

      const mentorInput: MentorMatchingInput = {
        alumniId: alumniIdStr,
        headline: profile.headline || '',
        currentDesignation: profile.currentDesignation || '',
        company: profile.company || '',
        industry: profile.industry || '',
        skills: profile.skills || [],
        areasOfExpertise: profile.areasOfExpertise || [],
        mentorshipTopics: profile.mentorshipTopics || [],
        languages: profile.languages || ['English'],
        verifiedProgramme: verification.programme || '',
        verifiedDepartment: verification.department || '',
      };

      const offeringInput: OfferingMatchingInput = {
        offerId: offer._id.toString(),
        title: offer.title,
        description: offer.description,
        topics: offer.topics,
        mode: offer.mode,
      };

      const matchResult = calculateMatchScore(studentInput, mentorInput, offeringInput);

      scoredRecommendations.push({
        offerId: offer._id.toString(),
        compatibilityScore: matchResult.compatibilityScore,
        dataCoverage: matchResult.dataCoverage,
        matchCategory: matchResult.matchCategory,
        hasInsufficientData: matchResult.hasInsufficientData,
        offering: {
          id: offer._id.toString(),
          title: offer.title,
          description: offer.description,
          topics: offer.topics,
          targetAudience: offer.targetAudience,
          mode: offer.mode,
          sessionDurationMinutes: offer.sessionDurationMinutes,
          maxMenteesCapacity: offer.maxMenteesCapacity,
        },
        mentor: {
          userId: user._id.toString(),
          name: user.fullName,
          headline: profile.headline || '',
          company: profile.company || '',
          industry: profile.industry || '',
          currentDesignation: profile.currentDesignation || '',
          yearsOfExperience: profile.yearsOfExperience || 0,
          verifiedProgramme: verification.programme || '',
          verifiedDepartment: verification.department || '',
        },
        explanation: matchResult.explanation,
        breakdown: matchResult.breakdown,
      });
    }

    // 5. Deterministic Ranking
    // - Highest compatibility score desc
    // - Higher data coverage desc
    // - Topic alignment score desc
    // - OfferId asc (stable tie-breaker)
    scoredRecommendations.sort((a, b) => {
      if (b.compatibilityScore !== a.compatibilityScore) {
        return b.compatibilityScore - a.compatibilityScore;
      }
      if (b.dataCoverage !== a.dataCoverage) {
        return b.dataCoverage - a.dataCoverage;
      }
      const aTopicScore = a.breakdown.find(c => c.criterionKey === 'topicAlignment')?.score || 0;
      const bTopicScore = b.breakdown.find(c => c.criterionKey === 'topicAlignment')?.score || 0;
      if (bTopicScore !== aTopicScore) {
        return bTopicScore - aTopicScore;
      }
      return a.offerId.localeCompare(b.offerId);
    });

    // 6. Pagination
    const total = scoredRecommendations.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedItems = scoredRecommendations.slice((page - 1) * limit, page * limit);

    const averageCoverage =
      scoredRecommendations.length > 0
        ? Math.round(
            scoredRecommendations.reduce((sum, r) => sum + r.dataCoverage, 0) /
              scoredRecommendations.length
          )
        : hasAnyStudentData
          ? 60
          : 0;

    let guidanceMessage: string | undefined;
    if (!hasAnyStudentData || averageCoverage < MIN_DATA_COVERAGE_THRESHOLD) {
      guidanceMessage =
        'Your profile has limited academic or career information. Complete more details in your profile to unlock higher-accuracy recommendations.';
    }

    return {
      recommendations: paginatedItems,
      studentCoverage: averageCoverage,
      hasInsufficientData: averageCoverage < MIN_DATA_COVERAGE_THRESHOLD,
      guidanceMessage,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves detailed match breakdown for a specific offering for the authenticated student.
   */
  static async getRecommendationByOfferId(
    studentUserId: string,
    offerId: string
  ): Promise<RecommendationDTO> {
    const studentProfile = await StudentProfile.findOne({ userId: studentUserId }).lean();

    const studentInput: StudentMatchingInput = {
      programme: studentProfile?.programme || '',
      department: studentProfile?.department || '',
      academicInterests: studentProfile?.academicInterests || [],
      skills: studentProfile?.skills || [],
      careerInterests: studentProfile?.careerInterests || [],
      careerGoals: studentProfile?.careerGoals || '',
      preferredMentorshipTopics: studentProfile?.preferredMentorshipTopics || [],
      preferredMentorshipMode: studentProfile?.preferredMentorshipMode || 'online',
      languages: (studentProfile as any)?.languages || [],
    };

    const offer = await MentorshipOffer.findOne({
      _id: offerId,
      status: 'active',
      isDeleted: false,
    }).lean();

    if (!offer) {
      throw new AppError('Mentorship offering not found or is no longer active.', 404);
    }

    const alumniIdStr = offer.alumniId.toString();

    const [user, verification, profile] = await Promise.all([
      User.findOne({
        _id: alumniIdStr,
        accountStatus: 'active',
        role: 'alumni',
      }).lean(),
      AlumniVerification.findOne({
        userId: alumniIdStr,
        status: 'verified',
      }).lean(),
      AlumniProfile.findOne({
        userId: alumniIdStr,
        isDraft: false,
        isPubliclyVisible: true,
      }).lean(),
    ]);

    if (!user || !verification || !profile) {
      throw new AppError('The mentor offering this mentorship is currently unavailable.', 404);
    }

    const mentorInput: MentorMatchingInput = {
      alumniId: alumniIdStr,
      headline: profile.headline || '',
      currentDesignation: profile.currentDesignation || '',
      company: profile.company || '',
      industry: profile.industry || '',
      skills: profile.skills || [],
      areasOfExpertise: profile.areasOfExpertise || [],
      mentorshipTopics: profile.mentorshipTopics || [],
      languages: profile.languages || ['English'],
      verifiedProgramme: verification.programme || '',
      verifiedDepartment: verification.department || '',
    };

    const offeringInput: OfferingMatchingInput = {
      offerId: offer._id.toString(),
      title: offer.title,
      description: offer.description,
      topics: offer.topics,
      mode: offer.mode,
    };

    const matchResult = calculateMatchScore(studentInput, mentorInput, offeringInput);

    return {
      offerId: offer._id.toString(),
      compatibilityScore: matchResult.compatibilityScore,
      dataCoverage: matchResult.dataCoverage,
      matchCategory: matchResult.matchCategory,
      hasInsufficientData: matchResult.hasInsufficientData,
      offering: {
        id: offer._id.toString(),
        title: offer.title,
        description: offer.description,
        topics: offer.topics,
        targetAudience: offer.targetAudience,
        mode: offer.mode,
        sessionDurationMinutes: offer.sessionDurationMinutes,
        maxMenteesCapacity: offer.maxMenteesCapacity,
      },
      mentor: {
        userId: user._id.toString(),
        name: user.fullName,
        headline: profile.headline || '',
        company: profile.company || '',
        industry: profile.industry || '',
        currentDesignation: profile.currentDesignation || '',
        yearsOfExperience: profile.yearsOfExperience || 0,
        verifiedProgramme: verification.programme || '',
        verifiedDepartment: verification.department || '',
      },
      explanation: matchResult.explanation,
      breakdown: matchResult.breakdown,
    };
  }
}
