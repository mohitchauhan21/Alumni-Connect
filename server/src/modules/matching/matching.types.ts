/**
 * matching.types.ts
 * Type definitions and DTOs for the Explainable Matching Engine.
 */

import type { CriterionEvaluation, RecommendationExplanation } from './matching.scoring.js';
import type { MatchCategory } from './matching.config.js';

export interface RecommendationMentorDTO {
  userId: string;
  name: string;
  headline: string;
  company: string;
  industry: string;
  currentDesignation: string;
  yearsOfExperience: number;
  verifiedProgramme?: string;
  verifiedDepartment?: string;
}

export interface RecommendationOfferingDTO {
  id: string;
  title: string;
  description: string;
  topics: string[];
  targetAudience: string;
  mode: string;
  sessionDurationMinutes: number;
  maxMenteesCapacity: number;
}

export interface RecommendationDTO {
  offerId: string;
  compatibilityScore: number;
  dataCoverage: number;
  matchCategory: MatchCategory;
  hasInsufficientData: boolean;
  offering: RecommendationOfferingDTO;
  mentor: RecommendationMentorDTO;
  explanation: RecommendationExplanation;
  breakdown: CriterionEvaluation[];
}

export interface PaginatedRecommendationsDTO {
  recommendations: RecommendationDTO[];
  studentCoverage: number;
  hasInsufficientData: boolean;
  guidanceMessage?: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MatchingWeightsDTO {
  criteria: Array<{
    key: string;
    label: string;
    weight: number;
    description: string;
  }>;
  totalWeight: number;
  minCoverageThreshold: number;
  categories: Array<{
    minScore: number;
    category: string;
  }>;
}

export interface RecommendationQuery {
  page?: number;
  limit?: number;
  mode?: string;
  industry?: string;
  topic?: string;
}

