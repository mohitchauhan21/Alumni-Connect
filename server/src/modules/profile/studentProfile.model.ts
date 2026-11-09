/**
 * studentProfile.model.ts
 * Mongoose schema and model for Student Profiles.
 */

import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import type { MentorshipMode } from './profile.types.js';

export interface IStudentProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  programme: string;
  department: string;
  graduationYear: number;
  academicInterests: string[];
  skills: string[];
  careerInterests: string[];
  careerGoals: string;
  preferredMentorshipTopics: string[];
  preferredMentorshipMode: MentorshipMode;
  bio: string;
  createdAt: Date;
  updatedAt: Date;
}

const studentProfileSchema = new Schema<IStudentProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      unique: true,
      index: true,
    },
    programme: {
      type: String,
      trim: true,
      default: '',
      maxlength: [120, 'Programme name must not exceed 120 characters'],
    },
    department: {
      type: String,
      trim: true,
      default: '',
      maxlength: [120, 'Department must not exceed 120 characters'],
    },
    graduationYear: {
      type: Number,
      min: [1950, 'Graduation year cannot be earlier than 1950'],
      max: [2040, 'Graduation year cannot be later than 2040'],
      default: () => new Date().getFullYear() + 1,
    },
    academicInterests: {
      type: [String],
      default: [],
    },
    skills: {
      type: [String],
      default: [],
    },
    careerInterests: {
      type: [String],
      default: [],
    },
    careerGoals: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Career goals must not exceed 1000 characters'],
    },
    preferredMentorshipTopics: {
      type: [String],
      default: [],
    },
    preferredMentorshipMode: {
      type: String,
      enum: {
        values: ['online', 'in-person', 'hybrid'],
        message: 'Preferred mode must be online, in-person, or hybrid',
      },
      default: 'online',
    },
    bio: {
      type: String,
      trim: true,
      default: '',
      maxlength: [1000, 'Bio must not exceed 1000 characters'],
    },
  },
  {
    timestamps: true,
  }
);

export const StudentProfile: Model<IStudentProfile> =
  mongoose.models.StudentProfile ||
  mongoose.model<IStudentProfile>('StudentProfile', studentProfileSchema);
