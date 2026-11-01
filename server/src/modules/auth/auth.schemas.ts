/**
 * auth.schemas.ts
 * Zod validation schemas for all authentication request payloads.
 * These are backend-authoritative; never trust client-side validation alone.
 */

import { z } from 'zod';

/** Shared password rule: min 8 chars, 1 uppercase, 1 number. */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
  .regex(/[0-9]/, 'Password must include at least one number');

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(80, 'Full name must not exceed 80 characters')
      .trim(),
    email: z
      .string()
      .min(1, 'Email address is required')
      .email('Please enter a valid email address')
      .transform(v => v.trim().toLowerCase()),
    /**
     * Public registration is restricted to 'student' and 'alumni' only.
     * Attempts to register as 'alumni_officer', 'placement_officer', or 'admin'
     * are rejected by this schema regardless of what the client sends.
     */
    role: z.enum(['student', 'alumni'], {
      errorMap: () => ({
        message: "Role must be 'student' or 'alumni'. Privileged roles cannot be self-registered.",
      }),
    }),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid email address')
    .transform(v => v.trim().toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
