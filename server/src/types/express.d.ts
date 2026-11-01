/**
 * express.d.ts
 * Augments the Express Request type to include the authenticated user
 * attached by the authenticate middleware.
 */

import type { AuthenticatedUser } from '../modules/auth/auth.types.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
