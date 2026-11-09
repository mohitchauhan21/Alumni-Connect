/**
 * mentorshipOffer.model.ts
 * Mongoose schema and model for Alumni Mentorship Offerings.
 */

import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import type { OfferingStatus } from './mentorship.types.js';
import type { MentorshipMode } from '../profile/profile.types.js';

export interface IMentorshipOffer extends Document {
  _id: Types.ObjectId;
  alumniId: Types.ObjectId;
  title: string;
  description: string;
  topics: string[];
  targetAudience: string;
  mode: MentorshipMode;
  sessionDurationMinutes: number;
  maxMenteesCapacity: number;
  status: OfferingStatus;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const mentorshipOfferSchema = new Schema<IMentorshipOffer>(
  {
    alumniId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Alumni reference is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    topics: {
      type: [String],
      required: [true, 'At least one topic is required'],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length > 0,
        message: 'At least one topic must be specified',
      },
    },
    targetAudience: {
      type: String,
      required: [true, 'Target audience is required'],
      trim: true,
      maxlength: [200, 'Target audience cannot exceed 200 characters'],
    },
    mode: {
      type: String,
      enum: {
        values: ['online', 'in-person', 'hybrid'],
        message: 'Mode must be online, in-person, or hybrid',
      },
      required: [true, 'Mentorship mode is required'],
    },
    sessionDurationMinutes: {
      type: Number,
      enum: {
        values: [30, 45, 60, 90],
        message: 'Session duration must be 30, 45, 60, or 90 minutes',
      },
      required: [true, 'Session duration is required'],
      default: 45,
    },
    maxMenteesCapacity: {
      type: Number,
      required: [true, 'Maximum mentees capacity is required'],
      min: [1, 'Capacity must be at least 1 mentee'],
      max: [50, 'Capacity cannot exceed 50 mentees'],
      default: 5,
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'active', 'inactive'],
        message: 'Status must be draft, active, or inactive',
      },
      default: 'active',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

mentorshipOfferSchema.index({ status: 1, isDeleted: 1, alumniId: 1 });
mentorshipOfferSchema.index({ topics: 1 });

export const MentorshipOffer: Model<IMentorshipOffer> =
  mongoose.models.MentorshipOffer ||
  mongoose.model<IMentorshipOffer>('MentorshipOffer', mentorshipOfferSchema);
