import { Router } from 'express';
import { getHealthStatus, getReadinessStatus } from './health.controller.js';

export const healthRouter = Router();

healthRouter.get('/', getHealthStatus);
healthRouter.get('/ready', getReadinessStatus);
