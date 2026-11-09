/**
 * audit.model.ts
 * Mongoose model for system audit logs.
 * Append-only security and compliance log for verification actions and administrative changes.
 */

import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import type { AuditAction, AuditEntityType } from '../verification/verification.types.js';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actorId: Types.ObjectId;
  actorRole: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  reason?: string;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Actor ID is required'],
    },
    actorRole: {
      type: String,
      required: [true, 'Actor role is required'],
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      index: true,
    },
    entityType: {
      type: String,
      required: [true, 'Entity type is required'],
      index: true,
    },
    entityId: {
      type: String,
      required: [true, 'Entity ID is required'],
      index: true,
    },
    requestId: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    reason: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ actorId: 1, timestamp: -1 });

export const AuditLog: Model<IAuditLog> = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
