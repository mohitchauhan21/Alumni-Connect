/**
 * matching.router.ts
 * Express router for Explainable Mentor-Student Matching endpoints.
 * Mounted at /api/v1/matching.
 */

import { Router } from 'express';
import { MatchingController } from './matching.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/requireRole.js';

export const matchingRouter = Router();

// Public / Authenticated weights information
matchingRouter.get('/weights', MatchingController.getWeights);

// Authenticated student recommendations
matchingRouter.get(
  '/recommendations',
  authenticate,
  requireRole('student'),
  MatchingController.getRecommendations
);

// Authenticated student recommendation detail breakdown
matchingRouter.get(
  '/recommendations/:offerId',
  authenticate,
  requireRole('student'),
  MatchingController.getRecommendationDetail
);

