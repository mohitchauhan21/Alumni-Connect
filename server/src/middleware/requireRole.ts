/**
 * requireRole.ts
 * Role-based authorization middleware factory.
 *
 * Usage: router.get('/admin-only', authenticate, requireRole('admin'), handler)
 *        router.get('/officers',   authenticate, requireRole('alumni_officer', 'admin'), handler)
 *
 * Contract:
 * - authenticate must run first; requireRole assumes req.user is set.
 * - Unauthenticated requests (no req.user) → 401.
 * - Authenticated but insufficient role → 403.
 * - Role information comes from the DB-resolved req.user, never from request body/headers.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import type { UserRole, AuthenticatedUser } from '../modules/auth/auth.types.js';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user as AuthenticatedUser | undefined;

    if (!user) {
      next(new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED'));
      return;
    }

    if (!roles.includes(user.role)) {
      next(new AppError('You do not have permission to access this resource.', 403, 'FORBIDDEN'));
      return;
    }

    next();
  };
}
