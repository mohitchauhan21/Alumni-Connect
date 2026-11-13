/**
 * matching.scoring.ts
 * Multi-criteria weighted scoring and explainability engine.
 * Computes deterministic compatibility scores, coverage percentages, and human-readable evidence.
 */

import {
  MATCHING_CRITERIA,
  MODE_COMPATIBILITY_MATRIX,
  MATCH_CATEGORIES,
  MIN_DATA_COVERAGE_THRESHOLD,
  type MatchCategory,
} from './matching.config.js';
import {
  normalizeArray,
  extractKeywords,
  intersectNormalizedSets,
  isExactNormalizedMatch,
} from './matching.utils.js';

export interface CriterionEvaluation {
  criterionKey: string;
  criterionLabel: string;
  weight: number;
  score: number; // 0.0 to 1.0
  weightedContribution: number; // weight * score
  assessable: boolean;
  matchedValues: string[];
  unmatchedStudentValues: string[];
  explanation: string;
}

export interface StudentMatchingInput {
  programme?: string;
  department?: string;
  academicInterests?: string[];
  skills?: string[];
  careerInterests?: string[];
  careerGoals?: string;
  preferredMentorshipTopics?: string[];
  preferredMentorshipMode?: string;
  languages?: string[];
}

export interface MentorMatchingInput {
  alumniId: string;
  headline?: string;
  currentDesignation?: string;
  company?: string;
  industry?: string;
  skills?: string[];
  areasOfExpertise?: string[];
  mentorshipTopics?: string[];
  languages?: string[];
  // Verified institutional education
  verifiedProgramme?: string;
  verifiedDepartment?: string;
}

export interface OfferingMatchingInput {
  offerId: string;
  title: string;
  description: string;
  topics: string[];
  mode: string;
}

export interface RecommendationExplanation {
  summary: string;
  strengths: string[];
  gaps: string[];
}

export interface MatchingResult {
  compatibilityScore: number; // 0 to 100
  dataCoverage: number; // 0 to 100
  matchCategory: MatchCategory;
  hasInsufficientData: boolean;
  explanation: RecommendationExplanation;
  breakdown: CriterionEvaluation[];
}

/**
 * Criterion 1: Mentorship Topic & Career Interest Alignment (30%)
 */
export function evaluateTopicAlignment(
  student: StudentMatchingInput,
  mentor: MentorMatchingInput,
  offering: OfferingMatchingInput
): CriterionEvaluation {
  const config = MATCHING_CRITERIA.topicAlignment;
  const studentTopics = normalizeArray([
    ...(student.preferredMentorshipTopics || []),
    ...(student.careerInterests || []),
  ]);

  if (studentTopics.length === 0) {
    return {
      criterionKey: config.key,
      criterionLabel: config.label,
      weight: config.weight,
      score: 0,
      weightedContribution: 0,
      assessable: false,
      matchedValues: [],
      unmatchedStudentValues: [],
      explanation:
        'No preferred mentorship topics or career interests provided in student profile.',
    };
  }

  const mentorTopics = normalizeArray([
    ...(offering.topics || []),
    ...(mentor.areasOfExpertise || []),
    ...(mentor.mentorshipTopics || []),
  ]);

  const { matched, unmatchedStudent, overlapRatio } = intersectNormalizedSets(
    studentTopics,
    mentorTopics
  );

  let explanation: string;
  if (overlapRatio === 1) {
    explanation =
      'All selected student topics and interests directly match this offering and mentor expertise.';
  } else if (overlapRatio > 0) {
    explanation = `Offering directly covers ${matched.length} of ${studentTopics.length} student topics/interests: ${matched.join(', ')}.`;
  } else {
    explanation = 'None of the student’s stated topics or career interests match this offering.';
  }

  return {
    criterionKey: config.key,
    criterionLabel: config.label,
    weight: config.weight,
    score: overlapRatio,
    weightedContribution: Number((config.weight * overlapRatio).toFixed(2)),
    assessable: true,
    matchedValues: matched,
    unmatchedStudentValues: unmatchedStudent,
    explanation,
  };
}

/**
 * Criterion 2: Skills & Expertise Alignment (25%)
 */
export function evaluateSkillsAlignment(
  student: StudentMatchingInput,
  mentor: MentorMatchingInput
): CriterionEvaluation {
  const config = MATCHING_CRITERIA.skillsAlignment;
  const studentSkills = normalizeArray(student.skills || []);

  if (studentSkills.length === 0) {
    return {
      criterionKey: config.key,
      criterionLabel: config.label,
      weight: config.weight,
      score: 0,
      weightedContribution: 0,
      assessable: false,
      matchedValues: [],
      unmatchedStudentValues: [],
      explanation: 'No technical or professional skills listed in student profile.',
    };
  }

  const mentorSkills = normalizeArray([
    ...(mentor.skills || []),
    ...(mentor.areasOfExpertise || []),
  ]);

  const { matched, unmatchedStudent, overlapRatio } = intersectNormalizedSets(
    studentSkills,
    mentorSkills
  );

  let explanation: string;
  if (overlapRatio === 1) {
    explanation = 'The mentor lists professional expertise in all of the student’s stated skills.';
  } else if (overlapRatio > 0) {
    explanation = `The mentor has verified expertise in ${matched.length} of ${studentSkills.length} student skills: ${matched.join(', ')}.`;
  } else {
    explanation =
      'No direct overlap between student skills and the mentor’s listed skills or expertise.';
  }

  return {
    criterionKey: config.key,
    criterionLabel: config.label,
    weight: config.weight,
    score: overlapRatio,
    weightedContribution: Number((config.weight * overlapRatio).toFixed(2)),
    assessable: true,
    matchedValues: matched,
    unmatchedStudentValues: unmatchedStudent,
    explanation,
  };
}

/**
 * Criterion 3: Career Goals & Professional Domain Alignment (20%)
 */
export function evaluateCareerAlignment(
  student: StudentMatchingInput,
  mentor: MentorMatchingInput
): CriterionEvaluation {
  const config = MATCHING_CRITERIA.careerAlignment;

  const studentTokens = normalizeArray([
    ...extractKeywords(student.careerGoals),
    ...(student.careerInterests || []),
  ]);

  if (studentTokens.length === 0) {
    return {
      criterionKey: config.key,
      criterionLabel: config.label,
      weight: config.weight,
      score: 0,
      weightedContribution: 0,
      assessable: false,
      matchedValues: [],
      unmatchedStudentValues: [],
      explanation: 'No career goals or career interests specified in student profile.',
    };
  }

  const mentorTokens = normalizeArray([
    ...extractKeywords(mentor.industry),
    ...extractKeywords(mentor.headline),
    ...extractKeywords(mentor.currentDesignation),
    ...(mentor.areasOfExpertise || []),
  ]);

  const { matched, unmatchedStudent, overlapRatio } = intersectNormalizedSets(
    studentTokens,
    mentorTokens
  );

  // Bonus if student's career interests exactly match mentor's industry
  let score = overlapRatio;
  if (mentor.industry && student.careerInterests && student.careerInterests.length > 0) {
    const industryMatched = student.careerInterests.some(ci =>
      isExactNormalizedMatch(ci, mentor.industry)
    );
    if (industryMatched) {
      score = Math.max(0.8, score);
      if (!matched.includes(mentor.industry.toLowerCase().trim())) {
        matched.push(mentor.industry.toLowerCase().trim());
      }
    }
  }

  score = Math.min(1.0, Math.max(0.0, score));

  let explanation: string;
  if (score >= 0.8) {
    explanation = `Strong domain alignment with the mentor's industry (${mentor.industry || 'Tech'}) and professional career path.`;
  } else if (score > 0) {
    explanation = `Relevant career domain overlap on: ${matched.slice(0, 4).join(', ')}.`;
  } else {
    explanation =
      'Limited career goal or industry domain overlap based on current profile details.';
  }

  return {
    criterionKey: config.key,
    criterionLabel: config.label,
    weight: config.weight,
    score: Number(score.toFixed(2)),
    weightedContribution: Number((config.weight * score).toFixed(2)),
    assessable: true,
    matchedValues: matched,
    unmatchedStudentValues: unmatchedStudent,
    explanation,
  };
}

/**
 * Criterion 4: Mentorship Mode Compatibility (10%)
 */
export function evaluateModeCompatibility(
  student: StudentMatchingInput,
  offering: OfferingMatchingInput
): CriterionEvaluation {
  const config = MATCHING_CRITERIA.modeCompatibility;
  const studentMode = student.preferredMentorshipMode?.toLowerCase().trim();
  const offeringMode = offering.mode?.toLowerCase().trim();

  if (!studentMode) {
    return {
      criterionKey: config.key,
      criterionLabel: config.label,
      weight: config.weight,
      score: 0,
      weightedContribution: 0,
      assessable: false,
      matchedValues: [],
      unmatchedStudentValues: [],
      explanation: 'Student has not specified a preferred mentorship mode.',
    };
  }

  const score = MODE_COMPATIBILITY_MATRIX[studentMode]?.[offeringMode] ?? 0;

  let explanation: string;
  if (score === 1.0) {
    explanation = `Perfect mode match: offering is delivered ${offeringMode}, matching the student preference.`;
  } else if (score === 0.75) {
    explanation = `Compatible mode: student prefers ${studentMode}, offering is delivered ${offeringMode}.`;
  } else {
    explanation = `Mode mismatch: student prefers ${studentMode}, but offering requires ${offeringMode}.`;
  }

  return {
    criterionKey: config.key,
    criterionLabel: config.label,
    weight: config.weight,
    score,
    weightedContribution: Number((config.weight * score).toFixed(2)),
    assessable: true,
    matchedValues: score > 0 ? [offeringMode] : [],
    unmatchedStudentValues: score === 0 ? [studentMode] : [],
    explanation,
  };
}

/**
 * Criterion 5: Academic Programme & Department Relevance (10%)
 */
export function evaluateAcademicRelevance(
  student: StudentMatchingInput,
  mentor: MentorMatchingInput
): CriterionEvaluation {
  const config = MATCHING_CRITERIA.academicRelevance;

  const hasStudentAcademicData = Boolean(student.programme?.trim() || student.department?.trim());

  const hasMentorAcademicData = Boolean(
    mentor.verifiedProgramme?.trim() || mentor.verifiedDepartment?.trim()
  );

  if (!hasStudentAcademicData || !hasMentorAcademicData) {
    return {
      criterionKey: config.key,
      criterionLabel: config.label,
      weight: config.weight,
      score: 0,
      weightedContribution: 0,
      assessable: false,
      matchedValues: [],
      unmatchedStudentValues: [],
      explanation:
        'Academic programme or department data is missing for student or verified alumnus.',
    };
  }

  const programmeMatch = isExactNormalizedMatch(student.programme, mentor.verifiedProgramme);
  const departmentMatch = isExactNormalizedMatch(student.department, mentor.verifiedDepartment);

  let score = 0;
  const matchedValues: string[] = [];
  const unmatchedStudentValues: string[] = [];

  if (programmeMatch && departmentMatch) {
    score = 1.0;
    matchedValues.push(`Programme: ${student.programme}`, `Department: ${student.department}`);
  } else if (programmeMatch || departmentMatch) {
    score = 0.5;
    if (programmeMatch) {
      matchedValues.push(`Programme: ${student.programme}`);
      if (student.department) unmatchedStudentValues.push(`Department: ${student.department}`);
    } else {
      matchedValues.push(`Department: ${student.department}`);
      if (student.programme) unmatchedStudentValues.push(`Programme: ${student.programme}`);
    }
  } else {
    score = 0.0;
    if (student.programme) unmatchedStudentValues.push(`Programme: ${student.programme}`);
    if (student.department) unmatchedStudentValues.push(`Department: ${student.department}`);
  }

  let explanation: string;
  if (score === 1.0) {
    explanation =
      'Exact academic alignment: student and mentor share the same programme and department.';
  } else if (score === 0.5) {
    explanation = `Partial academic alignment: matched on ${programmeMatch ? 'programme' : 'department'}.`;
  } else {
    explanation = 'Different academic programme and department.';
  }

  return {
    criterionKey: config.key,
    criterionLabel: config.label,
    weight: config.weight,
    score,
    weightedContribution: Number((config.weight * score).toFixed(2)),
    assessable: true,
    matchedValues,
    unmatchedStudentValues,
    explanation,
  };
}

/**
 * Criterion 6: Language Compatibility (5%)
 */
export function evaluateLanguageCompatibility(
  student: StudentMatchingInput,
  mentor: MentorMatchingInput
): CriterionEvaluation {
  const config = MATCHING_CRITERIA.languageCompatibility;
  const studentLanguages = normalizeArray(student.languages || []);

  if (studentLanguages.length === 0) {
    return {
      criterionKey: config.key,
      criterionLabel: config.label,
      weight: config.weight,
      score: 0,
      weightedContribution: 0,
      assessable: false,
      matchedValues: [],
      unmatchedStudentValues: [],
      explanation: 'No specific language preferences provided in student profile.',
    };
  }

  const mentorLanguages = normalizeArray(mentor.languages || ['English']);
  const { matched, unmatchedStudent, overlapRatio } = intersectNormalizedSets(
    studentLanguages,
    mentorLanguages
  );

  let explanation: string;
  if (overlapRatio === 1) {
    explanation = `All preferred languages (${matched.join(', ')}) are supported by the mentor.`;
  } else if (overlapRatio > 0) {
    explanation = `Shared language(s): ${matched.join(', ')}.`;
  } else {
    explanation = 'No shared languages between student preferences and mentor capabilities.';
  }

  return {
    criterionKey: config.key,
    criterionLabel: config.label,
    weight: config.weight,
    score: overlapRatio,
    weightedContribution: Number((config.weight * overlapRatio).toFixed(2)),
    assessable: true,
    matchedValues: matched,
    unmatchedStudentValues: unmatchedStudent,
    explanation,
  };
}

/**
 * Evaluates all 6 criteria, calculates normalized score, data coverage, and overall explainability.
 */
export function calculateMatchScore(
  student: StudentMatchingInput,
  mentor: MentorMatchingInput,
  offering: OfferingMatchingInput
): MatchingResult {
  const breakdown: CriterionEvaluation[] = [
    evaluateTopicAlignment(student, mentor, offering),
    evaluateSkillsAlignment(student, mentor),
    evaluateCareerAlignment(student, mentor),
    evaluateModeCompatibility(student, offering),
    evaluateAcademicRelevance(student, mentor),
    evaluateLanguageCompatibility(student, mentor),
  ];

  const assessableCriteria = breakdown.filter(c => c.assessable);
  const totalAssessableWeight = assessableCriteria.reduce((sum, c) => sum + c.weight, 0);
  const totalWeightedScore = assessableCriteria.reduce((sum, c) => sum + c.weightedContribution, 0);

  // Normalized compatibility score: 0 to 100
  let compatibilityScore = 0;
  if (totalAssessableWeight > 0) {
    compatibilityScore = Math.round((totalWeightedScore / totalAssessableWeight) * 100);
  }

  // Ensure score stays within strict [0, 100] bounds
  compatibilityScore = Math.min(100, Math.max(0, compatibilityScore));

  // Data coverage: sum of assessable weights / 100 * 100
  const dataCoverage = Math.min(100, Math.max(0, totalAssessableWeight));
  const hasInsufficientData = dataCoverage < MIN_DATA_COVERAGE_THRESHOLD;

  // Categorization
  let matchCategory: MatchCategory = 'Limited Match';
  for (const cat of MATCH_CATEGORIES) {
    if (compatibilityScore >= cat.minScore) {
      matchCategory = cat.category;
      break;
    }
  }

  // Explanation strengths & gaps
  const strengths: string[] = [];
  const gaps: string[] = [];

  for (const crit of breakdown) {
    if (crit.assessable) {
      if (crit.score >= 0.7) {
        strengths.push(`${crit.criterionLabel}: ${crit.explanation}`);
      } else if (crit.score < 0.5) {
        gaps.push(`${crit.criterionLabel}: ${crit.explanation}`);
      }
    }
  }

  let summary: string;
  if (hasInsufficientData) {
    summary = `Preliminary compatibility of ${compatibilityScore}%, but student profile information covers only ${dataCoverage}% of evaluation criteria. Complete more profile details for higher confidence recommendations.`;
  } else if (compatibilityScore >= 80) {
    summary = `Strong match (${compatibilityScore}%) driven by high topic and skills alignment with this mentor.`;
  } else if (compatibilityScore >= 65) {
    summary = `Good match (${compatibilityScore}%) with valuable domain overlap and compatible mentorship mode.`;
  } else if (compatibilityScore >= 50) {
    summary = `Moderate match (${compatibilityScore}%) with some shared interests or relevant background.`;
  } else {
    summary = `Limited match (${compatibilityScore}%). Topics or delivery mode have low overlap with stated preferences.`;
  }

  return {
    compatibilityScore,
    dataCoverage,
    matchCategory,
    hasInsufficientData,
    explanation: {
      summary,
      strengths,
      gaps,
    },
    breakdown,
  };
}
