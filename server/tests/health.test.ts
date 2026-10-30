import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import * as dbConfig from '../src/config/database.js';

describe('Health and Readiness Endpoints', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/v1/health', () => {
    it('should return 200 with healthy status and uptime without exposing secrets', async () => {
      const response = await request(app).get('/api/v1/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(typeof response.body.uptime).toBe('number');

      // Security assertions: ensure no secrets or stack traces leaked
      expect(response.body).not.toHaveProperty('env');
      expect(response.body).not.toHaveProperty('MONGODB_URI');
      expect(response.body).not.toHaveProperty('JWT_SECRET');
      expect(response.headers).toHaveProperty('x-request-id');
    });
  });

  describe('GET /api/v1/health/ready', () => {
    it('should return 200 and ready status when database is connected', async () => {
      vi.spyOn(dbConfig, 'isDatabaseConnected').mockReturnValue(true);

      const response = await request(app).get('/api/v1/health/ready');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ready',
        database: 'connected',
        timestamp: expect.any(String),
      });
      // Ensures no internal connection string or db details are leaked
      expect(response.body).not.toHaveProperty('connectionString');
    });

    it('should return 503 and unready status when database is disconnected', async () => {
      vi.spyOn(dbConfig, 'isDatabaseConnected').mockReturnValue(false);

      const response = await request(app).get('/api/v1/health/ready');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: 'unready',
        database: 'disconnected',
        timestamp: expect.any(String),
      });
      expect(response.body).not.toHaveProperty('errorDetails');
    });
  });
});
