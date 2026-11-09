/**
 * csv.service.ts
 * In-memory CSV validation, preview generation, and batch database import.
 *
 * Requirements:
 * - Expected headers: alumni_id, full_name, institutional_email, programme, department, graduation_year
 * - In-memory processing only (never stored to disk or public paths)
 * - Safe error handling (never exposes internal parser traces or logs PII rows)
 * - Re-validates on confirmation; idempotent inserts and updates
 */

import { parse } from 'csv-parse/sync';
import crypto from 'crypto';
import { Types } from 'mongoose';
import {
  InstitutionalAlumniRecord,
  IInstitutionalAlumniRecord,
} from './institutionalRecord.model.js';
import { AppError } from '../../middleware/errorHandler.js';
import { createAuditEntry } from '../audit/audit.service.js';
import type {
  CsvImportPreviewDTO,
  CsvImportResultDTO,
  RowValidationError,
  ValidatedInstitutionalRecord,
} from './verification.types.js';

export const REQUIRED_CSV_HEADERS = [
  'alumni_id',
  'full_name',
  'institutional_email',
  'programme',
  'department',
  'graduation_year',
] as const;

export const MAX_CSV_ROWS = 5000;
export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

interface ParsedCsvResult {
  validRecords: ValidatedInstitutionalRecord[];
  errors: RowValidationError[];
  duplicateCount: number;
  totalRows: number;
}

/**
 * Parses and validates raw CSV buffer or string in memory.
 */
export function parseAndValidateCsv(fileBuffer: Buffer | string): ParsedCsvResult {
  const content = typeof fileBuffer === 'string' ? fileBuffer : fileBuffer.toString('utf-8');

  let rawRows: Record<string, string>[];
  try {
    rawRows = parse(content, {
      columns: header => header.map((h: string) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: false,
    });
  } catch {
    throw new AppError(
      'Malformed CSV format. Please ensure valid comma-delimited columns and correct quotation.',
      400,
      'CSV_PARSE_ERROR'
    );
  }

  if (rawRows.length === 0) {
    throw new AppError(
      'The uploaded CSV file is empty. Please provide a file with a header and data rows.',
      400,
      'EMPTY_CSV'
    );
  }

  if (rawRows.length > MAX_CSV_ROWS) {
    throw new AppError(
      `File exceeds maximum allowable limit of ${MAX_CSV_ROWS} rows per import.`,
      400,
      'ROW_LIMIT_EXCEEDED'
    );
  }

  // Validate headers
  const firstRow = rawRows[0];
  const presentHeaders = Object.keys(firstRow);
  const missingHeaders = REQUIRED_CSV_HEADERS.filter(h => !presentHeaders.includes(h));

  if (missingHeaders.length > 0) {
    throw new AppError(
      `Missing required CSV headers: ${missingHeaders.join(', ')}. Expected headers are: ${REQUIRED_CSV_HEADERS.join(', ')}`,
      400,
      'INVALID_CSV_HEADERS'
    );
  }

  const validRecords: ValidatedInstitutionalRecord[] = [];
  const errors: RowValidationError[] = [];
  const seenAlumniIds = new Set<string>();
  let duplicateCount = 0;

  const currentYear = new Date().getFullYear();

  for (let index = 0; index < rawRows.length; index++) {
    const rowNumber = index + 2; // header is row 1
    const row = rawRows[index];

    const alumniId = (row.alumni_id || '').trim().toUpperCase();
    const fullName = (row.full_name || '').trim();
    const institutionalEmail = (row.institutional_email || '').trim().toLowerCase();
    const programme = (row.programme || '').trim();
    const department = (row.department || '').trim();
    const rawGradYear = (row.graduation_year || '').toString().trim();

    // Field presence checks
    if (!alumniId) {
      errors.push({ rowNumber, reason: 'alumni_id is missing or empty' });
      continue;
    }
    if (!fullName || fullName.length < 2) {
      errors.push({ rowNumber, alumniId, reason: 'full_name must be at least 2 characters' });
      continue;
    }
    if (!institutionalEmail || !EMAIL_REGEX.test(institutionalEmail)) {
      errors.push({
        rowNumber,
        alumniId,
        reason: `Invalid institutional_email format: "${institutionalEmail}"`,
      });
      continue;
    }
    if (!programme) {
      errors.push({ rowNumber, alumniId, reason: 'programme is missing' });
      continue;
    }
    if (!department) {
      errors.push({ rowNumber, alumniId, reason: 'department is missing' });
      continue;
    }

    const graduationYear = parseInt(rawGradYear, 10);
    if (isNaN(graduationYear) || graduationYear < 1950 || graduationYear > currentYear + 1) {
      errors.push({
        rowNumber,
        alumniId,
        reason: `graduation_year must be between 1950 and ${currentYear + 1}. Received "${rawGradYear}"`,
      });
      continue;
    }

    // Check duplicate alumniId in the file
    if (seenAlumniIds.has(alumniId)) {
      duplicateCount++;
      errors.push({
        rowNumber,
        alumniId,
        reason: `Duplicate alumni_id "${alumniId}" found in uploaded file.`,
      });
      continue;
    }

    seenAlumniIds.add(alumniId);

    validRecords.push({
      alumniId,
      fullName,
      institutionalEmail,
      programme,
      department,
      graduationYear,
    });
  }

  return {
    validRecords,
    errors,
    duplicateCount,
    totalRows: rawRows.length,
  };
}

/**
 * Step A: Preview import without database mutation.
 */
export async function previewCsvImport(fileBuffer: Buffer | string): Promise<CsvImportPreviewDTO> {
  const { validRecords, errors, duplicateCount, totalRows } = parseAndValidateCsv(fileBuffer);

  // Check for potential conflicts with already claimed records in DB
  let existingConflictsCount = 0;
  if (validRecords.length > 0) {
    const ids = validRecords.map(r => r.alumniId);
    const claimedExisting = await InstitutionalAlumniRecord.find({
      alumniId: { $in: ids },
      isClaimed: true,
    })
      .select('alumniId')
      .lean();

    existingConflictsCount = claimedExisting.length;
  }

  return {
    totalRows,
    validRowsCount: validRecords.length,
    invalidRowsCount: errors.length,
    duplicateRowsCount: duplicateCount,
    existingConflictsCount,
    previewRecords: validRecords.slice(0, 10),
    errors: errors.slice(0, 50), // Return up to 50 row errors for UI inspection
  };
}

/**
 * Step B: Confirm import with full validation, atomic bulk writes, and audit trail.
 */
export async function confirmCsvImport(
  fileBuffer: Buffer | string,
  officerId: string,
  officerRole: string,
  requestId?: string
): Promise<CsvImportResultDTO> {
  const { validRecords, errors, totalRows } = parseAndValidateCsv(fileBuffer);

  if (errors.length > 0) {
    throw new AppError(
      `Cannot import CSV with ${errors.length} validation error(s). Please review the preview, fix the errors, and try again.`,
      400,
      'CSV_VALIDATION_FAILED'
    );
  }

  if (validRecords.length === 0) {
    throw new AppError('No valid records found to import.', 400, 'NO_RECORDS_TO_IMPORT');
  }

  const batchId = `BATCH-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const officerObjectId = new Types.ObjectId(officerId);

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  // Fetch existing records for these IDs to determine insert vs update vs skip
  const candidateIds = validRecords.map(r => r.alumniId);
  const existingRecords = await InstitutionalAlumniRecord.find({
    alumniId: { $in: candidateIds },
  });

  const existingMap = new Map<string, IInstitutionalAlumniRecord>();
  for (const rec of existingRecords) {
    existingMap.set(rec.alumniId, rec);
  }

  const bulkOps = [];

  for (const record of validRecords) {
    const existing = existingMap.get(record.alumniId);

    if (!existing) {
      // New record -> Insert
      bulkOps.push({
        insertOne: {
          document: {
            alumniId: record.alumniId,
            fullName: record.fullName,
            institutionalEmail: record.institutionalEmail,
            programme: record.programme,
            department: record.department,
            graduationYear: record.graduationYear,
            importBatchId: batchId,
            importedBy: officerObjectId,
            isClaimed: false,
          },
        },
      });
      insertedCount++;
    } else if (existing.isClaimed) {
      // Already claimed by verified alumni -> Skip modifying claimed records
      skippedCount++;
    } else {
      // Existing unclaimed record -> Update with latest master data
      bulkOps.push({
        updateOne: {
          filter: { alumniId: record.alumniId, isClaimed: false },
          update: {
            $set: {
              fullName: record.fullName,
              institutionalEmail: record.institutionalEmail,
              programme: record.programme,
              department: record.department,
              graduationYear: record.graduationYear,
              importBatchId: batchId,
              importedBy: officerObjectId,
            },
          },
        },
      });
      updatedCount++;
    }
  }

  if (bulkOps.length > 0) {
    await InstitutionalAlumniRecord.bulkWrite(bulkOps, { ordered: false });
  }

  // Record Audit Event
  await createAuditEntry({
    actorId: officerId,
    actorRole: officerRole,
    action: 'RECORDS_IMPORTED',
    entityType: 'institutional_record',
    entityId: batchId,
    requestId,
    metadata: {
      batchId,
      totalRows,
      insertedCount,
      updatedCount,
      skippedCount,
    },
  });

  return {
    batchId,
    totalProcessed: totalRows,
    insertedCount,
    updatedCount,
    skippedCount,
    failedCount: 0,
  };
}
