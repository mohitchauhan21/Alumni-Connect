/**
 * verification.model.ts
 * Mongoose model for Alumni Institutional Verification submissions.
 *
 * Maintains the verification lifecycle:
 * not_submitted -> pending -> verified
 *              -> pending -> rejected -> pending (resubmission)
 *
 * Preserves past rejection histories; does NOT delete previous submissions.
 */

import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import type { VerificationStatus, MatchingResult, MatchingDetails } from './verification.types.js';

export interface IAlumniVerification extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  alumniId: string;
  institutionalEmail: string;
  programme: string;
  department: string;
  graduationYear: number;
  status: VerificationStatus;
  matchingResult: MatchingResult;
  matchingDetails: MatchingDetails;
  matchedRecordId?: Types.ObjectId | null;
  submissionVersion: number;
  submittedAt: Date;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const alumniVerificationSchema = new Schema<IAlumniVerification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    alumniId: {
      type: String,
      required: [true, 'Institutional Alumni ID is required'],
      trim: true,
      uppercase: true,
    },
    institutionalEmail: {
      type: String,
      required: [true, 'Institutional email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    programme: {
      type: String,
      required: [true, 'Programme is required'],
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    graduationYear: {
      type: Number,
      required: [true, 'Graduation year is required'],
      min: [1950, 'Graduation year cannot be earlier than 1950'],
      max: [2100, 'Graduation year cannot exceed 2100'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'verified', 'rejected'],
        message: 'Invalid verification status',
      },
      default: 'pending',
    },
    matchingResult: {
      type: String,
      enum: {
        values: ['matched', 'unmatched', 'conflict'],
        message: 'Invalid matching result',
      },
      required: true,
    },
    matchingDetails: {
      matchedFields: { type: [String], default: [] },
      conflictingFields: { type: [String], default: [] },
      notes: { type: String, default: '' },
    },
    matchedRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'InstitutionalAlumniRecord',
      default: null,
    },
    submissionVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes for query performance and data integrity
alumniVerificationSchema.index({ userId: 1, status: 1 });
alumniVerificationSchema.index({ status: 1, submittedAt: -1 });
alumniVerificationSchema.index({ matchedRecordId: 1 });
alumniVerificationSchema.index({ alumniId: 1 });

export const AlumniVerification: Model<IAlumniVerification> = mongoose.model<IAlumniVerification>(
  'AlumniVerification',
  alumniVerificationSchema
);
