/**
 * verification.controller.ts
 * HTTP route handlers for the /api/v1/verification namespace.
 */

import { Request, Response, NextFunction } from 'express';
import {
  verificationSubmitSchema,
  verificationRejectSchema,
  queueQuerySchema,
} from './verification.schemas.js';
import {
  getAlumniVerificationStatus,
  submitVerification,
  getOfficerVerificationQueue,
  getVerificationDetailForOfficer,
  approveVerification,
  rejectVerification,
  getVerificationMetrics,
} from './verification.service.js';
import { previewCsvImport, confirmCsvImport } from './csv.service.js';
import { AppError } from '../../middleware/errorHandler.js';

/**
 * GET /api/v1/verification/me
 * Retrieve current authenticated alumnus's latest verification status.
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED');
    }

    const verification = await getAlumniVerificationStatus(req.user.id);

    res.status(200).json({
      success: true,
      data: { verification },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/verification/submit
 * Submit or resubmit alumni verification request.
 */
export async function submit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED');
    }

    const parsed = verificationSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    const verification = await submitVerification(req.user.id, parsed.data, req.id?.toString());

    res.status(201).json({
      success: true,
      data: { verification },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/verification/officer/metrics
 * Overview counters for officer dashboard.
 */
export async function getMetrics(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const metrics = await getVerificationMetrics();
    res.status(200).json({
      success: true,
      data: { metrics },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/verification/officer/queue
 * Paginated verification requests queue for review.
 */
export async function getQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsedQuery = queueQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      next(parsedQuery.error);
      return;
    }

    const result = await getOfficerVerificationQueue(parsedQuery.data);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/verification/officer/:id
 * Retrieve full detail view of a single verification request with matching cross-check.
 */
export async function getDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const detail = await getVerificationDetailForOfficer(id);

    res.status(200).json({
      success: true,
      data: { verification: detail },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/verification/officer/:id/approve
 * Approve a pending, matched verification request.
 */
export async function approve(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED');
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const verification = await approveVerification(
      id,
      req.user.id,
      req.user.role,
      req.id?.toString()
    );

    res.status(200).json({
      success: true,
      data: { verification },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/verification/officer/:id/reject
 * Reject a pending verification request with mandatory reason.
 */
export async function reject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED');
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parsed = verificationRejectSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    const verification = await rejectVerification(
      id,
      parsed.data.reason,
      req.user.id,
      req.user.role,
      req.id?.toString()
    );

    res.status(200).json({
      success: true,
      data: { verification },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/verification/officer/records/import/preview
 * Parse and preview CSV file without database modification.
 */
export async function previewCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file || !req.file.buffer) {
      throw new AppError(
        'Please upload a valid .csv file using the "file" form field.',
        400,
        'MISSING_FILE'
      );
    }

    const preview = await previewCsvImport(req.file.buffer);

    res.status(200).json({
      success: true,
      data: { preview },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/verification/officer/records/import
 * Re-validate and confirm official institutional records import.
 */
export async function confirmCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED');
    }

    if (!req.file || !req.file.buffer) {
      throw new AppError(
        'Please upload a valid .csv file using the "file" form field.',
        400,
        'MISSING_FILE'
      );
    }

    const result = await confirmCsvImport(
      req.file.buffer,
      req.user.id,
      req.user.role,
      req.id?.toString()
    );

    res.status(200).json({
      success: true,
      data: { result },
    });
  } catch (err) {
    next(err);
  }
}
