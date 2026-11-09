/**
 * profile.controller.ts
 * Express route handlers for Student and Alumni Profiles.
 */

import { Request, Response, NextFunction } from 'express';
import {
  getStudentProfile,
  upsertStudentProfile,
  getAlumniProfile,
  upsertAlumniProfile,
  getPublicAlumniProfile,
} from './profile.service.js';
import { studentProfileSchema, alumniProfileSchema } from './profile.schemas.js';
import { AppError } from '../../middleware/errorHandler.js';

export async function getMyProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED');
    }

    if (user.role === 'student') {
      const profile = await getStudentProfile(user.id);
      res.status(200).json({
        success: true,
        data: { role: 'student', profile },
      });
      return;
    }

    if (user.role === 'alumni') {
      const profile = await getAlumniProfile(user.id);
      res.status(200).json({
        success: true,
        data: { role: 'alumni', profile },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        role: user.role,
        profile: {
          id: user.id,
          userId: user.id,
          fullName: user.fullName,
          email: user.email,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateMyProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      throw new AppError('Authentication required.', 401, 'NOT_AUTHENTICATED');
    }

    if (user.role === 'student') {
      const parsed = studentProfileSchema.parse(req.body);
      const profile = await upsertStudentProfile(user.id, parsed);
      res.status(200).json({
        success: true,
        data: { role: 'student', profile },
      });
      return;
    }

    if (user.role === 'alumni') {
      const parsed = alumniProfileSchema.parse(req.body);
      const profile = await upsertAlumniProfile(user.id, parsed);
      res.status(200).json({
        success: true,
        data: { role: 'alumni', profile },
      });
      return;
    }

    throw new AppError('Profile editing is not configured for your role.', 400, 'UNSUPPORTED_ROLE');
  } catch (err) {
    next(err);
  }
}

export async function getAlumniPublicProfile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawId = req.params.userId;
    const targetUserId = Array.isArray(rawId) ? rawId[0] : rawId;

    if (!targetUserId) {
      throw new AppError('User ID parameter is required.', 400, 'VALIDATION_ERROR');
    }

    const profile = await getPublicAlumniProfile(targetUserId);

    res.status(200).json({
      success: true,
      data: { profile },
    });
  } catch (err) {
    next(err);
  }
}
