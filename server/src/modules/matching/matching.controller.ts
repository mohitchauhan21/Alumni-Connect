/**
 * matching.controller.ts
 * Express route handlers for the Explainable Mentor-Student Matching API.
 */

import type { Request, Response, NextFunction } from 'express';
import { MatchingService } from './matching.service.js';
import { recommendationQuerySchema, offerParamSchema } from './matching.schemas.js';

export class MatchingController {
  /**
   * GET /api/v1/matching/weights
   * Returns active matching criteria, configured weights, and categories.
   */
  static async getWeights(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const weights = MatchingService.getWeights();
      res.status(200).json({
        success: true,
        data: weights,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/matching/recommendations
   * Returns personalized, ranked recommendations for the authenticated student.
   */
  static async getRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentUserId = req.user!.id;
      const validatedQuery = recommendationQuerySchema.parse(req.query);

      const result = await MatchingService.getRecommendations(studentUserId, validatedQuery);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/matching/recommendations/:offerId
   * Returns detailed compatibility score breakdown and explainable evidence for a single offering.
   */
  static async getRecommendationDetail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const studentUserId = req.user!.id;
      const { offerId } = offerParamSchema.parse(req.params);

      const result = await MatchingService.getRecommendationByOfferId(studentUserId, offerId);

      res.status(200).json({
        success: true,
        data: {
          recommendation: result,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

