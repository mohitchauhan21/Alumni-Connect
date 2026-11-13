import { describe, it, expect } from 'vitest';
import {
  evaluateTopicAlignment,
  evaluateSkillsAlignment,
  evaluateCareerAlignment,
  evaluateModeCompatibility,
  evaluateAcademicRelevance,
  evaluateLanguageCompatibility,
  calculateMatchScore,
} from '../src/modules/matching/matching.scoring.js';
import { TOTAL_WEIGHT, MATCHING_CRITERIA } from '../src/modules/matching/matching.config.js';

describe('Matching Scoring Engine', () => {
  it('strictly asserts that all configured criteria weights sum to 100', () => {
    expect(TOTAL_WEIGHT).toBe(100);
    const sum = Object.values(MATCHING_CRITERIA).reduce((acc, c) => acc + c.weight, 0);
    expect(sum).toBe(100);
  });

  describe('Criterion 1: Topic and Career Interest Alignment', () => {
    it('scores 1.0 when all student topics are covered by offering topics and mentor expertise', () => {
      const student = {
        preferredMentorshipTopics: ['System Design', 'Cloud Architecture'],
        careerInterests: ['Backend Development'],
      };
      const mentor = {
        alumniId: 'alm-1',
        areasOfExpertise: ['Cloud Architecture'],
        mentorshipTopics: ['Backend Development'],
      };
      const offering = {
        offerId: 'off-1',
        title: 'Backend Mastery',
        description: 'Comprehensive system design and cloud mentorship',
        topics: ['System Design'],
        mode: 'online',
      };

      const result = evaluateTopicAlignment(student, mentor, offering);
      expect(result.assessable).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.weightedContribution).toBe(30);
      expect(result.matchedValues).toHaveLength(3);
    });

    it('scores partial overlap accurately', () => {
      const student = {
        preferredMentorshipTopics: ['React', 'Machine Learning'],
      };
      const mentor = {
        alumniId: 'alm-1',
        areasOfExpertise: ['React'],
      };
      const offering = {
        offerId: 'off-1',
        title: 'Frontend Mastery',
        description: 'React and UI engineering mentorship',
        topics: ['React'],
        mode: 'online',
      };

      const result = evaluateTopicAlignment(student, mentor, offering);
      expect(result.score).toBe(0.5);
      expect(result.weightedContribution).toBe(15);
      expect(result.matchedValues).toEqual(['react']);
      expect(result.unmatchedStudentValues).toEqual(['machine learning']);
    });

    it('marks assessable: false when student has no topic or career interest preferences', () => {
      const student = { preferredMentorshipTopics: [], careerInterests: [] };
      const mentor = { alumniId: 'alm-1', areasOfExpertise: ['DevOps'] };
      const offering = {
        offerId: 'off-1',
        title: 'DevOps',
        description: 'Cloud infra',
        topics: ['DevOps'],
        mode: 'online',
      };

      const result = evaluateTopicAlignment(student, mentor, offering);
      expect(result.assessable).toBe(false);
      expect(result.score).toBe(0);
      expect(result.weightedContribution).toBe(0);
    });
  });

  describe('Criterion 2: Skills and Expertise Alignment', () => {
    it('scores 1.0 when all student skills match mentor skills or expertise', () => {
      const student = { skills: ['Node.js', 'PostgreSQL'] };
      const mentor = {
        alumniId: 'alm-1',
        skills: ['Node.js'],
        areasOfExpertise: ['PostgreSQL', 'Redis'],
      };

      const result = evaluateSkillsAlignment(student, mentor);
      expect(result.assessable).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.weightedContribution).toBe(25);
    });

    it('marks assessable: false when student has no skills listed', () => {
      const student = { skills: [] };
      const mentor = { alumniId: 'alm-1', skills: ['TypeScript'] };

      const result = evaluateSkillsAlignment(student, mentor);
      expect(result.assessable).toBe(false);
      expect(result.score).toBe(0);
    });
  });

  describe('Criterion 3: Career Goals and Professional Domain Alignment', () => {
    it('scores high alignment when student interests match mentor industry', () => {
      const student = {
        careerGoals: 'Aspiring software engineer focused on distributed cloud applications.',
        careerInterests: ['Cloud Computing'],
      };
      const mentor = {
        alumniId: 'alm-1',
        industry: 'Cloud Computing',
        headline: 'Senior Cloud Architect',
        currentDesignation: 'Staff Engineer',
        areasOfExpertise: ['Distributed Systems'],
      };

      const result = evaluateCareerAlignment(student, mentor);
      expect(result.assessable).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.8);
      expect(result.explanation).toContain('Strong domain alignment');
    });

    it('marks assessable: false when student has no career goals or interests', () => {
      const student = { careerGoals: '', careerInterests: [] };
      const mentor = { alumniId: 'alm-1', industry: 'Finance' };

      const result = evaluateCareerAlignment(student, mentor);
      expect(result.assessable).toBe(false);
    });
  });

  describe('Criterion 4: Mentorship Mode Compatibility', () => {
    it('scores 1.0 for exact mode match', () => {
      const student = { preferredMentorshipMode: 'online' };
      const offering = {
        offerId: 'off-1',
        title: 'T',
        description: 'D',
        topics: ['T'],
        mode: 'online',
      };

      const result = evaluateModeCompatibility(student, offering);
      expect(result.score).toBe(1.0);
      expect(result.weightedContribution).toBe(10);
    });

    it('scores 0.75 for hybrid-online or hybrid-in-person compatibility', () => {
      const student = { preferredMentorshipMode: 'hybrid' };
      const offering = {
        offerId: 'off-1',
        title: 'T',
        description: 'D',
        topics: ['T'],
        mode: 'online',
      };

      const result = evaluateModeCompatibility(student, offering);
      expect(result.score).toBe(0.75);
      expect(result.weightedContribution).toBe(7.5);
    });

    it('scores 0.0 for incompatible mode (online student vs in-person offering)', () => {
      const student = { preferredMentorshipMode: 'online' };
      const offering = {
        offerId: 'off-1',
        title: 'T',
        description: 'D',
        topics: ['T'],
        mode: 'in-person',
      };

      const result = evaluateModeCompatibility(student, offering);
      expect(result.score).toBe(0.0);
      expect(result.weightedContribution).toBe(0);
    });

    it('marks assessable: false when student has not specified a preferred mode', () => {
      const student = { preferredMentorshipMode: '' };
      const offering = {
        offerId: 'off-1',
        title: 'T',
        description: 'D',
        topics: ['T'],
        mode: 'online',
      };

      const result = evaluateModeCompatibility(student, offering);
      expect(result.assessable).toBe(false);
    });
  });

  describe('Criterion 5: Academic Programme and Department Relevance', () => {
    it('scores 1.0 when both programme and department match exactly', () => {
      const student = { programme: 'B.Tech Computer Science', department: 'School of Computing' };
      const mentor = {
        alumniId: 'alm-1',
        verifiedProgramme: 'B.Tech Computer Science',
        verifiedDepartment: 'School of Computing',
      };

      const result = evaluateAcademicRelevance(student, mentor);
      expect(result.score).toBe(1.0);
      expect(result.weightedContribution).toBe(10);
    });

    it('scores 0.5 when only department matches', () => {
      const student = {
        programme: 'B.Tech Information Technology',
        department: 'School of Computing',
      };
      const mentor = {
        alumniId: 'alm-1',
        verifiedProgramme: 'B.Tech Computer Science',
        verifiedDepartment: 'School of Computing',
      };

      const result = evaluateAcademicRelevance(student, mentor);
      expect(result.score).toBe(0.5);
      expect(result.weightedContribution).toBe(5);
    });

    it('scores 0.0 when neither programme nor department matches', () => {
      const student = { programme: 'Mechanical Engineering', department: 'School of Mechanical' };
      const mentor = {
        alumniId: 'alm-1',
        verifiedProgramme: 'Computer Science',
        verifiedDepartment: 'School of Computing',
      };

      const result = evaluateAcademicRelevance(student, mentor);
      expect(result.score).toBe(0);
    });

    it('marks assessable: false when student or mentor lacks academic details', () => {
      const student = { programme: '', department: '' };
      const mentor = {
        alumniId: 'alm-1',
        verifiedProgramme: 'CS',
        verifiedDepartment: 'Computing',
      };

      const result = evaluateAcademicRelevance(student, mentor);
      expect(result.assessable).toBe(false);
    });
  });

  describe('Criterion 6: Language Compatibility', () => {
    it('scores 1.0 when student preferred languages are supported by mentor', () => {
      const student = { languages: ['English', 'Hindi'] };
      const mentor = { alumniId: 'alm-1', languages: ['English', 'Hindi', 'German'] };

      const result = evaluateLanguageCompatibility(student, mentor);
      expect(result.assessable).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.weightedContribution).toBe(5);
    });

    it('marks assessable: false when student provides no language preferences', () => {
      const student = { languages: [] };
      const mentor = { alumniId: 'alm-1', languages: ['English'] };

      const result = evaluateLanguageCompatibility(student, mentor);
      expect(result.assessable).toBe(false);
    });
  });

  describe('calculateMatchScore - Overall Weighted Normalization & Coverage', () => {
    const fullStudent = {
      programme: 'B.Tech Computer Science',
      department: 'School of Computing',
      academicInterests: ['Algorithms'],
      skills: ['TypeScript', 'Node.js', 'React'],
      careerInterests: ['Full-Stack Development'],
      careerGoals: 'Become a lead full-stack engineer building resilient web systems.',
      preferredMentorshipTopics: ['System Architecture', 'Code Reviews'],
      preferredMentorshipMode: 'online',
      languages: ['English'],
    };

    const matchingMentor = {
      alumniId: 'alm-10',
      headline: 'Principal Engineer at Tech Corp',
      currentDesignation: 'Principal Engineer',
      company: 'Tech Corp',
      industry: 'Software Development',
      skills: ['TypeScript', 'Node.js', 'React', 'GraphQL'],
      areasOfExpertise: ['System Architecture', 'Web Systems'],
      mentorshipTopics: ['System Architecture', 'Code Reviews', 'Career Growth'],
      languages: ['English', 'Spanish'],
      verifiedProgramme: 'B.Tech Computer Science',
      verifiedDepartment: 'School of Computing',
    };

    const matchingOffer = {
      offerId: 'off-10',
      title: 'Full-Stack & System Architecture Mentorship',
      description:
        'Hands-on architectural guidance and career mentorship for aspiring web engineers.',
      topics: ['System Architecture', 'Code Reviews', 'Full-Stack Development'],
      mode: 'online',
    };

    it('produces a Strong Match with 100% data coverage when all criteria are evaluated and match', () => {
      const result = calculateMatchScore(fullStudent, matchingMentor, matchingOffer);
      expect(result.dataCoverage).toBe(100);
      expect(result.hasInsufficientData).toBe(false);
      expect(result.compatibilityScore).toBeGreaterThanOrEqual(80);
      expect(result.matchCategory).toBe('Strong Match');
      expect(result.breakdown).toHaveLength(6);
      expect(result.explanation.strengths.length).toBeGreaterThan(0);
    });

    it('correctly calculates data coverage when optional criteria (e.g. languages) are missing', () => {
      const studentWithoutLang = { ...fullStudent, languages: [] };
      const result = calculateMatchScore(studentWithoutLang, matchingMentor, matchingOffer);
      // Criteria assessed: 30 + 25 + 20 + 10 + 10 = 95%
      expect(result.dataCoverage).toBe(95);
      expect(result.hasInsufficientData).toBe(false);
      // Normalized score denominator is 95, not 100
      expect(result.compatibilityScore).toBeGreaterThanOrEqual(80);
    });

    it('flags hasInsufficientData when data coverage is below 40%', () => {
      // Student has only mode specified (10% weight)
      const sparseStudent = {
        preferredMentorshipMode: 'online',
      };
      const result = calculateMatchScore(sparseStudent, matchingMentor, matchingOffer);
      expect(result.dataCoverage).toBe(10);
      expect(result.hasInsufficientData).toBe(true);
      expect(result.explanation.summary).toContain('Preliminary compatibility');
    });

    it('ensures compatibility score is always bounded between 0 and 100', () => {
      const emptyStudent = {};
      const result = calculateMatchScore(emptyStudent, matchingMentor, matchingOffer);
      expect(result.compatibilityScore).toBe(0);
      expect(result.dataCoverage).toBe(0);
      expect(result.hasInsufficientData).toBe(true);
      expect(Number.isNaN(result.compatibilityScore)).toBe(false);
    });

    it('is completely deterministic: identical inputs produce identical scores', () => {
      const result1 = calculateMatchScore(fullStudent, matchingMentor, matchingOffer);
      const result2 = calculateMatchScore(fullStudent, matchingMentor, matchingOffer);
      expect(result1.compatibilityScore).toBe(result2.compatibilityScore);
      expect(result1.dataCoverage).toBe(result2.dataCoverage);
      expect(result1.matchCategory).toBe(result2.matchCategory);
    });
  });
});
