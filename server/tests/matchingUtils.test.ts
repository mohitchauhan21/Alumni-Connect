import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  normalizePhrase,
  normalizeArray,
  extractKeywords,
  intersectNormalizedSets,
  isExactNormalizedMatch,
  jaccardSimilarity,
} from '../src/modules/matching/matching.utils.js';

describe('Matching Utilities - Text Normalization & Token Comparison', () => {
  describe('normalizeText', () => {
    it('normalizes capitalization, trims whitespace, and collapses repeated whitespace', () => {
      const input = '   Software   ENGINEERING   and System   Design   ';
      expect(normalizeText(input)).toBe('software engineering and system design');
    });

    it('handles null, undefined, and non-string inputs safely', () => {
      expect(normalizeText(null)).toBe('');
      expect(normalizeText(undefined)).toBe('');
      expect(normalizeText(123)).toBe('');
      expect(normalizeText({})).toBe('');
    });

    it('preserves essential programming symbols like +, #, ., - while stripping other punctuation', () => {
      const input = 'C++, C#, .NET, Node.js, Next.js, and CI/CD!!';
      const normalized = normalizeText(input);
      expect(normalized).toContain('c++');
      expect(normalized).toContain('c#');
      expect(normalized).toContain('.net');
      expect(normalized).toContain('node.js');
      expect(normalized).toContain('next.js');
    });
  });

  describe('normalizePhrase', () => {
    it('normalizes single structured phrases cleanly', () => {
      expect(normalizePhrase('  Machine Learning  ')).toBe('machine learning');
      expect(normalizePhrase('Distributed   Systems')).toBe('distributed systems');
    });

    it('returns empty string for empty or non-string values', () => {
      expect(normalizePhrase('')).toBe('');
      expect(normalizePhrase(null)).toBe('');
    });
  });

  describe('normalizeArray', () => {
    it('deduplicates items, trims, lowercases, and removes empty elements', () => {
      const input = [' Python ', 'python', 'PYTHON', '', '  ', 'JavaScript', 'TypeScript'];
      const result = normalizeArray(input);
      expect(result).toEqual(['python', 'javascript', 'typescript']);
    });

    it('handles null and undefined arrays gracefully', () => {
      expect(normalizeArray(null)).toEqual([]);
      expect(normalizeArray(undefined)).toEqual([]);
    });
  });

  describe('extractKeywords', () => {
    it('extracts meaningful keyword tokens and removes stop words', () => {
      const bio =
        'I want to be a lead backend engineer working with distributed cloud architectures.';
      const keywords = extractKeywords(bio);
      expect(keywords).toContain('lead');
      expect(keywords).toContain('backend');
      expect(keywords).toContain('engineer');
      expect(keywords).toContain('working');
      expect(keywords).toContain('distributed');
      expect(keywords).toContain('cloud');
      expect(keywords).toContain('architectures');
      expect(keywords).not.toContain('i');
      expect(keywords).not.toContain('want');
      expect(keywords).not.toContain('to');
      expect(keywords).not.toContain('be');
      expect(keywords).not.toContain('a');
      expect(keywords).not.toContain('with');
    });

    it('preserves single-character language tokens like c and r', () => {
      const text = 'Expert in C, R, Python, and C++';
      const keywords = extractKeywords(text);
      expect(keywords).toContain('c');
      expect(keywords).toContain('r');
      expect(keywords).toContain('c++');
      expect(keywords).toContain('python');
    });
  });

  describe('intersectNormalizedSets - Exact Matching & Substring Prevention', () => {
    it('correctly matches identical normalized items regardless of casing or whitespace', () => {
      const student = ['React', 'Node.js', 'MongoDB', 'Docker'];
      const mentor = ['node.js', 'REACT', 'Kubernetes', 'mongodb'];

      const result = intersectNormalizedSets(student, mentor);
      expect(result.matched).toEqual(['react', 'node.js', 'mongodb']);
      expect(result.unmatchedStudent).toEqual(['docker']);
      expect(result.overlapRatio).toBeCloseTo(0.75, 2);
    });

    it('strictly prevents accidental substring matches (e.g., Java vs JavaScript, Go vs Google)', () => {
      const student = ['Java', 'Go'];
      const mentor = ['JavaScript', 'Google Cloud', 'Golang'];

      const result = intersectNormalizedSets(student, mentor);
      // "java" should NOT match "javascript"
      // "go" should NOT match "google cloud" or "golang"
      expect(result.matched).toEqual([]);
      expect(result.unmatchedStudent).toEqual(['java', 'go']);
      expect(result.overlapRatio).toBe(0);
    });

    it('handles empty student preferences safely without division by zero', () => {
      const result = intersectNormalizedSets([], ['React', 'Node.js']);
      expect(result.matched).toEqual([]);
      expect(result.unmatchedStudent).toEqual([]);
      expect(result.overlapRatio).toBe(0);
    });

    it('handles empty mentor offerings safely', () => {
      const result = intersectNormalizedSets(['React', 'Node.js'], []);
      expect(result.matched).toEqual([]);
      expect(result.unmatchedStudent).toEqual(['react', 'node.js']);
      expect(result.overlapRatio).toBe(0);
    });
  });

  describe('isExactNormalizedMatch', () => {
    it('compares case-insensitively and whitespace-trimmed', () => {
      expect(isExactNormalizedMatch('School of Computing', '  school OF computing ')).toBe(true);
      expect(isExactNormalizedMatch('Computer Science', 'Computer Engineering')).toBe(false);
      expect(isExactNormalizedMatch('', '')).toBe(false);
      expect(isExactNormalizedMatch(null, 'test')).toBe(false);
    });
  });

  describe('jaccardSimilarity', () => {
    it('calculates proper Jaccard token set similarity', () => {
      const setA = ['cloud', 'aws', 'backend'];
      const setB = ['backend', 'aws', 'devops'];
      // Intersection: 2 (aws, backend)
      // Union: 4 (cloud, aws, backend, devops)
      // Jaccard: 2/4 = 0.5
      expect(jaccardSimilarity(setA, setB)).toBeCloseTo(0.5, 2);
    });

    it('returns 0 when sets are disjoint or empty', () => {
      expect(jaccardSimilarity([], ['test'])).toBe(0);
      expect(jaccardSimilarity(['a'], ['b'])).toBe(0);
    });
  });
});
