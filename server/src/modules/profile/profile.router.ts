/**
 * profile.router.ts
 * Express router for Profile endpoints, mounted at /api/v1/profiles.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { getMyProfile, updateMyProfile, getAlumniPublicProfile } from './profile.controller.js';

export const profileRouter = Router();

profileRouter.use(authenticate);

profileRouter.get('/me', getMyProfile);
profileRouter.patch('/me', updateMyProfile);
profileRouter.get('/alumni/:userId', getAlumniPublicProfile);
