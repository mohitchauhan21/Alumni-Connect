import bcrypt from 'bcryptjs';
import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../config/env.js';
import { badRequest, conflict, forbidden, tooMany, unauthorized } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { STAFF_ROLES, requireAuth, sessionToken, setAuthCookie } from '../middleware/auth.js';
import { ah, parse } from '../middleware/common.js';
import { Alumnus, StudentProfile, User } from '../models/index.js';
import { selfUser } from '../serializers/index.js';
import { consumeToken, recentTokenCount, sendPasswordResetEmail, sendSecurityNotice, sendVerificationEmail } from '../services/account.js';
import { audit } from '../services/audit.js';
import { deleteMyAccount, exportMyData } from '../services/dataRights.js';
import { GoogleAuthError, exchangeGoogleCode, googleAuthUrl, googleConfigured, safeNext, upsertGoogleUser } from '../services/googleAuth.js';
import { beginSetup, checkSecondFactor, completeSetup, readChallenge, replaceRecoveryCodes, signChallenge, turnOff, type SecondFactorResult } from '../services/mfa.js';

const r = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: env.isTest ? 10_000 : 30, standardHeaders: true, legacyHeaders: false });

const password = z
  .string()
  .min(8, 'At least 8 characters')
  .max(200)
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a number');

const MFA_COOKIE = 'amn_mfa';
const mfaCookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: env.cookieSecure, path: '/api/auth' };

/** Runs a background email without making the response wait (so response time can't reveal whether an account exists). */
function background(p: Promise<unknown>) {
  const handled = p.catch((e) => logger.error('Background email failed', { e: String(e) }));
  return env.isTest ? handled : undefined; // tests await it so they can read the captured email
}

/** Starts the second step: a short-lived challenge in an http-only cookie (and in the body for API clients). */
function startChallenge(res: Response, user: { _id: unknown; tokenVersion?: number | null }) {
  const challenge = signChallenge(user);
  res.cookie(MFA_COOKIE, challenge, { ...mfaCookieOpts, maxAge: 5 * 60 * 1000 });
  return challenge;
}

function secondFactorError(result: SecondFactorResult) {
  if (result.status === 'locked') return tooMany('mfa_locked', 'Too many wrong codes. Two-factor sign-in is paused for 15 minutes.');
  return unauthorized("That code didn't work. Use the newest code from your authenticator app, or one of your recovery codes.");
}

/* ------------------------------------------------------------ register */
r.post(
  '/register',
  authLimiter,
  ah(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().trim().min(2).max(80),
        email: z.string().email().max(120),
        password,
        role: z.enum(['student', 'alumnus']),
        phone: z.string().trim().max(20).optional(),
      }),
      req.body,
    );
    const exists = await User.exists({ email: body.email.toLowerCase() });
    if (exists) throw conflict('email_taken', 'An account with this email already exists');
    const user = await User.create({ name: body.name, email: body.email, phone: body.phone, role: body.role, passwordHash: await bcrypt.hash(body.password, 10) });
    if (body.role === 'student') await StudentProfile.create({ user: user._id });
    else await Alumnus.create({ user: user._id, verificationStatus: 'unverified' });
    await audit({ id: String(user._id), role: user.role as any }, 'user.registered', 'User', user._id);
    await sendVerificationEmail(user);
    const token = sessionToken(user);
    setAuthCookie(res, token);
    const full = await User.findById(user._id).select('+email +phone').lean();
    req.viewer = { id: String(user._id), role: user.role as any, email: full?.email, phone: full?.phone ?? undefined };
    res.status(201).json({ user: selfUser(full), token });
  }),
);

/* --------------------------------------------------------------- login */
r.post(
  '/login',
  authLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ email: z.string().email(), password: z.string().min(1).max(200) }), req.body);
    const user = await User.findOne({ email: body.email.toLowerCase() }).select('+email +phone +passwordHash');
    if (!user || !user.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw unauthorized(user && !user.passwordHash ? 'This account uses Google sign-in. Use "Continue with Google", or reset your password to add one.' : 'Incorrect email or password');
    }
    if (user.status !== 'active') throw unauthorized('This account is suspended');
    if (user.mfaEnabled) {
      // Password is right, but no session yet: the second step finishes sign-in.
      const challenge = startChallenge(res, user);
      return res.json({ mfaRequired: true, challenge });
    }
    user.lastLoginAt = new Date();
    await user.save();
    const token = sessionToken(user);
    setAuthCookie(res, token);
    req.viewer = { id: String(user._id), role: user.role as any, email: user.email, phone: user.phone ?? undefined };
    res.json({ user: selfUser(user.toObject()), token });
  }),
);

/** Second sign-in step: a 6-digit authenticator code or a recovery code. */
r.post(
  '/login/2fa',
  authLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ code: z.string().trim().min(6).max(20), challenge: z.string().max(2000).optional() }), req.body);
    const challenge = readChallenge(body.challenge ?? req.cookies?.[MFA_COOKIE]);
    if (!challenge) throw unauthorized('Your sign-in took too long. Please sign in again.');
    const result = await checkSecondFactor(challenge.sub, body.code);
    if (result.status !== 'ok') throw secondFactorError(result);
    const user = await User.findById(challenge.sub).select('+email +phone');
    if (!user || user.status !== 'active' || (user.tokenVersion ?? 0) !== challenge.v) throw unauthorized('Please sign in again.');
    user.lastLoginAt = new Date();
    await user.save();
    res.clearCookie(MFA_COOKIE, mfaCookieOpts);
    const token = sessionToken(user);
    setAuthCookie(res, token);
    req.viewer = { id: String(user._id), role: user.role as any, email: user.email, phone: user.phone ?? undefined };
    await audit({ id: String(user._id), role: user.role as any }, result.usedRecoveryCode ? 'user.login_recovery_code' : 'user.login_2fa', 'User', user._id);
    res.json({ user: selfUser(user.toObject()), token, recoveryCodesLeft: result.recoveryCodesLeft });
  }),
);

/* ------------------------------------------- data rights (DPDP Act 2023) */
r.get(
  '/me/export',
  requireAuth,
  ah(async (req, res) => {
    const data = await exportMyData(req.viewer!);
    res.setHeader('Content-Disposition', `attachment; filename="my-data-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  }),
);

r.post(
  '/me/delete',
  requireAuth,
  authLimiter,
  ah(async (req, res) => {
    const b = parse(z.object({ confirm: z.string().max(20).default(''), password: z.string().max(200).optional() }), req.body ?? {});
    await deleteMyAccount(req.viewer!, b);
    res.clearCookie(env.cookieName, { path: '/' });
    res.clearCookie(MFA_COOKIE, mfaCookieOpts);
    res.json({ ok: true });
  }),
);

r.post('/logout', (_req, res) => {
  res.clearCookie(env.cookieName, { path: '/' });
  res.clearCookie(MFA_COOKIE, mfaCookieOpts);
  res.json({ ok: true });
});

/* -------------------------------------------------------------- profile */
r.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const u = await User.findById(req.viewer!.id).select('+email +phone +passwordHash +mfaRecoveryCodes').lean();
    let profile: Record<string, unknown> = {};
    if (u?.role === 'student') {
      const p = await StudentProfile.findOne({ user: u._id }).lean();
      profile = { studentProfileId: p ? String(p._id) : null, profileComplete: !!(p && (p.targetRoles?.length || p.interests?.length)) };
    } else if (u?.role === 'alumnus') {
      const a = await Alumnus.findOne({ user: u._id }).lean();
      profile = { alumnusId: a ? String(a._id) : null, verificationStatus: a?.verificationStatus ?? 'unverified' };
    }
    const mfaRequired = env.requireStaff2fa && !!u && STAFF_ROLES.has(u.role as any);
    const security = {
      hasPassword: !!u?.passwordHash,
      emailVerified: !!u?.emailVerifiedAt,
      emailVerificationRequired: env.requireEmailVerification,
      mfaEnabled: !!u?.mfaEnabled,
      mfaRequired,
      mfaSetupRequired: mfaRequired && !u?.mfaEnabled,
      recoveryCodesLeft: u?.mfaEnabled ? (u.mfaRecoveryCodes?.length ?? 0) : null,
    };
    res.json({ user: selfUser(u), profile, security });
  }),
);

r.patch(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().trim().min(2).max(80).optional(),
        phone: z.string().trim().max(20).optional(),
        timezone: z.string().max(60).optional(),
        notificationPrefs: z.object({ email: z.boolean(), sms: z.boolean() }).partial().optional(),
      }),
      req.body,
    );
    const set: Record<string, unknown> = {};
    if (body.name) set.name = body.name;
    if (body.phone !== undefined) set.phone = body.phone;
    if (body.timezone) set.timezone = body.timezone;
    if (body.notificationPrefs?.email !== undefined) set['notificationPrefs.email'] = body.notificationPrefs.email;
    if (body.notificationPrefs?.sms !== undefined) set['notificationPrefs.sms'] = body.notificationPrefs.sms;
    const u = await User.findByIdAndUpdate(req.viewer!.id, { $set: set }, { new: true }).select('+email +phone').lean();
    res.json({ user: selfUser(u) });
  }),
);

/* ------------------------------------------------ email confirmation */
r.post(
  '/verify-email',
  authLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ token: z.string().min(20).max(200) }), req.body);
    const t = await consumeToken(body.token, 'email_verify');
    if (!t) throw badRequest('invalid_token', 'This confirmation link is invalid or has expired. Sign in and send a new one from the banner.');
    await User.updateOne({ _id: t.user, emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } });
    res.json({ ok: true });
  }),
);

r.post(
  '/resend-verification',
  requireAuth,
  authLimiter,
  ah(async (req, res) => {
    const u = await User.findById(req.viewer!.id).select('+email');
    if (!u) throw unauthorized();
    if (u.emailVerifiedAt) return res.json({ ok: true, alreadyVerified: true });
    if ((await recentTokenCount(u._id, 'email_verify')) >= 5) throw tooMany('too_many_emails', "We've sent several links already. Check your spam folder, or try again in an hour.");
    await sendVerificationEmail(u);
    res.json({ ok: true });
  }),
);

/* ------------------------------------------------------- passwords */
r.post(
  '/forgot-password',
  authLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ email: z.string().email().max(120) }), req.body);
    const user = await User.findOne({ email: body.email.toLowerCase() }).select('+email');
    if (user && user.status === 'active' && (await recentTokenCount(user._id, 'password_reset')) < 3) {
      await background(sendPasswordResetEmail(user));
    }
    // Same answer whether or not the account exists, so this can't be used to find out who has one.
    res.json({ ok: true });
  }),
);

r.post(
  '/reset-password',
  authLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ token: z.string().min(20).max(200), password }), req.body);
    const t = await consumeToken(body.token, 'password_reset');
    if (!t) throw badRequest('invalid_token', 'This link is invalid or has expired. Request a new one.');
    const user = await User.findById(t.user).select('+email');
    if (!user || user.status !== 'active') throw badRequest('invalid_token', 'This link is invalid or has expired. Request a new one.');
    user.passwordHash = await bcrypt.hash(body.password, 10);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // signs out every existing session
    if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date(); // they opened a link sent to this inbox
    await user.save();
    await audit({ id: String(user._id), role: user.role as any }, 'user.password_reset', 'User', user._id);
    await background(sendSecurityNotice(user.email, 'Your password was changed', 'The password for your account was just changed using a reset link, and you were signed out on all devices.'));
    res.json({ ok: true, mfaEnabled: !!user.mfaEnabled });
  }),
);

r.post(
  '/change-password',
  requireAuth,
  authLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ currentPassword: z.string().max(200).optional(), newPassword: password }), req.body);
    const user = await User.findById(req.viewer!.id).select('+email +passwordHash');
    if (!user) throw unauthorized();
    // Accounts created with Google have no password yet; they can add one here.
    if (user.passwordHash && !(body.currentPassword && (await bcrypt.compare(body.currentPassword, user.passwordHash)))) {
      throw badRequest('wrong_password', 'Your current password is incorrect');
    }
    const added = !user.passwordHash;
    user.passwordHash = await bcrypt.hash(body.newPassword, 10);
    user.tokenVersion = (user.tokenVersion ?? 0) + 1; // other devices are signed out; this one gets a new session
    await user.save();
    const token = sessionToken(user);
    setAuthCookie(res, token);
    await audit({ id: String(user._id), role: user.role as any }, added ? 'user.password_added' : 'user.password_changed', 'User', user._id);
    await background(sendSecurityNotice(user.email, added ? 'A password was added to your account' : 'Your password was changed', 'Your password was just changed from your account settings. Other devices were signed out.'));
    res.json({ ok: true, token });
  }),
);

/* ------------------------------------------------ two-factor sign-in */
r.post(
  '/2fa/setup',
  requireAuth,
  ah(async (req, res) => {
    const user = await User.findById(req.viewer!.id).select('+email');
    if (!user) throw unauthorized();
    if (user.mfaEnabled) throw conflict('mfa_already_enabled', 'Two-factor sign-in is already on.');
    res.json(await beginSetup(user));
  }),
);

r.post(
  '/2fa/enable',
  requireAuth,
  authLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ code: z.string().trim().min(6).max(12) }), req.body);
    if (req.viewer!.mfaEnabled) throw conflict('mfa_already_enabled', 'Two-factor sign-in is already on.');
    const done = await completeSetup(req.viewer!.id, body.code);
    if (!done) throw badRequest('invalid_code', "That code didn't match. Make sure your phone's clock is set automatically, then enter the newest code.");
    const user = await User.findById(req.viewer!.id).select('+email');
    const token = sessionToken(user!); // tokenVersion was bumped: other sessions end, this one continues
    setAuthCookie(res, token);
    await audit(req.viewer!, 'user.mfa_enabled', 'User', user!._id);
    await background(sendSecurityNotice(user!.email, 'Two-factor sign-in is on', 'Two-factor sign-in was just turned on for your account. You will need your authenticator app (or a recovery code) each time you sign in.'));
    res.json({ ok: true, recoveryCodes: done.recoveryCodes, token });
  }),
);

r.post(
  '/2fa/disable',
  requireAuth,
  authLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ code: z.string().trim().min(6).max(20) }), req.body);
    if (env.requireStaff2fa && STAFF_ROLES.has(req.viewer!.role)) throw forbidden('Two-factor sign-in is required for staff accounts.');
    if (!req.viewer!.mfaEnabled) throw conflict('mfa_not_enabled', 'Two-factor sign-in is not on.');
    const result = await checkSecondFactor(req.viewer!.id, body.code);
    if (result.status !== 'ok') throw secondFactorError(result);
    await turnOff(req.viewer!.id);
    const user = await User.findById(req.viewer!.id).select('+email');
    const token = sessionToken(user!);
    setAuthCookie(res, token);
    await audit(req.viewer!, 'user.mfa_disabled', 'User', user!._id);
    await background(sendSecurityNotice(user!.email, 'Two-factor sign-in is off', 'Two-factor sign-in was just turned off for your account.'));
    res.json({ ok: true, token });
  }),
);

r.post(
  '/2fa/recovery-codes',
  requireAuth,
  authLimiter,
  ah(async (req, res) => {
    const body = parse(z.object({ code: z.string().trim().min(6).max(20) }), req.body);
    if (!req.viewer!.mfaEnabled) throw conflict('mfa_not_enabled', 'Two-factor sign-in is not on.');
    const result = await checkSecondFactor(req.viewer!.id, body.code);
    if (result.status !== 'ok') throw secondFactorError(result);
    const recoveryCodes = await replaceRecoveryCodes(req.viewer!.id);
    await audit(req.viewer!, 'user.mfa_recovery_codes_replaced', 'User', req.viewer!.id);
    res.json({ ok: true, recoveryCodes });
  }),
);

/* --------------------------------------------------- Sign in with Google */
const NONCE_COOKIE = 'amn_g_nonce';
const HOME: Record<string, string> = { student: '/student', alumnus: '/mentor', aro: '/admin', admin: '/admin', placement: '/analytics' };

r.get('/providers', (_req, res) => {
  res.json({ google: googleConfigured() });
});

r.get('/google/start', authLimiter, (req, res) => {
  if (!googleConfigured()) return res.redirect(`${env.webOrigin}/login?error=google_not_configured`);
  const role = req.query.role === 'alumnus' ? 'alumnus' : 'student';
  const { url, nonce } = googleAuthUrl(role, safeNext(req.query.next));
  res.cookie(NONCE_COOKIE, nonce, { httpOnly: true, sameSite: 'lax', secure: env.cookieSecure, maxAge: 10 * 60 * 1000, path: '/api/auth/google' });
  res.redirect(url);
});

r.get('/google/callback', async (req, res) => {
  const fail = (code: string) => res.redirect(`${env.webOrigin}/login?error=${encodeURIComponent(code)}`);
  res.clearCookie(NONCE_COOKIE, { path: '/api/auth/google' });
  if (req.query.error) return fail('google_cancelled');
  if (typeof req.query.code !== 'string' || typeof req.query.state !== 'string') return fail('invalid_state');
  try {
    const { profile, state } = await exchangeGoogleCode(req.query.code, req.query.state, req.cookies?.[NONCE_COOKIE]);
    const { user, created } = await upsertGoogleUser(profile, state.role);
    const dest = created ? (user.role === 'student' ? '/student/profile?welcome=1' : '/mentor/profile?welcome=1') : state.next || HOME[user.role] || '/';
    if (user.mfaEnabled) {
      // Google proves the first factor only; the sign-in page asks for the authenticator code.
      startChallenge(res, user);
      return res.redirect(`${env.webOrigin}/login?mfa=1&next=${encodeURIComponent(dest)}`);
    }
    setAuthCookie(res, sessionToken(user));
    res.redirect(`${env.webOrigin}${dest}`);
  } catch (e) {
    if (e instanceof GoogleAuthError) return fail(e.code);
    logger.error('Google sign-in failed', { e: String(e) });
    fail('google_failed');
  }
});

export default r;
