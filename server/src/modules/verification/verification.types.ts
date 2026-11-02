/**
 * verification.types.ts
 * Type definitions, enums, and DTOs for Alumni Institutional Verification,
 * Institutional Records, and Audit Trails.
 */

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type MatchingResult = 'matched' | 'unmatched' | 'conflict';

export type AuditAction =
  | 'VERIFICATION_SUBMITTED'
  | 'VERIFICATION_RESUBMITTED'
  | 'VERIFICATION_APPROVED'
  | 'VERIFICATION_REJECTED'
  | 'RECORDS_IMPORTED';

export type AuditEntityType = 'verification' | 'institutional_record' | 'user';

/** Applicant submission payload */
export interface VerificationSubmitInput {
  alumniId: string;
  institutionalEmail: string;
  programme: string;
  department: string;
  graduationYear: number;
}

/** Field-level matching details */
export interface MatchingDetails {
  matchedFields: string[];
  conflictingFields: string[];
  notes?: string;
}

/** Public safe DTO returned to applicant alumnus */
export interface AlumniVerificationDTO {
  id: string;
  alumniId: string;
  institutionalEmail: string;
  programme: string;
  department: string;
  graduationYear: number;
  status: VerificationStatus;
  matchingResult: MatchingResult;
  submissionVersion: number;
  submittedAt: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

/** Detailed DTO returned to authorized officers */
export interface OfficerVerificationDetailDTO extends AlumniVerificationDTO {
  userId: string;
  applicantName: string;
  applicantAccountEmail: string;
  matchingDetails: MatchingDetails;
  matchedRecord?: {
    id: string;
    alumniId: string;
    fullName: string;
    institutionalEmail: string;
    programme: string;
    department: string;
    graduationYear: number;
  } | null;
  reviewedByOfficer?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

/** Item in officer verification queue */
export interface OfficerQueueItemDTO {
  id: string;
  userId: string;
  applicantName: string;
  applicantEmail: string;
  alumniId: string;
  programme: string;
  department: string;
  graduationYear: number;
  status: VerificationStatus;
  matchingResult: MatchingResult;
  submissionVersion: number;
  submittedAt: string;
  reviewedAt?: string;
}

/** Raw CSV row representation */
export interface InstitutionalCsvRow {
  alumni_id: string;
  full_name: string;
  institutional_email: string;
  programme: string;
  department: string;
  graduation_year: string | number;
}

/** Validated row ready for DB */
export interface ValidatedInstitutionalRecord {
  alumniId: string;
  fullName: string;
  institutionalEmail: string;
  programme: string;
  department: string;
  graduationYear: number;
}

/** Row error description */
export interface RowValidationError {
  rowNumber: number;
  alumniId?: string;
  reason: string;
}

/** Preview summary response */
export interface CsvImportPreviewDTO {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  duplicateRowsCount: number;
  existingConflictsCount: number;
  previewRecords: ValidatedInstitutionalRecord[];
  errors: RowValidationError[];
}

/** Confirmation result response */
export interface CsvImportResultDTO {
  batchId: string;
  totalProcessed: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
}

/** Verification Overview Metrics */
export interface VerificationMetricsDTO {
  pendingCount: number;
  verifiedCount: number;
  rejectedCount: number;
  totalRecordsCount: number;
}

