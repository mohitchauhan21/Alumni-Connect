import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { app } from '../src/app.js';
import { AppError, errorHandler } from '../src/middleware/errorHandler.js';

describe('Error Handling and 404 Middleware', () => {
  it('should return 404 JSON for unknown routes with standard format', async () => {
    const response = await request(app).get('/api/v1/non-existent-endpoint');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: expect.stringContaining('/api/v1/non-existent-endpoint'),
      },
    });
    expect(response.headers).toHaveProperty('x-request-id');
  });

  it('should format operational AppError with custom status and code', async () => {
    const testApp = express();
    testApp.get('/test-operational-error', () => {
      throw new AppError('Forbidden action requested', 403, 'FORBIDDEN_ACTION');
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get('/test-operational-error');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN_ACTION',
        message: 'Forbidden action requested',
      },
    });
  });

  it('should safely mask unexpected 500 errors and not leak internal stack traces', async () => {
    const testApp = express();
    testApp.get('/test-internal-error', () => {
      throw new Error('Database password was incorrectly passed to query executor');
    });
    testApp.use(errorHandler);

    const response = await request(testApp).get('/test-internal-error');

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(response.body.error.message).toBe(
      'An unexpected internal server error occurred. Please try again later.'
    );
    expect(response.body.error).toHaveProperty('requestId');

    // Crucial security check: Ensure raw internal error text and stack are not exposed in client payload
    expect(response.body.error.message).not.toContain('Database password');
    expect(response.body).not.toHaveProperty('stack');
  });
});
