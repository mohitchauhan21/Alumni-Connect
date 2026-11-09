/**
 * verification.schemas.ts
 * Zod validation schemas for verification submissions, review actions, and queries.
 */

import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const verificationSubmitSchema = z.object({
  alumniId: z
    .string({ required_error: 'Institutional Alumni ID is required' })
    .min(1, 'Institutional Alumni ID cannot be empty')
    .max(50, 'Institutional Alumni ID cannot exceed 50 characters')
    .trim(),
  institutionalEmail: z
    .string({ required_error: 'Institutional email is required' })
    .email('Please enter a valid institutional email address')
    .trim()
    .toLowerCase(),
  programme: z
    .string({ required_error: 'Programme or degree is required' })
    .min(2, 'Programme must be at least 2 characters')
    .max(100, 'Programme cannot exceed 100 characters')
    .trim(),
  department: z
    .string({ required_error: 'Department is required' })
    .min(2, 'Department must be at least 2 characters')
    .max(100, 'Department cannot exceed 100 characters')
    .trim(),
  graduationYear: z.coerce
    .number({ required_error: 'Graduation year is required' })
    .int('Graduation year must be an integer')
    .min(1950, 'Graduation year must be 1950 or later')
    .max(currentYear + 1, `Graduation year cannot exceed ${currentYear + 1}`),
});

export const verificationRejectSchema = z.object({
  reason: z
    .string({ required_error: 'A rejection reason is required' })
    .min(5, 'Rejection reason must be at least 5 characters long')
    .max(500, 'Rejection reason cannot exceed 500 characters')
    .trim(),
});

export const queueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  status: z.enum(['pending', 'verified', 'rejected']).optional(),
  matchingResult: z.enum(['matched', 'unmatched', 'conflict']).optional(),
  search: z.string().optional(),
});
