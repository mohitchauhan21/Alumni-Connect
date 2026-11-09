/**
 * profile.service.ts
 * Domain logic for Student and Alumni Profile Management.
 */

import { Types } from 'mongoose';
import { User } from '../auth/user.model.js';
import { StudentProfile, IStudentProfile } from './studentProfile.model.js';
import { AlumniProfile, IAlumniProfile } from './alumniProfile.model.js';
import { AlumniVerification } from '../verification/verification.model.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  StudentProfileDTO,
  StudentProfileInput,
  AlumniProfileDTO,
  AlumniProfileInput,
  PublicAlumniProfileDTO,
} from './profile.types.js';

/**
 * Server-calculated completion percentage for student profiles.
 * Never trusts frontend-supplied completion metrics.
 */
export function calculateStudentProfileCompletion(
  profile: Partial<IStudentProfile> | null
): number {
  if (!profile) return 0;
  let score = 0;

  // 1. Academic identity (30%)
  if (profile.programme && profile.programme.trim().length > 0) score += 10;
  if (profile.department && profile.department.trim().length > 0) score += 10;
  if (profile.graduationYear && profile.graduationYear >= 1950) score += 10;

  // 2. Skills & interests (30%)
  if (Array.isArray(profile.skills) && profile.skills.length > 0) score += 10;
  if (Array.isArray(profile.academicInterests) && profile.academicInterests.length > 0) score += 10;
  if (Array.isArray(profile.careerInterests) && profile.careerInterests.length > 0) score += 10;

  // 3. Goals & bio (20%)
  if (profile.careerGoals && profile.careerGoals.trim().length >= 10) score += 10;
  if (profile.bio && profile.bio.trim().length >= 10) score += 10;

  // 4. Mentorship preferences (20%)
  if (
    Array.isArray(profile.preferredMentorshipTopics) &&
    profile.preferredMentorshipTopics.length > 0
  )
    score += 10;
  if (profile.preferredMentorshipMode) score += 10;

  return Math.min(100, score);
}

/**
 * Server-calculated completion percentage for alumni professional profiles.
 */
export function calculateAlumniProfileCompletion(profile: Partial<IAlumniProfile> | null): number {
  if (!profile) return 0;
  let score = 0;

  // 1. Professional identity (40%)
  if (profile.headline && profile.headline.trim().length > 0) score += 10;
  if (profile.currentDesignation && profile.currentDesignation.trim().length > 0) score += 10;
  if (profile.company && profile.company.trim().length > 0) score += 10;
  if (profile.industry && profile.industry.trim().length > 0) score += 10;

  // 2. Experience & bio (20%)
  if (typeof profile.yearsOfExperience === 'number' && profile.yearsOfExperience >= 0) score += 10;
  if (profile.bio && profile.bio.trim().length >= 20) score += 10;

  // 3. Skills & expertise (20%)
  if (Array.isArray(profile.skills) && profile.skills.length > 0) score += 10;
  if (Array.isArray(profile.areasOfExpertise) && profile.areasOfExpertise.length > 0) score += 10;

  // 4. Mentorship topics & languages (20%)
  if (Array.isArray(profile.mentorshipTopics) && profile.mentorshipTopics.length > 0) score += 10;
  if (Array.isArray(profile.languages) && profile.languages.length > 0) score += 10;

  return Math.min(100, score);
}

/**
 * Retrieve the current authenticated student's profile.
 */
export async function getStudentProfile(userId: string): Promise<StudentProfileDTO> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User account not found.', 404, 'NOT_FOUND');
  }

  const profile = await StudentProfile.findOne({ userId: new Types.ObjectId(userId) });
  const completionPercentage = calculateStudentProfileCompletion(profile);

  return {
    id: profile?._id.toString() || '',
    userId: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    programme: profile?.programme || '',
    department: profile?.department || '',
    graduationYear: profile?.graduationYear || new Date().getFullYear() + 1,
    academicInterests: profile?.academicInterests || [],
    skills: profile?.skills || [],
    careerInterests: profile?.careerInterests || [],
    careerGoals: profile?.careerGoals || '',
    preferredMentorshipTopics: profile?.preferredMentorshipTopics || [],
    preferredMentorshipMode: profile?.preferredMentorshipMode || 'online',
    bio: profile?.bio || '',
    completionPercentage,
    createdAt: profile?.createdAt?.toISOString() || user.createdAt.toISOString(),
    updatedAt: profile?.updatedAt?.toISOString() || user.createdAt.toISOString(),
  };
}

/**
 * Create or update the authenticated student's profile.
 */
export async function upsertStudentProfile(
  userId: string,
  input: StudentProfileInput
): Promise<StudentProfileDTO> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User account not found.', 404, 'NOT_FOUND');
  }

  if (user.role !== 'student') {
    throw new AppError('Only students can manage student profiles.', 403, 'FORBIDDEN');
  }

  const userObjectId = new Types.ObjectId(userId);

  const updatedProfile = await StudentProfile.findOneAndUpdate(
    { userId: userObjectId },
    {
      $set: {
        ...(input.programme !== undefined && { programme: input.programme.trim() }),
        ...(input.department !== undefined && { department: input.department.trim() }),
        ...(input.graduationYear !== undefined && { graduationYear: input.graduationYear }),
        ...(input.academicInterests !== undefined && {
          academicInterests: input.academicInterests,
        }),
        ...(input.skills !== undefined && { skills: input.skills }),
        ...(input.careerInterests !== undefined && { careerInterests: input.careerInterests }),
        ...(input.careerGoals !== undefined && { careerGoals: input.careerGoals.trim() }),
        ...(input.preferredMentorshipTopics !== undefined && {
          preferredMentorshipTopics: input.preferredMentorshipTopics,
        }),
        ...(input.preferredMentorshipMode !== undefined && {
          preferredMentorshipMode: input.preferredMentorshipMode,
        }),
        ...(input.bio !== undefined && { bio: input.bio.trim() }),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const completionPercentage = calculateStudentProfileCompletion(updatedProfile);

  return {
    id: updatedProfile._id.toString(),
    userId: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    programme: updatedProfile.programme,
    department: updatedProfile.department,
    graduationYear: updatedProfile.graduationYear,
    academicInterests: updatedProfile.academicInterests,
    skills: updatedProfile.skills,
    careerInterests: updatedProfile.careerInterests,
    careerGoals: updatedProfile.careerGoals,
    preferredMentorshipTopics: updatedProfile.preferredMentorshipTopics,
    preferredMentorshipMode: updatedProfile.preferredMentorshipMode,
    bio: updatedProfile.bio,
    completionPercentage,
    createdAt: updatedProfile.createdAt.toISOString(),
    updatedAt: updatedProfile.updatedAt.toISOString(),
  };
}

/**
 * Retrieve the current authenticated alumnus's profile.
 * Merges verified institutional credentials (read-only) with professional fields.
 */
export async function getAlumniProfile(userId: string): Promise<AlumniProfileDTO> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User account not found.', 404, 'NOT_FOUND');
  }

  const userObjectId = new Types.ObjectId(userId);

  const [profile, verification] = await Promise.all([
    AlumniProfile.findOne({ userId: userObjectId }),
    AlumniVerification.findOne({ userId: userObjectId, status: 'verified' }),
  ]);

  const isVerified = !!verification;
  const completionPercentage = calculateAlumniProfileCompletion(profile);

  return {
    id: profile?._id.toString() || '',
    userId: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    alumniId: verification?.alumniId,
    institutionalEmail: verification?.institutionalEmail,
    programme: verification?.programme,
    department: verification?.department,
    graduationYear: verification?.graduationYear,
    isVerified,
    headline: profile?.headline || '',
    currentDesignation: profile?.currentDesignation || '',
    company: profile?.company || '',
    industry: profile?.industry || '',
    yearsOfExperience: profile?.yearsOfExperience || 0,
    bio: profile?.bio || '',
    skills: profile?.skills || [],
    areasOfExpertise: profile?.areasOfExpertise || [],
    mentorshipTopics: profile?.mentorshipTopics || [],
    languages: profile?.languages || ['English'],
    preferredMentorshipMode: profile?.preferredMentorshipMode || 'online',
    isPubliclyVisible: profile ? profile.isPubliclyVisible : true,
    isDraft: profile ? profile.isDraft : true,
    completionPercentage,
    createdAt: profile?.createdAt?.toISOString() || user.createdAt.toISOString(),
    updatedAt: profile?.updatedAt?.toISOString() || user.createdAt.toISOString(),
  };
}

/**
 * Create or update the authenticated alumnus's professional profile.
 * Critical requirement: If attempting to publish (isDraft === false or isPubliclyVisible === true),
 * re-verify on backend that account is active and verification status is 'verified'.
 */
export async function upsertAlumniProfile(
  userId: string,
  input: AlumniProfileInput
): Promise<AlumniProfileDTO> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User account not found.', 404, 'NOT_FOUND');
  }

  if (user.role !== 'alumni') {
    throw new AppError('Only alumni can manage alumni professional profiles.', 403, 'FORBIDDEN');
  }

  if (user.accountStatus !== 'active') {
    throw new AppError(
      'Inactive alumni accounts cannot modify professional profiles.',
      403,
      'ACCOUNT_INACTIVE'
    );
  }

  const userObjectId = new Types.ObjectId(userId);

  // Check institutional verification
  const verification = await AlumniVerification.findOne({
    userId: userObjectId,
    status: 'verified',
  });
  const isVerified = !!verification;

  // If attempting to publish a visible, non-draft profile, verification is mandatory
  const willBePublished =
    input.isDraft === false || (input.isPubliclyVisible === true && input.isDraft !== true);
  if (willBePublished && !isVerified) {
    throw new AppError(
      'Institutional verification is required before your profile can be publicly published.',
      403,
      'VERIFICATION_REQUIRED'
    );
  }

  const updatedProfile = await AlumniProfile.findOneAndUpdate(
    { userId: userObjectId },
    {
      $set: {
        ...(input.headline !== undefined && { headline: input.headline.trim() }),
        ...(input.currentDesignation !== undefined && {
          currentDesignation: input.currentDesignation.trim(),
        }),
        ...(input.company !== undefined && { company: input.company.trim() }),
        ...(input.industry !== undefined && { industry: input.industry.trim() }),
        ...(input.yearsOfExperience !== undefined && {
          yearsOfExperience: input.yearsOfExperience,
        }),
        ...(input.bio !== undefined && { bio: input.bio.trim() }),
        ...(input.skills !== undefined && { skills: input.skills }),
        ...(input.areasOfExpertise !== undefined && {
          areasOfExpertise: input.areasOfExpertise,
        }),
        ...(input.mentorshipTopics !== undefined && {
          mentorshipTopics: input.mentorshipTopics,
        }),
        ...(input.languages !== undefined && { languages: input.languages }),
        ...(input.preferredMentorshipMode !== undefined && {
          preferredMentorshipMode: input.preferredMentorshipMode,
        }),
        ...(input.isPubliclyVisible !== undefined && {
          isPubliclyVisible: input.isPubliclyVisible,
        }),
        ...(input.isDraft !== undefined && { isDraft: input.isDraft }),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const completionPercentage = calculateAlumniProfileCompletion(updatedProfile);

  return {
    id: updatedProfile._id.toString(),
    userId: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    alumniId: verification?.alumniId,
    institutionalEmail: verification?.institutionalEmail,
    programme: verification?.programme,
    department: verification?.department,
    graduationYear: verification?.graduationYear,
    isVerified,
    headline: updatedProfile.headline,
    currentDesignation: updatedProfile.currentDesignation,
    company: updatedProfile.company,
    industry: updatedProfile.industry,
    yearsOfExperience: updatedProfile.yearsOfExperience,
    bio: updatedProfile.bio,
    skills: updatedProfile.skills,
    areasOfExpertise: updatedProfile.areasOfExpertise,
    mentorshipTopics: updatedProfile.mentorshipTopics,
    languages: updatedProfile.languages,
    preferredMentorshipMode: updatedProfile.preferredMentorshipMode,
    isPubliclyVisible: updatedProfile.isPubliclyVisible,
    isDraft: updatedProfile.isDraft,
    completionPercentage,
    createdAt: updatedProfile.createdAt.toISOString(),
    updatedAt: updatedProfile.updatedAt.toISOString(),
  };
}

/**
 * Retrieve an eligible public alumni professional profile for students and platform users.
 * Enforces active account, verified institutional status, and public visibility.
 */
export async function getPublicAlumniProfile(
  targetUserId: string
): Promise<PublicAlumniProfileDTO> {
  const targetObjectId = new Types.ObjectId(targetUserId);

  const [user, verification, profile] = await Promise.all([
    User.findById(targetObjectId),
    AlumniVerification.findOne({ userId: targetObjectId, status: 'verified' }),
    AlumniProfile.findOne({ userId: targetObjectId }),
  ]);

  if (!user || user.accountStatus !== 'active' || user.role !== 'alumni') {
    throw new AppError('Alumni profile not found or unavailable.', 404, 'PROFILE_NOT_FOUND');
  }

  if (!verification) {
    throw new AppError('This alumni member is not institutionally verified.', 404, 'NOT_VERIFIED');
  }

  if (!profile || !profile.isPubliclyVisible || profile.isDraft) {
    throw new AppError(
      'Alumni profile is currently not publicly available.',
      404,
      'PROFILE_PRIVATE'
    );
  }

  return {
    id: profile._id.toString(),
    userId: user._id.toString(),
    fullName: user.fullName,
    programme: verification.programme,
    department: verification.department,
    graduationYear: verification.graduationYear,
    isVerified: true,
    headline: profile.headline,
    currentDesignation: profile.currentDesignation,
    company: profile.company,
    industry: profile.industry,
    yearsOfExperience: profile.yearsOfExperience,
    bio: profile.bio,
    skills: profile.skills,
    areasOfExpertise: profile.areasOfExpertise,
    mentorshipTopics: profile.mentorshipTopics,
    languages: profile.languages,
    preferredMentorshipMode: profile.preferredMentorshipMode,
  };
}
