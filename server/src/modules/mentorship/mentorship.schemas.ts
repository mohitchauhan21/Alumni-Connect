/**
 * mentorship.schemas.ts
 * Zod validation schemas for Mentorship Offerings.
 */

import { z } from 'zod';

export const createMentorshipOfferSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters')
    .max(120, 'Title cannot exceed 120 characters'),
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
  topics: z
    .array(z.string().trim().min(1, 'Topic cannot be empty'))
    .min(1, 'At least one topic must be specified')
    .max(15, 'Cannot exceed 15 topics'),
  targetAudience: z
    .string()
    .trim()
    .min(2, 'Target audience must be at least 2 characters')
    .max(200, 'Target audience cannot exceed 200 characters'),
  mode: z.enum(['online', 'in-person', 'hybrid'], {
    message: 'Mode must be online, in-person, or hybrid',
  }),
  sessionDurationMinutes: z
    .enum(['30', '45', '60', '90'])
    .or(z.number())
    .transform(val => Number(val)),
  maxMenteesCapacity: z
    .number()
    .int('Capacity must be an integer')
    .min(1, 'Capacity must be at least 1 mentee')
    .max(50, 'Capacity cannot exceed 50 mentees'),
  status: z.enum(['draft', 'active', 'inactive']).optional().default('active'),
});

export const updateMentorshipOfferSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters')
    .max(120, 'Title cannot exceed 120 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description cannot exceed 2000 characters')
    .optional(),
  topics: z
    .array(z.string().trim().min(1, 'Topic cannot be empty'))
    .min(1, 'At least one topic must be specified')
    .max(15, 'Cannot exceed 15 topics')
    .optional(),
  targetAudience: z
    .string()
    .trim()
    .min(2, 'Target audience must be at least 2 characters')
    .max(200, 'Target audience cannot exceed 200 characters')
    .optional(),
  mode: z.enum(['online', 'in-person', 'hybrid']).optional(),
  sessionDurationMinutes: z
    .enum(['30', '45', '60', '90'])
    .or(z.number())
    .transform(val => Number(val))
    .optional(),
  maxMenteesCapacity: z
    .number()
    .int('Capacity must be an integer')
    .min(1, 'Capacity must be at least 1 mentee')
    .max(50, 'Capacity cannot exceed 50 mentees')
    .optional(),
  status: z.enum(['draft', 'active', 'inactive']).optional(),
});

export const mentorshipDiscoveryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(9),
  search: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  mode: z.enum(['all', 'online', 'in-person', 'hybrid']).optional(),
});
