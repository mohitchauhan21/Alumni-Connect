/**
 * mentorship.router.ts
 * Express router for Mentorship Offerings and Discovery, mounted at /api/v1/mentorship.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import {
  createOfferHandler,
  getMyOffersHandler,
  getOfferDetailHandler,
  updateOfferHandler,
  deleteOfferHandler,
  discoverOffersHandler,
} from './mentorship.controller.js';

export const mentorshipRouter = Router();

mentorshipRouter.use(authenticate);

// Discovery & browsing
mentorshipRouter.get('/offers', discoverOffersHandler);

// Alumni offer management (must declare /offers/mine before /offers/:id)
mentorshipRouter.post('/offers', createOfferHandler);
mentorshipRouter.get('/offers/mine', getMyOffersHandler);
mentorshipRouter.get('/offers/:id', getOfferDetailHandler);
mentorshipRouter.patch('/offers/:id', updateOfferHandler);
mentorshipRouter.delete('/offers/:id', deleteOfferHandler);
