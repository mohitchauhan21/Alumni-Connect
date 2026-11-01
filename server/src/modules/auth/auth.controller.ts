/**
 * auth.controller.ts
 * Route handlers for the /api/v1/auth/* endpoints.
 * Delegates business logic to auth.service.ts.
 */

import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from './auth.schemas.js';
import { registerUser, loginUser, getUserById } from './auth.service.js';
import { AppError } from '../../middleware/errorHandler.js';
import { env } from '../../config/env.js';
import type { AuthenticatedUser } from './auth.types.js';

/** Cookie configuration shared between set and clear operations. */
function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeMs,
  };
}

/** Convert JWT_EXPIRES_IN string (e.g. "7d", "1h") to milliseconds. */
function expiresInToMs(expiresIn: string): number {
  const unit = expiresIn.slice(-1);
  const value = parseInt(expiresIn.slice(0, -1), 10);
  const map: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return (map[unit] ?? 7 * 24 * 60 * 60 * 1000) * value;
}

const TOKEN_MAX_AGE_MS = expiresInToMs(env.JWT_EXPIRES_IN);

/** POST /api/v1/auth/register */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    const { token, user } = await registerUser(parsed.data);

    res.cookie(env.COOKIE_NAME, token, cookieOptions(TOKEN_MAX_AGE_MS));

    res.status(201).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/login */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      next(parsed.error);
      return;
    }

    const { token, user } = await loginUser(parsed.data);

    res.cookie(env.COOKIE_NAME, token, cookieOptions(TOKEN_MAX_AGE_MS));

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

/** POST /api/v1/auth/logout */
export async function logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Clear the cookie using identical path/domain/secure settings
    res.clearCookie(env.COOKIE_NAME, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully.' },
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/v1/auth/me — requires authenticate middleware upstream */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authUser = req.user as AuthenticatedUser | undefined;
    if (!authUser) {
      next(new AppError('Not authenticated.', 401, 'NOT_AUTHENTICATED'));
      return;
    }

    // Re-fetch from DB to ensure we return up-to-date information
    const user = await getUserById(authUser.id);

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}
