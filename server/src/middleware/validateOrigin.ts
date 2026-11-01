/**
 * validateOrigin.ts
 * Origin/Referer validation middleware for state-changing authentication requests.
 *
 * Strategy:
 * - In production: the Origin header (or Referer fallback) must match CLIENT_URL.
 * - In development / test: validation is skipped to allow curl, Supertest, and tooling.
 * - Requests without an Origin or Referer header that arrive in production are rejected.
 *
 * This is a defence-in-depth layer. HTTP-only cookies prevent XSS token theft,
 * but same-site=lax already mitigates most CSRF for top-level navigation.
 * Origin validation adds an explicit check for non-navigation cross-site requests
 * (e.g. cross-site fetch with credentials).
 *
 * Note: If the deployment ever requires cross-site cookie flows
 * (e.g. API on a different domain from the SPA), a full CSRF-token mechanism
 * should be added in addition to this check.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { env } from '../config/env.js';

function normalizeOrigin(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url;
  }
}

export function validateOrigin(req: Request, _res: Response, next: NextFunction): void {
  // Skip validation outside production so dev tools, curl, and tests work normally
  if (env.NODE_ENV !== 'production') {
    next();
    return;
  }

  const allowedOrigin = normalizeOrigin(env.CLIENT_URL);

  const originHeader = req.headers['origin'];
  const refererHeader = req.headers['referer'];

  const requestOrigin = originHeader
    ? normalizeOrigin(originHeader)
    : refererHeader
      ? normalizeOrigin(refererHeader)
      : null;

  if (!requestOrigin || requestOrigin !== allowedOrigin) {
    next(new AppError('Request origin is not permitted.', 403, 'INVALID_ORIGIN'));
    return;
  }

  next();
}
