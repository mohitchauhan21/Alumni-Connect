import { describe, it, expect } from 'vitest';
import pino from 'pino';
import { SENSITIVE_REDACTION_PATHS } from '../src/config/logger.js';
import { sanitizeMongoUri } from '../src/config/database.js';

describe('Logging Redaction and Data Protection', () => {
  it('should redact sensitive fields (password, email, phone, tokens) in structured log objects', () => {
    let output = '';
    const destination = {
      write: (chunk: string) => {
        output += chunk;
      },
    };

    const testLogger = pino(
      {
        redact: {
          paths: SENSITIVE_REDACTION_PATHS,
          censor: '[REDACTED]',
        },
      },
      destination
    );

    testLogger.info({
      password: 'superSecretPassword123',
      email: 'student@university.edu',
      phone: '+1-555-0199',
      JWT_SECRET: 'top_secret_jwt_key_here',
      user: {
        password: 'nestedPassword456',
        email: 'alumni@techcorp.com',
        phone: '+1-555-0299',
      },
      publicInfo: 'safeToLog',
    });

    const parsed = JSON.parse(output);

    // Verify all sensitive data is censored
    expect(parsed.password).toBe('[REDACTED]');
    expect(parsed.email).toBe('[REDACTED]');
    expect(parsed.phone).toBe('[REDACTED]');
    expect(parsed.JWT_SECRET).toBe('[REDACTED]');
    expect(parsed.user.password).toBe('[REDACTED]');
    expect(parsed.user.email).toBe('[REDACTED]');
    expect(parsed.user.phone).toBe('[REDACTED]');

    // Verify non-sensitive info remains intact
    expect(parsed.publicInfo).toBe('safeToLog');

    // Verify raw secret values are nowhere in the raw log output string
    expect(output).not.toContain('superSecretPassword123');
    expect(output).not.toContain('student@university.edu');
    expect(output).not.toContain('+1-555-0199');
    expect(output).not.toContain('top_secret_jwt_key_here');
  });

  it('should redact authorization and cookie headers in structured logs', () => {
    let output = '';
    const destination = {
      write: (chunk: string) => {
        output += chunk;
      },
    };

    const testLogger = pino(
      {
        redact: {
          paths: SENSITIVE_REDACTION_PATHS,
          censor: '[REDACTED]',
        },
      },
      destination
    );

    testLogger.info({
      req: {
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          cookie: 'p11_auth_token=secret_session_token_xyz',
          host: 'localhost:5000',
        },
      },
    });

    const parsed = JSON.parse(output);

    expect(parsed.req.headers.authorization).toBe('[REDACTED]');
    expect(parsed.req.headers.cookie).toBe('[REDACTED]');
    expect(parsed.req.headers.host).toBe('localhost:5000');
    expect(output).not.toContain('secret_session_token_xyz');
    expect(output).not.toContain('Bearer eyJhbGciOi');
  });

  it('should sanitize MongoDB connection URIs to avoid exposing credentials', () => {
    const rawUri =
      'mongodb+srv://dbAdmin:SuperSecretPassword123@cluster0.abcde.mongodb.net/p11_production?retryWrites=true&w=majority';
    const sanitized = sanitizeMongoUri(rawUri);

    expect(sanitized).not.toContain('SuperSecretPassword123');
    expect(sanitized).not.toContain('dbAdmin');
    expect(sanitized).toContain('cluster0.abcde.mongodb.net');
    expect(sanitized).toContain('p11_production');
  });
});
