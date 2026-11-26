import 'dotenv/config';
import os from 'node:os';
import path from 'node:path';

function bool(v: string | undefined, def: boolean): boolean {
  if (v === undefined || v === '') return def;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isTest = nodeEnv === 'test' || process.env.VITEST === 'true';

if (nodeEnv === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

/** Embedded Mongo data lives outside OneDrive-synced folders to avoid file locking/corruption. */
const defaultEmbeddedDir = path.join(
  process.env.LOCALAPPDATA ?? path.join(os.homedir(), '.local', 'share'),
  'alumni-mentor-network',
  'mongo-data',
);

export const env = {
  nodeEnv,
  isTest,
  isProd: nodeEnv === 'production',
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  publicApiUrl: process.env.PUBLIC_API_URL ?? 'http://localhost:4000',

  mongoUri: process.env.MONGODB_URI ?? '',
  embeddedMongoPort: Number(process.env.EMBEDDED_MONGO_PORT ?? 27027),
  embeddedMongoDir: process.env.EMBEDDED_MONGO_DIR ?? defaultEmbeddedDir,
  seedOnEmpty: bool(process.env.SEED_ON_EMPTY, true),

  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
  jwtTtl: process.env.JWT_TTL ?? '7d',
  cookieName: 'amn_token',
  cookieSecure: bool(process.env.COOKIE_SECURE, nodeEnv === 'production'),

  /** Run cron jobs inside the API process (default when no dedicated worker is deployed). */
  jobsInProcess: bool(process.env.JOBS_IN_PROCESS, true),

  appName: 'Mentor Bridge',

  /** Block key actions (sending mentorship requests, submitting alumni verification) until the email is confirmed. */
  requireEmailVerification: bool(process.env.REQUIRE_EMAIL_VERIFICATION, !isTest),
  /** Staff accounts (admin, Alumni Relations, Placement) must turn on two-factor sign-in before using the platform. */
  requireStaff2fa: bool(process.env.REQUIRE_STAFF_2FA, nodeEnv === 'production'),
  /** 32 random bytes, base64. Encrypts secrets at rest (two-factor keys). Required in production. */
  dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY ?? '',

  /** Where verification documents are kept: 'local' disk (development) or an S3-compatible bucket (AWS S3, Cloudflare R2, MinIO). */
  storageDriver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
  s3: {
    bucket: process.env.S3_BUCKET ?? '',
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT ?? '', // e.g. https://<account>.r2.cloudflarestorage.com; empty for AWS
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, false),
    /** Server-side encryption header. AES256 on AWS by default; R2 encrypts by itself and rejects the header, so it's off when S3_ENDPOINT is set. */
    sse: process.env.S3_SSE ?? (process.env.S3_ENDPOINT ? '' : 'AES256'),
  },

  uploadDir: process.env.UPLOAD_DIR ?? path.resolve('uploads'),
  outboxDir: process.env.OUTBOX_DIR ?? path.resolve('outbox'),

  smtpUrl: process.env.SMTP_URL ?? '',
  mailFrom: process.env.MAIL_FROM ?? 'Mentor Bridge <no-reply@alumni.example.edu>',

  twilioSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioFrom: process.env.TWILIO_FROM ?? '',

  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  /** Optional comma-separated list: new STUDENT accounts via Google must use one of these email domains (e.g. "students.example.edu"). */
  googleStudentDomains: (process.env.GOOGLE_STUDENT_DOMAINS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  msClientId: process.env.MS_CLIENT_ID ?? '',
  msClientSecret: process.env.MS_CLIENT_SECRET ?? '',
  msTenant: process.env.MS_TENANT ?? 'common',

  videoProvider: (process.env.VIDEO_PROVIDER ?? 'jitsi') as 'jitsi' | 'google_meet',
  jitsiBaseUrl: process.env.JITSI_BASE_URL ?? 'https://meet.jit.si',

  /**
   * Paid sessions. 'test' is a built-in fake gateway for development (no money moves, refused in production);
   * 'razorpay' uses Razorpay Checkout; 'off' ignores mentor fees so every session is free.
   */
  paymentGateway: (process.env.PAYMENT_GATEWAY ?? (nodeEnv === 'production' ? 'off' : 'test')) as 'test' | 'razorpay' | 'off',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? '',
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
    apiBase: process.env.RAZORPAY_API_BASE ?? 'https://api.razorpay.com/v1',
  },
};
