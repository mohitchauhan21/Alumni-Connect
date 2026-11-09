/**
 * verification.service.ts
 * Core business logic for Alumni Institutional Verification workflows.
 *
 * Handles:
 * - Applicant submission and resubmission
 * - Deterministic matching execution
 * - Officer verification queue, filtering, and detail inspections
 * - Concurrency-safe approval and mandatory-reason rejection
 * - Audit logging
 */

import { Types } from 'mongoose';
import { AlumniVerification } from './verification.model.js';
import { InstitutionalAlumniRecord } from './institutionalRecord.model.js';
import { User } from '../auth/user.model.js';
import { evaluateInstitutionalMatch } from './matching.service.js';
import { AppError } from '../../middleware/errorHandler.js';
import { createAuditEntry } from '../audit/audit.service.js';
import type {
  AlumniVerificationDTO,
  OfficerVerificationDetailDTO,
  OfficerQueueItemDTO,
  VerificationMetricsDTO,
  VerificationSubmitInput,
  VerificationStatus,
  MatchingResult,
} from './verification.types.js';

export function toAlumniVerificationDTO(doc: {
  _id: Types.ObjectId | string;
  alumniId: string;
  institutionalEmail: string;
  programme: string;
  department: string;
  graduationYear: number;
  status: VerificationStatus;
  matchingResult: MatchingResult;
  submissionVersion: number;
  submittedAt: Date;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
}): AlumniVerificationDTO {
  return {
    id: doc._id.toString(),
    alumniId: doc.alumniId,
    institutionalEmail: doc.institutionalEmail,
    programme: doc.programme,
    department: doc.department,
    graduationYear: doc.graduationYear,
    status: doc.status,
    matchingResult: doc.matchingResult,
    submissionVersion: doc.submissionVersion,
    submittedAt: doc.submittedAt.toISOString(),
    reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : undefined,
    rejectionReason: doc.rejectionReason ?? undefined,
  };
}

/**
 * Retrieve current user's latest verification status.
 */
export async function getAlumniVerificationStatus(
  userId: string
): Promise<AlumniVerificationDTO | null> {
  const latest = await AlumniVerification.findOne({
    userId: new Types.ObjectId(userId),
  }).sort({ submittedAt: -1 });

  return latest ? toAlumniVerificationDTO(latest) : null;
}

/**
 * Submit or resubmit alumni verification request.
 */
export async function submitVerification(
  userId: string,
  input: VerificationSubmitInput,
  requestId?: string
): Promise<AlumniVerificationDTO> {
  const userObjectId = new Types.ObjectId(userId);

  // Verify that applicant has 'alumni' role
  const user = await User.findById(userObjectId);
  if (!user || user.role !== 'alumni') {
    throw new AppError(
      'Only registered alumni accounts can submit institutional verification requests.',
      403,
      'FORBIDDEN_ROLE'
    );
  }

  // Check if an existing verified submission exists
  const existingVerified = await AlumniVerification.findOne({
    userId: userObjectId,
    status: 'verified',
  });

  if (existingVerified) {
    throw new AppError(
      'Your institutional alumni status is already verified. Re-submission is not permitted.',
      400,
      'ALREADY_VERIFIED'
    );
  }

  // Check if a pending submission is already in progress
  const existingPending = await AlumniVerification.findOne({
    userId: userObjectId,
    status: 'pending',
  });

  if (existingPending) {
    throw new AppError(
      'You already have a pending verification request undergoing officer review.',
      409,
      'VERIFICATION_PENDING_EXISTS'
    );
  }

  // Calculate submission version
  const previousSubmissionsCount = await AlumniVerification.countDocuments({
    userId: userObjectId,
  });
  const submissionVersion = previousSubmissionsCount + 1;
  const isResubmission = previousSubmissionsCount > 0;

  // Execute deterministic matching against official registry
  const evaluation = await evaluateInstitutionalMatch(input);

  const verificationDoc = await AlumniVerification.create({
    userId: userObjectId,
    alumniId: input.alumniId.trim().toUpperCase(),
    institutionalEmail: input.institutionalEmail.trim().toLowerCase(),
    programme: input.programme.trim(),
    department: input.department.trim(),
    graduationYear: Number(input.graduationYear),
    status: 'pending',
    matchingResult: evaluation.result,
    matchingDetails: evaluation.details,
    matchedRecordId: evaluation.matchedRecord ? evaluation.matchedRecord._id : null,
    submissionVersion,
    submittedAt: new Date(),
  });

  // Audit event
  await createAuditEntry({
    actorId: userId,
    actorRole: user.role,
    action: isResubmission ? 'VERIFICATION_RESUBMITTED' : 'VERIFICATION_SUBMITTED',
    entityType: 'verification',
    entityId: verificationDoc._id.toString(),
    requestId,
    metadata: {
      alumniId: verificationDoc.alumniId,
      submissionVersion,
      matchingResult: evaluation.result,
    },
  });

  return toAlumniVerificationDTO(verificationDoc);
}

/**
 * List verification requests for officer review queue.
 */
export async function getOfficerVerificationQueue(params: {
  page?: number;
  limit?: number;
  status?: VerificationStatus;
  matchingResult?: MatchingResult;
  search?: string;
}): Promise<{ items: OfficerQueueItemDTO[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (params.status) {
    filter.status = params.status;
  }
  if (params.matchingResult) {
    filter.matchingResult = params.matchingResult;
  }
  if (params.search && params.search.trim().length > 0) {
    const searchRegex = new RegExp(params.search.trim(), 'i');
    filter.$or = [
      { alumniId: searchRegex },
      { institutionalEmail: searchRegex },
      { programme: searchRegex },
      { department: searchRegex },
    ];
  }

  const [items, total] = await Promise.all([
    AlumniVerification.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate<{ userId: { fullName: string; email: string } }>('userId', 'fullName email')
      .lean(),
    AlumniVerification.countDocuments(filter),
  ]);

  const queueItems: OfficerQueueItemDTO[] = items.map(doc => ({
    id: doc._id.toString(),
    userId: doc.userId
      ? (doc.userId as unknown as { _id: Types.ObjectId })._id?.toString() || ''
      : '',
    applicantName: doc.userId ? doc.userId.fullName : 'Unknown Applicant',
    applicantEmail: doc.userId ? doc.userId.email : '',
    alumniId: doc.alumniId,
    programme: doc.programme,
    department: doc.department,
    graduationYear: doc.graduationYear,
    status: doc.status,
    matchingResult: doc.matchingResult,
    submissionVersion: doc.submissionVersion,
    submittedAt: doc.submittedAt.toISOString(),
    reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : undefined,
  }));

  return {
    items: queueItems,
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Detailed view of one verification request with matching details and institutional evidence.
 */
export async function getVerificationDetailForOfficer(
  verificationId: string
): Promise<OfficerVerificationDetailDTO> {
  const doc = await AlumniVerification.findById(verificationId)
    .populate<{ userId: { fullName: string; email: string } }>('userId', 'fullName email')
    .populate<{
      matchedRecordId: {
        _id: Types.ObjectId;
        alumniId: string;
        fullName: string;
        institutionalEmail: string;
        programme: string;
        department: string;
        graduationYear: number;
      };
    }>('matchedRecordId')
    .populate<{ reviewedBy: { fullName: string; email: string } }>('reviewedBy', 'fullName email');

  if (!doc) {
    throw new AppError('Verification request not found.', 404, 'NOT_FOUND');
  }

  const base = toAlumniVerificationDTO(doc);

  return {
    ...base,
    userId: doc.userId
      ? (doc.userId as unknown as { _id: Types.ObjectId })._id?.toString() || ''
      : '',
    applicantName: doc.userId ? doc.userId.fullName : 'Unknown Applicant',
    applicantAccountEmail: doc.userId ? doc.userId.email : '',
    matchingDetails: doc.matchingDetails,
    matchedRecord: doc.matchedRecordId
      ? {
          id: doc.matchedRecordId._id.toString(),
          alumniId: doc.matchedRecordId.alumniId,
          fullName: doc.matchedRecordId.fullName,
          institutionalEmail: doc.matchedRecordId.institutionalEmail,
          programme: doc.matchedRecordId.programme,
          department: doc.matchedRecordId.department,
          graduationYear: doc.matchedRecordId.graduationYear,
        }
      : null,
    reviewedByOfficer: doc.reviewedBy
      ? {
          id: (doc.reviewedBy as unknown as { _id: Types.ObjectId })._id.toString(),
          fullName: doc.reviewedBy.fullName,
          email: doc.reviewedBy.email,
        }
      : null,
  };
}

/**
 * Approve a pending, matched verification request.
 * Concurrency-safe: atomically sets isClaimed on the institutional record.
 */
export async function approveVerification(
  verificationId: string,
  officerId: string,
  officerRole: string,
  requestId?: string
): Promise<AlumniVerificationDTO> {
  const verification = await AlumniVerification.findById(verificationId);
  if (!verification) {
    throw new AppError('Verification request not found.', 404, 'NOT_FOUND');
  }

  if (verification.status !== 'pending') {
    throw new AppError(
      `Cannot approve request with current status "${verification.status}". Only pending requests can be reviewed.`,
      400,
      'INVALID_STATUS_FOR_APPROVAL'
    );
  }

  if (verification.matchingResult !== 'matched' || !verification.matchedRecordId) {
    throw new AppError(
      'Cannot approve an alumni verification request with unmatched or conflicting records. A unique official institutional match is strictly required.',
      400,
      'MATCH_REQUIRED_FOR_APPROVAL'
    );
  }

  // Atomic claim check on the institutional record
  const claimedRecord = await InstitutionalAlumniRecord.findOneAndUpdate(
    {
      _id: verification.matchedRecordId,
      $or: [
        { isClaimed: false },
        { claimedBy: verification.userId }, // Allow if already assigned to this user
      ],
    },
    {
      $set: {
        isClaimed: true,
        claimedBy: verification.userId,
        claimedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!claimedRecord) {
    throw new AppError(
      'This institutional record has already been claimed by another verified alumni account.',
      409,
      'RECORD_ALREADY_CLAIMED'
    );
  }

  const officerObjectId = new Types.ObjectId(officerId);
  verification.status = 'verified';
  verification.reviewedBy = officerObjectId;
  verification.reviewedAt = new Date();
  verification.rejectionReason = null;
  await verification.save();

  // Audit event
  await createAuditEntry({
    actorId: officerId,
    actorRole: officerRole,
    action: 'VERIFICATION_APPROVED',
    entityType: 'verification',
    entityId: verification._id.toString(),
    requestId,
    metadata: {
      userId: verification.userId.toString(),
      alumniId: verification.alumniId,
      matchedRecordId: verification.matchedRecordId.toString(),
    },
  });

  return toAlumniVerificationDTO(verification);
}

/**
 * Reject a pending verification request with mandatory reason.
 */
export async function rejectVerification(
  verificationId: string,
  reason: string,
  officerId: string,
  officerRole: string,
  requestId?: string
): Promise<AlumniVerificationDTO> {
  const trimmedReason = (reason || '').trim();
  if (!trimmedReason || trimmedReason.length < 5) {
    throw new AppError(
      'A meaningful rejection reason (minimum 5 characters) is required.',
      400,
      'REJECTION_REASON_REQUIRED'
    );
  }

  const verification = await AlumniVerification.findById(verificationId);
  if (!verification) {
    throw new AppError('Verification request not found.', 404, 'NOT_FOUND');
  }

  if (verification.status !== 'pending') {
    throw new AppError(
      `Cannot reject request with status "${verification.status}". Only pending requests can be reviewed.`,
      400,
      'INVALID_STATUS_FOR_REJECTION'
    );
  }

  const officerObjectId = new Types.ObjectId(officerId);
  verification.status = 'rejected';
  verification.rejectionReason = trimmedReason;
  verification.reviewedBy = officerObjectId;
  verification.reviewedAt = new Date();
  await verification.save();

  // Audit event
  await createAuditEntry({
    actorId: officerId,
    actorRole: officerRole,
    action: 'VERIFICATION_REJECTED',
    entityType: 'verification',
    entityId: verification._id.toString(),
    requestId,
    reason: trimmedReason,
    metadata: {
      userId: verification.userId.toString(),
      alumniId: verification.alumniId,
    },
  });

  return toAlumniVerificationDTO(verification);
}

/**
 * Overview metrics for officer dashboard.
 */
export async function getVerificationMetrics(): Promise<VerificationMetricsDTO> {
  const [pendingCount, verifiedCount, rejectedCount, totalRecordsCount] = await Promise.all([
    AlumniVerification.countDocuments({ status: 'pending' }),
    AlumniVerification.countDocuments({ status: 'verified' }),
    AlumniVerification.countDocuments({ status: 'rejected' }),
    InstitutionalAlumniRecord.countDocuments(),
  ]);

  return {
    pendingCount,
    verifiedCount,
    rejectedCount,
    totalRecordsCount,
  };
}
