/**
 * alumniProfile.model.ts
 * Mongoose schema and model for Alumni Professional Profiles.
 * Note: Institutional graduation details are authoritatively sourced
 * from AlumniVerification and are not stored/duplicated here.
 */

import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import type { MentorshipMode } from './profile.types.js';

export interface IAlumniProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  headline: string;
  currentDesignation: string;
  company: string;
  industry: string;
  yearsOfExperience: number;
  bio: string;
  skills: string[];
  areasOfExpertise: string[];
  mentorshipTopics: string[];
  languages: string[];
  preferredMentorshipMode: MentorshipMode;
  isPubliclyVisible: boolean;
  isDraft: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const alumniProfileSchema = new Schema<IAlumniProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    headline: {
      type: String,
      trim: true,
      default: '',
      maxlength: [140, 'Headline must not exceed 140 characters'],
    },
    currentDesignation: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Current designation must not exceed 100 characters'],
    },
    company: {
      type: String,
      trim: true,
      default: '',
      maxlength: [100, 'Company name must not exceed 100 characters'],
    },
    industry: {
      type: String,
      trim: true,
      default: '',
      maxlength: [80, 'Industry must not exceed 80 characters'],
    },
    yearsOfExperience: {
      type: Number,
      min: [0, 'Years of experience cannot be negative'],
      max: [70, 'Years of experience cannot exceed 70'],
      default: 0,
    },
    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Bio must not exceed 2000 characters'],
    },
    skills: {
      type: [String],
      default: [],
    },
    areasOfExpertise: {
      type: [String],
      default: [],
    },
    mentorshipTopics: {
      type: [String],
      default: [],
    },
    languages: {
      type: [String],
      default: ['English'],
    },
    preferredMentorshipMode: {
      type: String,
      enum: {
        values: ['online', 'in-person', 'hybrid'],
        message: 'Preferred mode must be online, in-person, or hybrid',
      },
      default: 'online',
    },
    isPubliclyVisible: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDraft: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

alumniProfileSchema.index({ isPubliclyVisible: 1, isDraft: 1 });

export const AlumniProfile: Model<IAlumniProfile> =
  mongoose.models.AlumniProfile ||
  mongoose.model<IAlumniProfile>('AlumniProfile', alumniProfileSchema);
