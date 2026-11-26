import mongoose, { Schema, Types } from 'mongoose';
import { DEPARTMENTS, MENTORING_AREAS, ROLES } from './constants.js';

const { model } = mongoose;
export const ObjectId = Schema.Types.ObjectId;
export type Id = Types.ObjectId;

/* ------------------------------------------------------------------ User */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // PRIVATE: contact details are never selected by default and never serialized for students.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, select: false },
    phone: { type: String, trim: true, select: false },
    // Optional: accounts created with "Sign in with Google" have no password.
    passwordHash: { type: String, select: false },
    // PRIVATE: Google account subject id, used only to recognise returning Google sign-ins.
    googleSub: { type: String, select: false, index: { unique: true, sparse: true } },
    avatarUrl: { type: String },
    role: { type: String, enum: ROLES, required: true, index: true },
    status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
    deletedAt: Date, // set when the person erased their account; the record stays as an anonymous placeholder
    notificationPrefs: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    timezone: { type: String, default: 'Asia/Kolkata' },
    lastLoginAt: Date,
    lastActiveAt: Date,

    // Set once the user proves they own the email: a confirmation link, Google sign-in or a password reset.
    emailVerifiedAt: { type: Date },
    // Bumped to sign the user out everywhere (password reset/change, two-factor changes). Sessions carry it.
    tokenVersion: { type: Number, default: 0 },

    // Two-factor sign-in (authenticator app). Keys are encrypted at rest and never sent again after setup.
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String, select: false },
    mfaPendingSecret: { type: String, select: false },
    mfaLastStep: { type: Number, select: false }, // last accepted time step, so a code can't be replayed
    mfaRecoveryCodes: { type: [String], select: false, default: undefined }, // SHA-256 hashes, one-time use
    mfaFailures: { type: Number, select: false },
    mfaLockedUntil: { type: Date, select: false },

    // Payment gateway customer id (Razorpay), so cards a student chose to save are offered at checkout.
    razorpayCustomerId: { type: String, select: false },
  },
  { timestamps: true },
);
export const User = model('User', userSchema);

/* ------------------------------------------------------- ExpertiseTag */
const expertiseTagSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    category: { type: String, default: 'General' },
  },
  { timestamps: true },
);
export const ExpertiseTag = model('ExpertiseTag', expertiseTagSchema);

/* ---------------------------------------------------- InstitutionRecord */
/** Mirror of the institution's ERP / alumni register, imported via CSV or ERP sync. */
const institutionRecordSchema = new Schema(
  {
    rollNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    fullName: { type: String, required: true },
    normalizedName: { type: String, required: true, index: true },
    graduationYear: { type: Number, required: true },
    degree: { type: String, required: true },
    department: { type: String, required: true },
    dateOfBirth: { type: String }, // ISO yyyy-mm-dd
    source: { type: String, default: 'csv_import' },
  },
  { timestamps: true },
);
export const InstitutionRecord = model('InstitutionRecord', institutionRecordSchema);

/* -------------------------------------------------------------- Alumnus */
const alumnusSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, unique: true },
    verificationStatus: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected'],
      default: 'unverified',
      index: true,
    },
    verifiedAt: Date,
    institutionRecord: { type: ObjectId, ref: 'InstitutionRecord' },
    mentorOptIn: { type: Boolean, default: true },
    /** Fee per session in whole rupees; 0 means free. Charged only when paid sessions are enabled. */
    sessionFee: { type: Number, min: 0, max: 100000, default: 0 },
    rollNumber: { type: String, uppercase: true, trim: true },
    graduationYear: Number,
    degree: String,
    department: { type: String, enum: [...DEPARTMENTS, ''] },
    headline: { type: String, maxlength: 140 },
    currentRole: String,
    currentCompany: String,
    industry: { type: String, index: true },
    yearsExperience: { type: Number, min: 0, max: 60 },
    city: String,
    bio: { type: String, maxlength: 2000 },
    expertise: [{ type: ObjectId, ref: 'ExpertiseTag' }],
    mentoringAreas: [{ type: String, enum: MENTORING_AREAS }],
    languages: [String],
    // PRIVATE: LinkedIn is the over-contact vector this platform replaces; staff-only.
    linkedinUrl: { type: String, select: false },
  },
  { timestamps: true },
);
alumnusSchema.index({ verificationStatus: 1, mentorOptIn: 1 });
export const Alumnus = model('Alumnus', alumnusSchema);

/* ---------------------------------------------------- VerificationRequest */
const verificationHistorySchema = new Schema(
  {
    status: String,
    by: { type: ObjectId, ref: 'User' },
    byName: String,
    note: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);
const verificationRequestSchema = new Schema(
  {
    alumnus: { type: ObjectId, ref: 'Alumnus', required: true, index: true },
    user: { type: ObjectId, ref: 'User', required: true },
    submitted: {
      fullName: String,
      rollNumber: String,
      graduationYear: Number,
      degree: String,
      department: String,
      dateOfBirth: String,
    },
    documents: [
      {
        originalName: String,
        storedName: String,
        mimeType: String,
        size: Number,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    matchResult: {
      matched: Boolean,
      confidence: Number, // 0..1
      record: { type: ObjectId, ref: 'InstitutionRecord' },
      matchedFields: [String],
      mismatchedFields: [String],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'needs_info'],
      default: 'pending',
      index: true,
    },
    reviewer: { type: ObjectId, ref: 'User' },
    reviewNote: String,
    decidedAt: Date,
    history: [verificationHistorySchema],
  },
  { timestamps: true },
);
export const VerificationRequest = model('VerificationRequest', verificationRequestSchema);

/* -------------------------------------------------------- MentorCapacity */
/**
 * One document per mentor. `activeCount` is only ever changed through conditional
 * atomic updates (see services/capacity.ts) so concurrent acceptances cannot exceed `maxMentees`.
 */
const mentorCapacitySchema = new Schema(
  {
    alumnus: { type: ObjectId, ref: 'Alumnus', required: true, unique: true },
    maxMentees: { type: Number, required: true, min: 0, max: 10, default: 2 },
    activeCount: { type: Number, required: true, min: 0, default: 0 },
    /** Mentor-side intake protection: max open (pending) requests before they stop appearing in discovery. */
    maxPendingRequests: { type: Number, min: 1, max: 30, default: 5 },
    paused: { type: Boolean, default: false },
    pausedUntil: Date,
    pauseReason: String,
  },
  { timestamps: true },
);
export const MentorCapacity = model('MentorCapacity', mentorCapacitySchema);

/* ---------------------------------------------------- AvailabilityWindow */
const availabilityWindowSchema = new Schema(
  {
    alumnus: { type: ObjectId, ref: 'Alumnus', required: true, index: true },
    dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0 = Sunday
    startMinute: { type: Number, min: 0, max: 1439, required: true },
    endMinute: { type: Number, min: 1, max: 1440, required: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    validFrom: Date,
    validTo: Date,
  },
  { timestamps: true },
);
export const AvailabilityWindow = model('AvailabilityWindow', availabilityWindowSchema);

/* ------------------------------------------------------ StudentProfile */
const studentProfileSchema = new Schema(
  {
    user: { type: ObjectId, ref: 'User', required: true, unique: true },
    rollNumber: { type: String, uppercase: true, trim: true },
    program: String,
    department: { type: String, enum: [...DEPARTMENTS, ''] },
    graduationYear: Number,
    bio: { type: String, maxlength: 1500 },
    interests: [{ type: ObjectId, ref: 'ExpertiseTag' }],
    targetRoles: [String],
    targetIndustries: [String],
    mentoringAreasWanted: [{ type: String, enum: MENTORING_AREAS }],
  },
  { timestamps: true },
);
export const StudentProfile = model('StudentProfile', studentProfileSchema);

/* ---------------------------------------------------------- CareerGoal */
const careerGoalSchema = new Schema(
  {
    student: { type: ObjectId, ref: 'StudentProfile', required: true, index: true },
    title: { type: String, required: true, maxlength: 160 },
    description: { type: String, maxlength: 1500 },
    targetRole: String,
    targetIndustry: String,
    timeframe: { type: String, enum: ['3_months', '6_months', '1_year', '2_years_plus'], default: '1_year' },
    priority: { type: Number, min: 1, max: 3, default: 2 },
  },
  { timestamps: true },
);
export const CareerGoal = model('CareerGoal', careerGoalSchema);

/* ---------------------------------------------------- PlacementOutcome */
/** Placement office data, used only in aggregate for correlation reporting. */
const placementOutcomeSchema = new Schema(
  {
    student: { type: ObjectId, ref: 'StudentProfile', required: true, unique: true },
    status: { type: String, enum: ['placed', 'not_placed', 'higher_studies', 'opted_out'], required: true },
    company: String,
    role: String,
    industry: String,
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
export const PlacementOutcome = model('PlacementOutcome', placementOutcomeSchema);
