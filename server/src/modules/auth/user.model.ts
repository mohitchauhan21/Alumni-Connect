/**
 * user.model.ts
 * Mongoose User schema and model for the P11 Mentorship Platform.
 *
 * Design notes:
 * - Email is normalized (trimmed + lowercased) at schema level before save.
 * - passwordHash is excluded from default queries (select: false).
 *   Must be explicitly selected when verifying credentials.
 * - Account status is separate from alumni verification status (Phase 3).
 * - No unnecessary profile fields; those belong in future student/alumni modules.
 */

import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { UserRole, AccountStatus } from './auth.types.js';

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  fullName: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
  /** Instance method: compare a plain-text password against the stored hash. */
  comparePassword(plain: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [80, 'Full name must not exceed 80 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email address is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },

    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // never returned by default queries
    },

    role: {
      type: String,
      enum: {
        values: ['student', 'alumni', 'alumni_officer', 'placement_officer', 'admin'],
        message: 'Role must be one of: student, alumni, alumni_officer, placement_officer, admin',
      },
      required: [true, 'Role is required'],
    },

    accountStatus: {
      type: String,
      enum: {
        values: ['active', 'disabled', 'suspended'],
        message: 'Account status must be one of: active, disabled, suspended',
      },
      default: 'active',
    },
  },
  {
    timestamps: true, // createdAt + updatedAt
    versionKey: false,
  }
);

/**
 * Instance method: constant-time comparison against the stored hash.
 * Requires passwordHash to be explicitly selected.
 */
userSchema.methods.comparePassword = async function (plain: string): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash);
};

export const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
