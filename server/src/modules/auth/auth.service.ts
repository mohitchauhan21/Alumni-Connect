/**
 * auth.service.ts
 * Business logic for registration, login, and current-user retrieval.
 * No Express types here — pure domain logic.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from './user.model.js';
import { AppError } from '../../middleware/errorHandler.js';
import { env } from '../../config/env.js';
import type { RegisterInput, LoginInput } from './auth.schemas.js';
import type { PublicUser, JwtPayload } from './auth.types.js';
import type { IUser } from './user.model.js';

const BCRYPT_ROUNDS = 12;

/** Serialize an IUser document into a safe public object (no hash, no internal fields). */
export function toPublicUser(user: IUser): PublicUser {
  return {
    id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Sign a JWT containing only the user's MongoDB ObjectId as `sub`. */
export function signToken(userId: string): string {
  const payload: JwtPayload = { sub: userId };
  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/** Verify and decode a JWT. Throws AppError on invalid / expired tokens. */
export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('Session has expired. Please log in again.', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid authentication token.', 401, 'TOKEN_INVALID');
  }
}

/**
 * Register a new user.
 * - Hashes the password.
 * - Creates the user record.
 * - Returns a signed JWT and the public user object.
 */
export async function registerUser(
  data: RegisterInput
): Promise<{ token: string; user: PublicUser }> {
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  let user: IUser;
  try {
    user = await User.create({
      fullName: data.fullName,
      email: data.email, // already normalized by Zod transform
      passwordHash,
      role: data.role,
    });
  } catch (err: unknown) {
    // MongoDB duplicate-key error (code 11000)
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: number }).code === 11000
    ) {
      throw new AppError(
        'An account with this email address already exists.',
        409,
        'EMAIL_ALREADY_EXISTS'
      );
    }
    throw err;
  }

  const token = signToken(user._id.toString());
  return { token, user: toPublicUser(user) };
}

/**
 * Authenticate a user by email + password.
 * Uses a generic error message for both "not found" and "wrong password"
 * to avoid email enumeration.
 */
export async function loginUser(data: LoginInput): Promise<{ token: string; user: PublicUser }> {
  // Explicitly select passwordHash (excluded by default)
  const user = await User.findOne({ email: data.email }).select('+passwordHash');

  if (!user) {
    throw new AppError('Invalid email address or password.', 401, 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await user.comparePassword(data.password);
  if (!passwordMatches) {
    throw new AppError('Invalid email address or password.', 401, 'INVALID_CREDENTIALS');
  }

  if (user.accountStatus !== 'active') {
    throw new AppError(
      'Your account has been disabled or suspended. Please contact support.',
      403,
      'ACCOUNT_INACTIVE'
    );
  }

  const token = signToken(user._id.toString());
  return { token, user: toPublicUser(user) };
}

/**
 * Fetch the current authenticated user by ID.
 * Used by the /me endpoint after JWT verification.
 */
export async function getUserById(userId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  }
  return toPublicUser(user);
}
