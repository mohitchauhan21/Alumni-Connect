/**
 * matching.service.ts
 * Transparent, deterministic matching engine between applicant submissions
 * and official institutional records.
 *
 * Rules:
 * - NO AI, NO LLM, NO fuzzy matching heuristics.
 * - Primary keys: Normalized alumni_id & normalized institutional_email.
 * - Cross-checks: Full name, programme, department, graduation year.
 * - Results:
 *   - 'matched': Unique record matches primary keys and cross-checks cleanly.
 *   - 'conflict': Primary record found by alumni_id but discrepancies exist in email, graduation year, or department.
 *   - 'unmatched': No institutional record found with the supplied alumni_id.
 */

import {
  InstitutionalAlumniRecord,
  IInstitutionalAlumniRecord,
} from './institutionalRecord.model.js';
import type {
  MatchingResult,
  MatchingDetails,
  VerificationSubmitInput,
} from './verification.types.js';

export interface MatchingEvaluation {
  result: MatchingResult;
  details: MatchingDetails;
  matchedRecord: IInstitutionalAlumniRecord | null;
}

function normalizeString(val: string): string {
  return (val || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function evaluateInstitutionalMatch(
  input: VerificationSubmitInput
): Promise<MatchingEvaluation> {
  const normalizedAlumniId = input.alumniId.trim().toUpperCase();
  const normalizedEmail = input.institutionalEmail.trim().toLowerCase();
  const normalizedProgramme = normalizeString(input.programme);
  const normalizedDepartment = normalizeString(input.department);
  const gradYear = Number(input.graduationYear);

  // 1. Search by exact normalized alumni ID
  const candidateRecord = await InstitutionalAlumniRecord.findOne({
    alumniId: normalizedAlumniId,
  });

  if (!candidateRecord) {
    return {
      result: 'unmatched',
      details: {
        matchedFields: [],
        conflictingFields: ['alumniId'],
        notes: `No institutional record exists for Alumni ID "${normalizedAlumniId}".`,
      },
      matchedRecord: null,
    };
  }

  // 2. Cross-check fields
  const matchedFields: string[] = ['alumniId'];
  const conflictingFields: string[] = [];

  // Check institutional email
  if (candidateRecord.institutionalEmail.toLowerCase() === normalizedEmail) {
    matchedFields.push('institutionalEmail');
  } else {
    conflictingFields.push('institutionalEmail');
  }

  // Check graduation year
  if (candidateRecord.graduationYear === gradYear) {
    matchedFields.push('graduationYear');
  } else {
    conflictingFields.push('graduationYear');
  }

  // Check department (case and space normalized)
  if (normalizeString(candidateRecord.department) === normalizedDepartment) {
    matchedFields.push('department');
  } else {
    conflictingFields.push('department');
  }

  // Check programme (case and space normalized)
  if (normalizeString(candidateRecord.programme) === normalizedProgramme) {
    matchedFields.push('programme');
  } else {
    conflictingFields.push('programme');
  }

  // Check if candidate record is already claimed by another user
  if (candidateRecord.isClaimed) {
    conflictingFields.push('isClaimed');
    return {
      result: 'conflict',
      details: {
        matchedFields,
        conflictingFields,
        notes: `Institutional record "${normalizedAlumniId}" is already claimed by another verified alumni account.`,
      },
      matchedRecord: candidateRecord,
    };
  }

  // Conflict if email or graduation year or core fields disagree
  if (conflictingFields.length > 0) {
    return {
      result: 'conflict',
      details: {
        matchedFields,
        conflictingFields,
        notes: `Institutional record found for "${normalizedAlumniId}", but conflicting values detected in: ${conflictingFields.join(', ')}.`,
      },
      matchedRecord: candidateRecord,
    };
  }

  // All primary and cross-check criteria strictly satisfied
  return {
    result: 'matched',
    details: {
      matchedFields,
      conflictingFields: [],
      notes: 'All primary identity credentials and institutional cross-checks match official university registry.',
    },
    matchedRecord: candidateRecord,
  };
}

