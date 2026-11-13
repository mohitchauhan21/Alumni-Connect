/**
 * matching.utils.ts
 * Deterministic text normalization, token extraction, and comparison utilities.
 * Uses exact token matching to prevent false substring matches (e.g. Java vs JavaScript).
 */

const STOP_WORDS = new Set([
  'a',
  'about',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'i',
  'in',
  'into',
  'is',
  'it',
  'my',
  'of',
  'on',
  'or',
  'our',
  'that',
  'the',
  'their',
  'this',
  'to',
  'want',
  'we',
  'will',
  'with',
]);

/**
 * Normalizes text by lowercasing, trimming, and collapsing whitespace.
 * Preserves alphanumeric characters and essential programming symbols (#, +, ., -).
 */
export function normalizeText(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s+#.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes a single structured tag or phrase (e.g., "Full-Stack Development" -> "full-stack development").
 */
export function normalizePhrase(phrase: unknown): string {
  if (typeof phrase !== 'string') return '';
  return phrase.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Deduplicates and normalizes an array of tags, removing empty strings.
 */
export function normalizeArray(items: unknown[] | null | undefined): string[] {
  if (!Array.isArray(items)) return [];
  const set = new Set<string>();
  for (const item of items) {
    const norm = normalizePhrase(item);
    if (norm.length > 0) {
      set.add(norm);
    }
  }
  return Array.from(set);
}

/**
 * Extracts normalized keyword tokens from a free-text string (e.g. career goals, bio).
 * Filters out common stop words and single-character noise (except 'c' and 'r' for languages).
 */
export function extractKeywords(text: unknown): string[] {
  const norm = normalizeText(text);
  if (!norm) return [];

  const rawTokens = norm.split(/[\s,;/]+/);
  const result = new Set<string>();

  for (const token of rawTokens) {
    const clean = token.replace(/^[.-]+|[.-]+$/g, '');
    if (!clean) continue;
    if (clean.length === 1 && clean !== 'c' && clean !== 'r') continue;
    if (!STOP_WORDS.has(clean)) {
      result.add(clean);
    }
  }

  return Array.from(result);
}

export interface SetIntersectionResult {
  matched: string[];
  unmatchedStudent: string[];
  overlapRatio: number; // 0.0 to 1.0
}

/**
 * Compares student items against mentor items using exact normalized comparison.
 * Prevents accidental substring matches (e.g. "java" will NOT match "javascript").
 */
export function intersectNormalizedSets(
  studentItems: string[],
  mentorItems: string[]
): SetIntersectionResult {
  const normalizedStudent = normalizeArray(studentItems);
  const normalizedMentor = new Set(normalizeArray(mentorItems));

  if (normalizedStudent.length === 0) {
    return {
      matched: [],
      unmatchedStudent: [],
      overlapRatio: 0,
    };
  }

  const matched: string[] = [];
  const unmatchedStudent: string[] = [];

  for (const item of normalizedStudent) {
    if (normalizedMentor.has(item)) {
      matched.push(item);
    } else {
      unmatchedStudent.push(item);
    }
  }

  const overlapRatio = matched.length / normalizedStudent.length;

  return {
    matched,
    unmatchedStudent,
    overlapRatio,
  };
}

/**
 * Checks whether two single strings match under case-insensitive trimmed normalization.
 */
export function isExactNormalizedMatch(a: unknown, b: unknown): boolean {
  const normA = normalizePhrase(a);
  const normB = normalizePhrase(b);
  return normA.length > 0 && normB.length > 0 && normA === normB;
}

/**
 * Computes Jaccard similarity between two token sets.
 */
export function jaccardSimilarity(setA: string[], setB: string[]): number {
  const normA = new Set(normalizeArray(setA));
  const normB = new Set(normalizeArray(setB));

  if (normA.size === 0 || normB.size === 0) return 0;

  let intersectionCount = 0;
  for (const item of normA) {
    if (normB.has(item)) {
      intersectionCount++;
    }
  }

  const unionCount = new Set([...normA, ...normB]).size;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}
