import { env as liveEnv } from './env.js';
import { logger } from '../lib/logger.js';

type Env = typeof liveEnv;

const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me';
const isHttps = (u: string) => /^https:\/\//i.test(u);

/**
 * Settings a production deployment must get right. Pure function (takes the env) so it can be
 * tested; called at startup by the API and the worker, never at import time.
 */
export function productionConfigProblems(e: Env = liveEnv): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!e.isProd) return { errors, warnings };

  if (!e.jwtSecret || e.jwtSecret === DEV_JWT_SECRET || e.jwtSecret.length < 32) errors.push('JWT_SECRET must be a random value of at least 32 characters (openssl rand -base64 48)');
  if (!e.mongoUri) errors.push('MONGODB_URI must point at a real MongoDB (e.g. MongoDB Atlas). The built-in database is for development only');
  if (!isHttps(e.webOrigin)) errors.push('WEB_ORIGIN must be the https:// address of the website');
  if (!isHttps(e.publicApiUrl)) errors.push('PUBLIC_API_URL must be an https:// address');
  if (!e.cookieSecure) errors.push('COOKIE_SECURE must be on in production');

  if (!e.dataEncryptionKey) errors.push('DATA_ENCRYPTION_KEY is required: it encrypts two-factor keys (openssl rand -base64 32)');
  else if (Buffer.from(e.dataEncryptionKey, 'base64').length !== 32) errors.push('DATA_ENCRYPTION_KEY must decode to exactly 32 bytes (openssl rand -base64 32)');

  if (e.hostedDemo) {
    warnings.push('HOSTED_DEMO is on: this is a showcase on demo data. Email is written to the outbox, not sent');
    if (e.smtpUrl) errors.push('HOSTED_DEMO must not send email (the demo accounts use made-up addresses): unset SMTP_URL');
  } else {
    if (!e.smtpUrl) errors.push('SMTP_URL is required: password reset, email confirmation and notifications all send email');
    if (/example\.(edu|com)/i.test(e.mailFrom)) errors.push('MAIL_FROM must be a real sender address on your own domain');
  }

  if (e.storageDriver === 's3') {
    if (!e.s3.bucket) errors.push('STORAGE_DRIVER=s3 needs S3_BUCKET');
  } else {
    warnings.push('Documents are stored on the API server disk (STORAGE_DRIVER=local). Use a persistent, backed-up disk, or set STORAGE_DRIVER=s3');
  }

  if (e.paymentGateway === 'test') errors.push('PAYMENT_GATEWAY=test is a fake gateway for development; use razorpay (or off) in production');
  if (e.paymentGateway === 'razorpay') {
    if (!e.razorpay.keyId || !e.razorpay.keySecret) errors.push('PAYMENT_GATEWAY=razorpay needs RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    else if (e.razorpay.keyId.startsWith('rzp_test_')) warnings.push('RAZORPAY_KEY_ID is a test-mode key: payments are not real');
    if (!e.razorpay.webhookSecret) errors.push('RAZORPAY_WEBHOOK_SECRET is required so payments confirm even if the student closes the browser mid-checkout');
  }

  if (e.googleClientId && !e.googleClientSecret) errors.push('GOOGLE_CLIENT_SECRET is missing (GOOGLE_CLIENT_ID is set)');
  if (!e.requireStaff2fa) warnings.push('REQUIRE_STAFF_2FA is off: staff accounts can see identity documents, so two-factor sign-in is strongly recommended');
  if (!e.requireEmailVerification) warnings.push('REQUIRE_EMAIL_VERIFICATION is off: unconfirmed accounts can send mentorship requests');
  if (e.seedOnEmpty) warnings.push('SEED_ON_EMPTY is ignored in production: demo data is never loaded. Use "npm run bootstrap" to create the first admin');

  return { errors, warnings };
}

/** Logs warnings and refuses to start on errors. */
export function assertProductionConfig(e: Env = liveEnv) {
  const { errors, warnings } = productionConfigProblems(e);
  for (const w of warnings) logger.warn(`Config: ${w}`);
  if (errors.length) throw new Error(`Refusing to start in production. Fix these settings:\n  - ${errors.join('\n  - ')}`);
}
