import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { attachViewer, enforceStaffMfa } from './middleware/auth.js';
import { errorHandler, leakGuard } from './middleware/common.js';
import adminRoutes from './routes/admin.js';
import alumniRoutes from './routes/alumni.js';
import analyticsRoutes from './routes/analytics.js';
import jobRoutes from './routes/jobs.js';
import authRoutes from './routes/auth.js';
import calendarRoutes from './routes/calendar.js';
import mentorRoutes from './routes/mentors.js';
import mentorshipRoutes from './routes/mentorships.js';
import messageRoutes from './routes/messages.js';
import metaRoutes from './routes/meta.js';
import notificationRoutes from './routes/notifications.js';
import paymentRoutes from './routes/payments.js';
import requestRoutes from './routes/requests.js';
import studentRoutes from './routes/students.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: env.webOrigin, credentials: true }));
  app.use(
    express.json({
      limit: '6mb',
      // Payment webhooks are signed over the exact bytes received, so keep them for verification.
      verify: (req, _res, buf) => {
        if (req.url?.startsWith('/api/payments/webhook')) (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(cookieParser());
  app.use(attachViewer);
  app.use(enforceStaffMfa);
  app.use(leakGuard);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'down', time: new Date().toISOString() });
  });

  const api = express.Router();
  api.use('/auth', authRoutes);
  api.use('/', metaRoutes);
  api.use('/alumni', alumniRoutes);
  api.use('/mentors', mentorRoutes);
  api.use('/students', studentRoutes);
  api.use('/requests', requestRoutes);
  api.use('/mentorships', mentorshipRoutes);
  api.use('/messages', messageRoutes);
  api.use('/notifications', notificationRoutes);
  api.use('/calendar', calendarRoutes);
  api.use('/payments', paymentRoutes);
  api.use('/admin', adminRoutes);
  api.use('/analytics', analyticsRoutes);
  api.use('/jobs', jobRoutes);
  app.use('/api', api);

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Endpoint not found' } }));
  app.use(errorHandler);
  return app;
}
