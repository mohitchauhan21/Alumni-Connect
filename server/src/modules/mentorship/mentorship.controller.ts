/**
 * mentorship.controller.ts
 * Express controllers for Mentorship Offer Management and Discovery.
 */

import { Request, Response, NextFunction } from 'express';
import {
  createMentorshipOffer,
  getAlumniOwnOffers,
  getMentorshipOfferById,
  updateMentorshipOffer,
  deleteMentorshipOffer,
  discoverMentorshipOffers,
} from './mentorship.service.js';
import {
  createMentorshipOfferSchema,
  updateMentorshipOfferSchema,
  mentorshipDiscoveryQuerySchema,
} from './mentorship.schemas.js';
import { AppError } from '../../middleware/errorHandler.js';

export async function createOfferHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED');
    }

    if (user.role !== 'alumni') {
      throw new AppError('Only alumni accounts can create mentorship offerings.', 403, 'FORBIDDEN');
    }

    const parsed = createMentorshipOfferSchema.parse(req.body);
    const offer = await createMentorshipOffer(user.id, parsed);

    res.status(201).json({
      success: true,
      data: { offer },
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyOffersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED');
    }

    if (user.role !== 'alumni') {
      throw new AppError(
        'Only alumni accounts can view owned mentorship offerings.',
        403,
        'FORBIDDEN'
      );
    }

    const offers = await getAlumniOwnOffers(user.id);

    res.status(200).json({
      success: true,
      data: { offers },
    });
  } catch (err) {
    next(err);
  }
}

export async function getOfferDetailHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.id;
    const offerId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!offerId) {
      throw new AppError('Offering ID parameter is required.', 400, 'VALIDATION_ERROR');
    }

    const offer = await getMentorshipOfferById(offerId, req.user?.id);

    res.status(200).json({
      success: true,
      data: { offer },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateOfferHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED');
    }

    if (user.role !== 'alumni') {
      throw new AppError('Only alumni accounts can edit mentorship offerings.', 403, 'FORBIDDEN');
    }

    const rawId = req.params.id;
    const offerId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!offerId) {
      throw new AppError('Offering ID parameter is required.', 400, 'VALIDATION_ERROR');
    }

    const parsed = updateMentorshipOfferSchema.parse(req.body);
    const offer = await updateMentorshipOffer(offerId, user.id, parsed);

    res.status(200).json({
      success: true,
      data: { offer },
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteOfferHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED');
    }

    if (user.role !== 'alumni') {
      throw new AppError('Only alumni accounts can delete mentorship offerings.', 403, 'FORBIDDEN');
    }

    const rawId = req.params.id;
    const offerId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!offerId) {
      throw new AppError('Offering ID parameter is required.', 400, 'VALIDATION_ERROR');
    }

    await deleteMentorshipOffer(offerId, user.id);

    res.status(200).json({
      success: true,
      data: { message: 'Offering successfully removed.' },
    });
  } catch (err) {
    next(err);
  }
}

export async function discoverOffersHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsedQuery = mentorshipDiscoveryQuerySchema.parse(req.query);
    const result = await discoverMentorshipOffers(parsedQuery);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}
