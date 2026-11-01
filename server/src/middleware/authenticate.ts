/**
 * authenticate.ts
 * JWT cookie verification middleware.
 * Reads the session cookie, verifies the JWT, confirms account status,
 * and attaches a typed AuthenticatedUser to req.user.
 *
 * Returns 401 for any missing, expired, or invalid authentication.
 * Never exposes internal token details in the response.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { env } from '../config/env.js';
import { verifyToken } from '../modules/auth/auth.service.js';
import { User } from '../modules/auth/user.model.js';
import type { AuthenticatedUser } from '../modules/auth/auth.types.js';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token: string | undefined = req.cookies?.[env.COOKIE_NAME];

    if (!token) {
      throw new AppError('Authentication required. Please log in.', 401, 'NOT_AUTHENTICATED');
    }

    // Verify signature and expiry; throws AppError on failure
    const payload = verifyToken(token);

    if (!payload.sub) {
      throw new AppError('Invalid authentication token.', 401, 'TOKEN_INVALID');
    }

    // Resolve current user from DB — role and status come from the database,
    // not from the token, to prevent stale permission escalation.
    const user = await User.findById(payload.sub).select('_id fullName email role accountStatus');

    if (!user) {
      throw new AppError('Authentication required. Please log in.', 401, 'NOT_AUTHENTICATED');
    }

    if (user.accountStatus !== 'active') {
      throw new AppError('Your account has been disabled or suspended.', 403, 'ACCOUNT_INACTIVE');
    }

    const authUser: AuthenticatedUser = {
      id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      accountStatus: user.accountStatus,
    };

    req.user = authUser;
    next();
  } catch (err) {
    next(err);
  }
}
