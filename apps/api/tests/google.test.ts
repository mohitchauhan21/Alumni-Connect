/** "Sign in with Google": state/nonce checks, verified-email requirement, account creation and linking. */
import { vi } from 'vitest';

vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
});

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Alumnus, StudentProfile, User } from '../src/models/index.js';
import { api, clearDb, makeStudent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);
afterEach(() => vi.restoreAllMocks());

const realFetch = globalThis.fetch;
function mockGoogle(claims: Record<string, string>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
    const url = String(input);
    if (url.startsWith('https://oauth2.googleapis.com/token') && !url.includes('tokeninfo')) return new Response(JSON.stringify({ id_token: 'fake.jwt.token', access_token: 'x' }), { status: 200 });
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) {
      return new Response(
        JSON.stringify({ aud: process.env.GOOGLE_CLIENT_ID, iss: 'https://accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), email_verified: 'true', ...claims }),
        { status: 200 },
      );
    }
    return realFetch(input, init);
  });
}

/** Runs /start, then simulates Google redirecting back to /callback with the same cookies. */
async function signIn(role: 'student' | 'alumnus', claims: Record<string, string>, opts: { tamperNonce?: boolean } = {}) {
  const start = await api().get(`/api/auth/google/start?role=${role}&next=/mentors`);
  expect(start.status).toBe(302);
  const loc = new URL(start.headers.location);
  expect(loc.host).toBe('accounts.google.com');
  expect(loc.searchParams.get('scope')).toBe('openid email profile');
  const state = loc.searchParams.get('state')!;
  const nonce = loc.searchParams.get('nonce')!;
  mockGoogle({ nonce, ...claims });
  const cookie = `amn_g_nonce=${opts.tamperNonce ? 'wrong' : nonce}`;
  return api().get(`/api/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`).set('Cookie', cookie);
}

describe('Sign in with Google', () => {
  it('reports the provider as configured', async () => {
    expect((await api().get('/api/auth/providers')).body).toEqual({ google: true });
  });

  it('creates a new student account, sets the session cookie and sends them to their profile', async () => {
    const res = await signIn('student', { sub: 'g-1', email: 'Asha.Rao@gmail.com', name: 'Asha Rao' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3000/student/profile?welcome=1');
    expect(String(res.headers['set-cookie'])).toContain('amn_token=');
    const u = await User.findOne({ email: 'asha.rao@gmail.com' }).select('+googleSub').lean();
    expect(u).toMatchObject({ role: 'student', googleSub: 'g-1', name: 'Asha Rao' });
    expect(await StudentProfile.exists({ user: u!._id })).toBeTruthy();
  });

  it('creates an unverified alumnus when the alumnus role was chosen', async () => {
    const res = await signIn('alumnus', { sub: 'g-2', email: 'old.grad@gmail.com', name: 'Old Grad' });
    expect(res.headers.location).toBe('http://localhost:3000/mentor/profile?welcome=1');
    const u = await User.findOne({ email: 'old.grad@gmail.com' }).lean();
    expect((await Alumnus.findOne({ user: u!._id }).lean())!.verificationStatus).toBe('unverified');
  });

  it('links to an existing account with the same email instead of creating a duplicate, and keeps its role', async () => {
    const s = await makeStudent();
    const email = (await User.findById(s.user._id).select('+email').lean())!.email;
    const res = await signIn('alumnus', { sub: 'g-3', email, name: 'Whatever' });
    expect(res.headers.location).toBe('http://localhost:3000/mentors'); // returning user → `next`
    expect(await User.countDocuments({ email })).toBe(1);
    const u = await User.findById(s.user._id).select('+googleSub').lean();
    expect(u!.googleSub).toBe('g-3');
    expect(u!.role).toBe('student');
    // password login reports the right hint for Google-only accounts
    const g = await signIn('student', { sub: 'g-4', email: 'only.google@gmail.com', name: 'G' });
    expect(g.status).toBe(302);
    const pw = await api().post('/api/auth/login').send({ email: 'only.google@gmail.com', password: 'anything' });
    expect(pw.status).toBe(401);
    expect(pw.body.error.message).toMatch(/Google/);
  });

  it('rejects unverified Google emails', async () => {
    const res = await signIn('student', { sub: 'g-5', email: 'x@gmail.com', name: 'X', email_verified: 'false' });
    expect(res.headers.location).toBe('http://localhost:3000/login?error=email_not_verified');
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects a forged or replayed state (nonce cookie mismatch)', async () => {
    const res = await signIn('student', { sub: 'g-6', email: 'y@gmail.com', name: 'Y' }, { tamperNonce: true });
    expect(res.headers.location).toBe('http://localhost:3000/login?error=invalid_state');
    expect(await User.countDocuments()).toBe(0);
  });

  it('rejects an ID token issued for another app', async () => {
    const res = await signIn('student', { sub: 'g-7', email: 'z@gmail.com', name: 'Z', aud: 'someone-else' });
    expect(res.headers.location).toBe('http://localhost:3000/login?error=invalid_token');
  });

  it('blocks suspended accounts', async () => {
    const s = await makeStudent();
    await User.updateOne({ _id: s.user._id }, { status: 'suspended' });
    const email = (await User.findById(s.user._id).select('+email').lean())!.email;
    const res = await signIn('student', { sub: 'g-8', email, name: 'S' });
    expect(res.headers.location).toBe('http://localhost:3000/login?error=suspended');
  });

  it('only accepts safe relative `next` paths', async () => {
    const start = await api().get('/api/auth/google/start?role=student&next=//evil.example.com');
    const state = new URL(start.headers.location).searchParams.get('state')!;
    const payload = JSON.parse(Buffer.from(state.split('.')[1], 'base64url').toString());
    expect(payload.next).toBe('');
  });
});

describe('Google sign-in and account security', () => {
  it('asks for the two-factor code after Google, and finishes with only the challenge cookie', async () => {
    const { encrypt } = await import('../src/lib/crypto.js');
    const { generateSecret, totp } = await import('../src/lib/totp.js');
    const secret = generateSecret();
    const u = await User.create({ name: 'Two Factor', email: 'two.factor@gmail.com', role: 'student', googleSub: 'g-mfa', emailVerifiedAt: new Date(), mfaEnabled: true, mfaSecret: encrypt(secret) });
    await StudentProfile.create({ user: u._id });

    const res = await signIn('student', { sub: 'g-mfa', email: 'two.factor@gmail.com', name: 'Two Factor' });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('http://localhost:3000/login?mfa=1&next=%2Fmentors');
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.some((c) => c.startsWith('amn_token='))).toBe(false); // no session from Google alone
    const mfa = cookies.find((c) => c.startsWith('amn_mfa='))!;
    expect(mfa).toBeTruthy();

    const challengeCookie = mfa.split(';')[0];
    expect((await api().post('/api/auth/login/2fa').set('Cookie', challengeCookie).send({ code: '000000' })).status).toBe(401);
    const ok = await api().post('/api/auth/login/2fa').set('Cookie', challengeCookie).send({ code: totp(secret) });
    expect(ok.status).toBe(200);
    expect(String(ok.headers['set-cookie'])).toContain('amn_token=');
    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${ok.body.token}`)).status).toBe(200);
  });

  it('removes a password set by whoever registered an unconfirmed address, once the real owner signs in with Google', async () => {
    // Someone registers the victim's address with their own password (never confirms it).
    const reg = await api().post('/api/auth/register').send({ name: 'Squatter', email: 'victim@gmail.com', password: 'Squat1pass', role: 'student' });
    expect(reg.status).toBe(201);
    const squatterSession = reg.body.token;

    // The real owner signs in with Google.
    const res = await signIn('student', { sub: 'g-victim', email: 'victim@gmail.com', name: 'Real Owner' });
    expect(res.status).toBe(302);

    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${squatterSession}`)).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: 'victim@gmail.com', password: 'Squat1pass' })).status).toBe(401);
    const u = await User.findOne({ email: 'victim@gmail.com' }).select('+passwordHash +googleSub').lean();
    expect(u!.passwordHash).toBeUndefined();
    expect(u!.googleSub).toBe('g-victim');
    expect(u!.emailVerifiedAt).toBeTruthy();
    // The owner's new Google session works.
    const session = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('amn_token='))!.split(';')[0];
    expect((await api().get('/api/auth/me').set('Cookie', session)).status).toBe(200);
  });

  it('keeps the password of a confirmed account when Google is linked', async () => {
    const reg = await api().post('/api/auth/register').send({ name: 'Confirmed', email: 'confirmed@gmail.com', password: 'Owner1pass', role: 'student' });
    await User.updateOne({ _id: reg.body.user.id }, { $set: { emailVerifiedAt: new Date() } });
    await signIn('student', { sub: 'g-conf', email: 'confirmed@gmail.com', name: 'Confirmed' });
    expect((await api().post('/api/auth/login').send({ email: 'confirmed@gmail.com', password: 'Owner1pass' })).status).toBe(200);
    expect((await api().get('/api/auth/me').set('Authorization', `Bearer ${reg.body.token}`)).status).toBe(200);
  });
});
