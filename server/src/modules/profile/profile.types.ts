/**
 * profile.types.ts
 * Type definitions and DTO interfaces for Student and Alumni Profiles.
 */

export type MentorshipMode = 'online' | 'in-person' | 'hybrid';

export interface StudentProfileDTO {
  id: string;
  userId: string;
  fullName: string;
  email: string;
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
  completionPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudentProfileInput {
  programme?: string;
  department?: string;
  graduationYear?: number;
  academicInterests?: string[];
  skills?: string[];
  careerInterests?: string[];
  careerGoals?: string;
  preferredMentorshipTopics?: string[];
  preferredMentorshipMode?: MentorshipMode;
  bio?: string;
}

export interface AlumniProfileDTO {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  // Institutional fields (authoritatively sourced from AlumniVerification)
  alumniId?: string;
  institutionalEmail?: string;
  programme?: string;
  department?: string;
  graduationYear?: number;
  isVerified: boolean;
  // Professional fields
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
  completionPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface AlumniProfileInput {
  headline?: string;
  currentDesignation?: string;
  company?: string;
  industry?: string;
  yearsOfExperience?: number;
  bio?: string;
  skills?: string[];
  areasOfExpertise?: string[];
  mentorshipTopics?: string[];
  languages?: string[];
  preferredMentorshipMode?: MentorshipMode;
  isPubliclyVisible?: boolean;
  isDraft?: boolean;
}

export interface PublicAlumniProfileDTO {
  id: string;
  userId: string;
  fullName: string;
  // Authoritative verified institutional details
  programme: string;
  department: string;
  graduationYear: number;
  isVerified: boolean;
  // Professional details
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
}
