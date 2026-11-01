import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { httpLogger } from './config/logger.js';
import { requestIdMiddleware } from './middleware/requestId.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './modules/health/health.router.js';
import { authRouter } from './modules/auth/auth.router.js';

export function createApp(): Express {
  const app = express();

  // Security Headers
  app.use(helmet());

  // Cross-Origin Resource Sharing with explicit origin allowlist
  app.use(
    cors({
      origin: [env.CLIENT_URL],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    })
  );

  // Request correlation identifier
  app.use(requestIdMiddleware);

  // HTTP Request Logging with redaction
  app.use(httpLogger);

  // Request body parsing with strict size limits
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Cookie parsing for secure HTTP-only auth cookies
  app.use(cookieParser());

  // API Routes
  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/auth', authRouter);

  // 404 handler for unknown routes
  app.use(notFoundHandler);

  // Centralized error handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
