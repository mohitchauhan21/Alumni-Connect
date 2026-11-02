/**
 * verification.router.ts
 * Routes for the /api/v1/verification namespace.
 *
 * RBAC Rules:
 * - Alumni routes: accessible only to authenticated users with role === 'alumni'.
 * - Officer routes: accessible only to 'alumni_officer' or 'admin'.
 * - Students, unverified users, and placement officers are strictly denied from officer routes (HTTP 403).
 */

import { Router } from 'express';
import {
  getMe,
  submit,
  getMetrics,
  getQueue,
  getDetail,
  approve,
  reject,
  previewCsv,
  confirmCsv,
} from './verification.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';
import { csvUpload } from '../../middleware/upload.js';

export const verificationRouter = Router();

// ==========================================
// Alumni Routes (role === 'alumni')
// ==========================================
verificationRouter.get('/me', authenticate, requireRole('alumni'), getMe);
verificationRouter.post('/submit', authenticate, requireRole('alumni'), submit);

// ==========================================
// Officer & Admin Routes (role in ['alumni_officer', 'admin'])
// ==========================================
verificationRouter.get(
  '/officer/metrics',
  authenticate,
  requireRole('alumni_officer', 'admin'),
  getMetrics
);

verificationRouter.get(
  '/officer/queue',
  authenticate,
  requireRole('alumni_officer', 'admin'),
  getQueue
);

verificationRouter.get(
  '/officer/:id',
  authenticate,
  requireRole('alumni_officer', 'admin'),
  getDetail
);

verificationRouter.post(
  '/officer/:id/approve',
  authenticate,
  requireRole('alumni_officer', 'admin'),
  approve
);

verificationRouter.post(
  '/officer/:id/reject',
  authenticate,
  requireRole('alumni_officer', 'admin'),
  reject
);

verificationRouter.post(
  '/officer/records/import/preview',
  authenticate,
  requireRole('alumni_officer', 'admin'),
  csvUpload.single('file'),
  previewCsv
);

verificationRouter.post(
  '/officer/records/import',
  authenticate,
  requireRole('alumni_officer', 'admin'),
  csvUpload.single('file'),
  confirmCsv
);

