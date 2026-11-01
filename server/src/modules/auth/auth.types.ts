/**
 * auth.types.ts
 * TypeScript interfaces and DTOs for the authentication module.
 * These are the authoritative type definitions used across auth service,
 * controller, and middleware layers.
 */

/** The five platform roles. */
export type UserRole = 'student' | 'alumni' | 'alumni_officer' | 'placement_officer' | 'admin';

/**
 * Account statuses:
 * - active:    Normal authenticated access permitted.
 * - disabled:  Account deactivated by admin; cannot log in.
 * - suspended: Temporarily blocked; cannot log in.
 */
export type AccountStatus = 'active' | 'disabled' | 'suspended';

/** Roles that may be chosen during public self-registration. */
export const PUBLIC_REGISTRATION_ROLES: readonly UserRole[] = ['student', 'alumni'] as const;

/** Safe public user object — never includes passwordHash or internal fields. */
export interface PublicUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt: string;
}

/** Payload stored in the JWT (minimal — role resolved from DB, not from token). */
export interface JwtPayload {
  sub: string; // MongoDB ObjectId as string (userId)
  iat?: number;
  exp?: number;
}

/** Attached to req.user after successful authentication middleware. */
export interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
}
