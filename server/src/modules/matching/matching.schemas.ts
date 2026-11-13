/**
 * matching.schemas.ts
 * Zod validation schemas for matching API query parameters and route parameters.
 */

import { z } from 'zod';

export const recommendationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  mode: z.enum(['online', 'in-person', 'hybrid', 'all']).optional(),
  industry: z.string().trim().max(100).optional(),
  topic: z.string().trim().max(100).optional(),
});

export const offerParamSchema = z.object({
  offerId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid offering ID format'),
});

