/**
 * matching.config.ts
 * Centralized configuration module for the explainable mentor-student matching engine.
 * Defines weights, compatibility matrices, recommendation thresholds, and coverage requirements.
 */

export interface CriterionConfig {
  key: string;
  label: string;
  weight: number; // Percentage out of 100
  description: string;
}

export const MATCHING_CRITERIA: Record<string, CriterionConfig> = {
  topicAlignment: {
    key: 'topicAlignment',
    label: 'Mentorship Topic & Career Interest Alignment',
    weight: 30,
    description: 'Alignment between student topics/interests and offering topics/mentor expertise',
  },
  skillsAlignment: {
    key: 'skillsAlignment',
    label: 'Skills & Expertise Alignment',
    weight: 25,
    description: 'Alignment between student technical/soft skills and mentor expertise',
  },
  careerAlignment: {
    key: 'careerAlignment',
    label: 'Career Goals & Professional Domain Alignment',
    weight: 20,
    description: 'Relevance between student career goals and mentor industry/headline',
  },
  modeCompatibility: {
    key: 'modeCompatibility',
    label: 'Mentorship Mode Compatibility',
    weight: 10,
    description: 'Compatibility between student preferred mode and offering delivery mode',
  },
  academicRelevance: {
    key: 'academicRelevance',
    label: 'Academic Programme & Department Relevance',
    weight: 10,
    description:
      'Relevance between student academic department/programme and verified alumni record',
  },
  languageCompatibility: {
    key: 'languageCompatibility',
    label: 'Language Compatibility',
    weight: 5,
    description: 'Overlap between student mentorship languages and languages supported by mentor',
  },
};

/** Total configured weight - strictly asserted to equal 100 */
export const TOTAL_WEIGHT = Object.values(MATCHING_CRITERIA).reduce((sum, c) => sum + c.weight, 0);

if (TOTAL_WEIGHT !== 100) {
  throw new Error(`Total matching criteria weight must equal 100, but got ${TOTAL_WEIGHT}`);
}

/**
 * Mentorship Mode Compatibility Matrix.
 * Keys: student preference -> offering mode -> compatibility score (0.0 to 1.0).
 */
export const MODE_COMPATIBILITY_MATRIX: Record<string, Record<string, number>> = {
  online: {
    online: 1.0,
    hybrid: 0.75,
    'in-person': 0.0,
  },
  'in-person': {
    'in-person': 1.0,
    hybrid: 0.75,
    online: 0.0,
  },
  hybrid: {
    hybrid: 1.0,
    online: 0.75,
    'in-person': 0.75,
  },
};

/**
 * Match Category thresholds.
 */
export type MatchCategory = 'Strong Match' | 'Good Match' | 'Moderate Match' | 'Limited Match';

export const MATCH_CATEGORIES: Array<{ minScore: number; category: MatchCategory }> = [
  { minScore: 80, category: 'Strong Match' },
  { minScore: 65, category: 'Good Match' },
  { minScore: 50, category: 'Moderate Match' },
  { minScore: 0, category: 'Limited Match' },
];

/**
 * Minimum data coverage threshold percentage.
 * When assessable criteria sum to less than 40% of the total configured weight,
 * recommendations are flagged as having insufficient profile evidence.
 */
export const MIN_DATA_COVERAGE_THRESHOLD = 40;
