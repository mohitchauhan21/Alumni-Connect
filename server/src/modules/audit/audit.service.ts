/**
 * audit.service.ts
 * Append-only audit logging service.
 * Records verification events, CSV imports, and administrative actions.
 */

import { Types } from 'mongoose';
import { AuditLog } from './audit.model.js';
import type { AuditAction, AuditEntityType } from '../verification/verification.types.js';
import { logger } from '../../config/logger.js';

export interface CreateAuditEntryInput {
  actorId: string | Types.ObjectId;
  actorRole: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  reason?: string;
}

export async function createAuditEntry(input: CreateAuditEntryInput): Promise<void> {
  try {
    await AuditLog.create({
      actorId: new Types.ObjectId(input.actorId.toString()),
      actorRole: input.actorRole,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      requestId: input.requestId ?? null,
      metadata: input.metadata ?? {},
      reason: input.reason ?? null,
      timestamp: new Date(),
    });
  } catch (err) {
    // Audit failure should not completely crash the application, but must be logged with high severity
    logger.error(
      { err: (err as Error).message, action: input.action, entityId: input.entityId },
      'Failed to persist audit log entry'
    );
  }
}

