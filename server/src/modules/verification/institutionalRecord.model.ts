/**
 * institutionalRecord.model.ts
 * Mongoose model for official university alumni records.
 *
 * Source: Official institutional ERP or CSV data imports by Alumni Relations Officers/Admins.
 * Security: NEVER exposed directly through public endpoints or to students.
 */

import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IInstitutionalAlumniRecord extends Document {
  _id: Types.ObjectId;
  alumniId: string;
  fullName: string;
  institutionalEmail: string;
  programme: string;
  department: string;
  graduationYear: number;
  importBatchId: string;
  importedBy: Types.ObjectId;
  isClaimed: boolean;
  claimedBy?: Types.ObjectId;
  claimedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const institutionalRecordSchema = new Schema<IInstitutionalAlumniRecord>(
  {
    alumniId: {
      type: String,
      required: [true, 'Institutional Alumni ID is required'],
      trim: true,
      uppercase: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    institutionalEmail: {
      type: String,
      required: [true, 'Institutional email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
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
    importBatchId: {
      type: String,
      required: [true, 'Import batch ID is required'],
      trim: true,
    },
    importedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Importer user reference is required'],
    },
    isClaimed: {
      type: Boolean,
      default: false,
    },
    claimedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Indexes
institutionalRecordSchema.index({ alumniId: 1 }, { unique: true });
institutionalRecordSchema.index({ institutionalEmail: 1 });
institutionalRecordSchema.index({ isClaimed: 1 });

export const InstitutionalAlumniRecord: Model<IInstitutionalAlumniRecord> =
  mongoose.model<IInstitutionalAlumniRecord>(
    'InstitutionalAlumniRecord',
    institutionalRecordSchema
  );
