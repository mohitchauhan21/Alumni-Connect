import pino from 'pino';
import pinoHttp from 'pino-http';
import crypto from 'crypto';
import { env } from './env.js';

// Sensitive keys to be redacted everywhere in structured logs
export const SENSITIVE_REDACTION_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["set-cookie"]',
  'password',
  'email',
  'phone',
  '*.password',
  '*.email',
  '*.phone',
  'req.body.password',
  'req.body.email',
  'req.body.phone',
  'body.password',
  'body.email',
  'body.phone',
  'MONGODB_URI',
  'JWT_SECRET',
  'token',
  'refreshToken',
  'accessToken',
];

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  redact: {
    paths: SENSITIVE_REDACTION_PATHS,
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: req => (req.headers['x-request-id'] as string) || crypto.randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Ensure we do NOT indiscriminately log full request bodies or sensitive query params
  serializers: {
    req: req => ({
      id: req.id,
      method: req.method,
      url: req.url?.split('?')[0], // strip raw query string from url
      headers: {
        host: req.headers.host,
        'user-agent': req.headers['user-agent'],
        'content-type': req.headers['content-type'],
      },
    }),
    res: res => ({
      statusCode: res.statusCode,
    }),
  },
});
