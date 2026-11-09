/**
 * profile.schemas.ts
 * Zod validation schemas for profile updates.
 */

import { z } from 'zod';

export const studentProfileSchema = z.object({
  programme: z.string().max(120, 'Programme name must not exceed 120 characters').optional(),
  department: z.string().max(120, 'Department must not exceed 120 characters').optional(),
  graduationYear: z
    .number()
    .int('Graduation year must be an integer')
    .min(1950, 'Graduation year cannot be earlier than 1950')
    .max(2040, 'Graduation year cannot be later than 2040')
    .optional(),
  academicInterests: z.array(z.string().trim().min(1)).max(20).optional(),
  skills: z.array(z.string().trim().min(1)).max(30).optional(),
  careerInterests: z.array(z.string().trim().min(1)).max(20).optional(),
  careerGoals: z.string().max(1000, 'Career goals cannot exceed 1000 characters').optional(),
  preferredMentorshipTopics: z.array(z.string().trim().min(1)).max(20).optional(),
  preferredMentorshipMode: z.enum(['online', 'in-person', 'hybrid']).optional(),
  bio: z.string().max(1000, 'Bio cannot exceed 1000 characters').optional(),
});

export const alumniProfileSchema = z.object({
  headline: z.string().max(140, 'Headline must not exceed 140 characters').optional(),
  currentDesignation: z.string().max(100, 'Designation must not exceed 100 characters').optional(),
  company: z.string().max(100, 'Company must not exceed 100 characters').optional(),
  industry: z.string().max(80, 'Industry must not exceed 80 characters').optional(),
  yearsOfExperience: z
    .number()
    .min(0, 'Years of experience cannot be negative')
    .max(70, 'Years of experience cannot exceed 70')
    .optional(),
  bio: z.string().max(2000, 'Bio cannot exceed 2000 characters').optional(),
  skills: z.array(z.string().trim().min(1)).max(30).optional(),
  areasOfExpertise: z.array(z.string().trim().min(1)).max(20).optional(),
  mentorshipTopics: z.array(z.string().trim().min(1)).max(20).optional(),
  languages: z.array(z.string().trim().min(1)).max(10).optional(),
  preferredMentorshipMode: z.enum(['online', 'in-person', 'hybrid']).optional(),
  isPubliclyVisible: z.boolean().optional(),
  isDraft: z.boolean().optional(),
});
