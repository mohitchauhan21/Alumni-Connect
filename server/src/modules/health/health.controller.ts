import { Request, Response } from 'express';
import { isDatabaseConnected } from '../../config/database.js';

export function getHealthStatus(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  });
}

export function getReadinessStatus(_req: Request, res: Response): void {
  const dbConnected = isDatabaseConnected();

  if (dbConnected) {
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'unready',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
}
