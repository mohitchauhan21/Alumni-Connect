/**
 * auth.router.ts
 * Routes for the /api/v1/auth namespace.
 */

import { Router } from 'express';
import { register, login, logout, getMe } from './auth.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateOrigin } from '../../middleware/validateOrigin.js';

export const authRouter = Router();

// State-changing auth endpoints use origin validation as a CSRF defence layer
authRouter.post('/register', validateOrigin, register);
authRouter.post('/login', validateOrigin, login);
authRouter.post('/logout', validateOrigin, logout);

// Read-only: identify the current session
authRouter.get('/me', authenticate, getMe);
