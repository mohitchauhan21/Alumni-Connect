import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && incomingId.trim().length > 0
      ? incomingId.trim()
      : crypto.randomUUID();

  // Attach to request object for downstream handlers & logger
  req.id = requestId;
  // Echo header back to client for tracing
  res.setHeader('X-Request-Id', requestId);

  next();
}
