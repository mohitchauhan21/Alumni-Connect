/**
 * Private document storage, content-type checks on upload, and production config checks.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { productionConfigProblems } from '../src/config/validate.js';
import { sniffDocumentType } from '../src/lib/filetype.js';
import { Alumnus, User, VerificationRequest } from '../src/models/index.js';
import { LocalStorage, S3Storage, setStorage } from '../src/services/storage.js';
import { api, auth, clearDb, makeStaff, startDb, stopDb } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n%test document\n');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('file type detection', () => {
  it('identifies documents by content, not by name', () => {
    expect(sniffDocumentType(PDF)?.mime).toBe('application/pdf');
    expect(sniffDocumentType(PNG)?.mime).toBe('image/png');
    expect(sniffDocumentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe('image/jpeg');
    expect(sniffDocumentType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))?.mime).toBe('image/webp');
    expect(sniffDocumentType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(sniffDocumentType(Buffer.from('MZ\x90\0'))).toBeNull(); // a Windows executable
  });
});

describe('local storage', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amn-store-'));
  const s = new LocalStorage(dir);
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('round-trips, never overwrites, and refuses paths outside its folder', async () => {
    await s.put('verification/a.pdf', PDF, 'application/pdf');
    const chunks: Buffer[] = [];
    for await (const c of (await s.get('verification/a.pdf'))!) chunks.push(c as Buffer);
    expect(Buffer.concat(chunks).equals(PDF)).toBe(true);
    await expect(s.put('verification/a.pdf', PNG, 'image/png')).rejects.toThrow();
    expect(await s.get('verification/missing.pdf')).toBeNull();
    await expect(s.get('../secrets.txt')).rejects.toThrow('Invalid storage key');
    await expect(s.get('/etc/passwd')).rejects.toThrow('Invalid storage key');
    await s.remove('verification/a.pdf');
    expect(await s.get('verification/a.pdf')).toBeNull();
  });
});

describe('S3-compatible storage', () => {
  it('writes privately with server-side encryption and reads back through the API', async () => {
    const sent: any[] = [];
    const fake = {
      async send(cmd: any) {
        sent.push(cmd);
        if (cmd.constructor.name === 'GetObjectCommand') {
          if (cmd.input.Key === 'verification/missing.pdf') throw Object.assign(new Error('nope'), { name: 'NoSuchKey' });
          return { Body: Readable.from([PDF]) };
        }
        return {};
      },
    };
    const s = new S3Storage(fake, 'amn-docs', 'AES256');
    await s.put('verification/b.pdf', PDF, 'application/pdf');
    expect(sent[0].constructor.name).toBe('PutObjectCommand');
    expect(sent[0].input).toMatchObject({ Bucket: 'amn-docs', Key: 'verification/b.pdf', ContentType: 'application/pdf', ServerSideEncryption: 'AES256' });
    expect(sent[0].input.ACL).toBeUndefined(); // never public
    expect(await s.get('verification/b.pdf')).toBeInstanceOf(Readable);
    expect(await s.get('verification/missing.pdf')).toBeNull();
    const r2 = new S3Storage(fake, 'amn-docs', '');
    await r2.put('verification/c.pdf', PDF, 'application/pdf');
    expect(sent.at(-1).input.ServerSideEncryption).toBeUndefined();
  });
});

describe('verification uploads', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'amn-up-'));
  const savedEv = env.requireEmailVerification;
  beforeAll(async () => {
    await startDb();
    setStorage(new LocalStorage(dir));
  });
  afterAll(async () => {
    setStorage(null);
    await stopDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  beforeEach(clearDb);
  afterEach(() => {
    env.requireEmailVerification = savedEv;
  });

  async function alumnus(verifiedEmail = true) {
    const u = await User.create({ name: 'Rhea Kapoor', email: `rhea${Date.now()}@alumni.test`, role: 'alumnus', ...(verifiedEmail ? { emailVerifiedAt: new Date() } : {}) });
    await Alumnus.create({ user: u._id, verificationStatus: 'unverified' });
    return u;
  }
  const fields = (r: any) => r.field('fullName', 'Rhea Kapoor').field('rollNumber', '2018CS901').field('graduationYear', '2018').field('degree', 'B.Tech').field('department', 'Computer Science & Engineering');

  it('stores real documents privately and streams them only to staff', async () => {
    const u = await alumnus();
    const res = await fields(api().post('/api/alumni/verify').set(auth(u))).attach('documents', PDF, { filename: 'degree.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    const v = await VerificationRequest.findOne().lean();
    const key = v!.documents[0].storedName!;
    expect(key).toMatch(/^verification\/[0-9a-f-]{36}\.pdf$/);
    expect(fs.existsSync(path.join(dir, key))).toBe(true);

    const aro = await makeStaff('aro');
    const file = await api().get(`/api/alumni/verify/${v!._id}/documents/${v!.documents[0]._id}`).set(auth(aro)).buffer(true);
    expect(file.status).toBe(200);
    expect(file.headers['cache-control']).toBe('private, no-store');
    expect(Buffer.from(file.body).equals(PDF)).toBe(true);
    expect((await api().get(`/api/alumni/verify/${v!._id}/documents/${v!.documents[0]._id}`).set(auth(u))).status).toBe(403);
  });

  it('rejects files whose content is not a document, whatever they are called', async () => {
    const u = await alumnus();
    const res = await fields(api().post('/api/alumni/verify').set(auth(u))).attach('documents', Buffer.from('<html>not a pdf</html>'), { filename: 'degree.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('unsupported_file');
    expect(fs.readdirSync(dir).filter((f) => f !== 'verification')).toHaveLength(0);
  });

  it('turns oversized uploads into a clear 400', async () => {
    const u = await alumnus();
    const big = Buffer.concat([PDF, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await fields(api().post('/api/alumni/verify').set(auth(u))).attach('documents', big, { filename: 'big.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/5 MB/);
  });

  it('needs a confirmed email when that is required', async () => {
    env.requireEmailVerification = true;
    const u = await alumnus(false);
    const res = await fields(api().post('/api/alumni/verify').set(auth(u)));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('email_unverified');
  });
});

describe('production config checks', () => {
  const prod = { ...env, isProd: true };
  it('does nothing outside production', () => {
    expect(productionConfigProblems({ ...env, isProd: false })).toEqual({ errors: [], warnings: [] });
  });
  it('refuses unsafe production settings', () => {
    const { errors } = productionConfigProblems({ ...prod, jwtSecret: 'dev-only-insecure-secret-change-me', mongoUri: '', webOrigin: 'http://x', publicApiUrl: 'http://y', cookieSecure: false, dataEncryptionKey: '', smtpUrl: '' });
    const all = errors.join('\n');
    for (const k of ['JWT_SECRET', 'MONGODB_URI', 'WEB_ORIGIN', 'PUBLIC_API_URL', 'COOKIE_SECURE', 'DATA_ENCRYPTION_KEY', 'SMTP_URL', 'MAIL_FROM']) expect(all).toContain(k);
  });
  it('accepts a complete production setup', () => {
    const good = {
      ...prod,
      jwtSecret: 'x'.repeat(48),
      mongoUri: 'mongodb+srv://cluster.example.net/amn',
      webOrigin: 'https://mentor.college.edu',
      publicApiUrl: 'https://api.mentor.college.edu',
      cookieSecure: true,
      dataEncryptionKey: Buffer.alloc(32, 7).toString('base64'),
      smtpUrl: 'smtps://user:pass@smtp.college.edu',
      mailFrom: 'Alumni Mentoring <mentoring@college.edu>',
      storageDriver: 's3' as const,
      s3: { ...env.s3, bucket: 'amn-docs' },
      requireStaff2fa: true,
      requireEmailVerification: true,
      seedOnEmpty: false,
      paymentGateway: 'razorpay' as const,
      razorpay: { ...env.razorpay, keyId: 'rzp_live_example', keySecret: 'secret', webhookSecret: 'whsec' },
    };
    expect(productionConfigProblems(good)).toEqual({ errors: [], warnings: [] });
    expect(productionConfigProblems({ ...good, paymentGateway: 'off' as const }).errors).toEqual([]);
    expect(productionConfigProblems({ ...good, paymentGateway: 'test' as const }).errors.join()).toContain('PAYMENT_GATEWAY=test');
    expect(productionConfigProblems({ ...good, razorpay: { ...good.razorpay, webhookSecret: '' } }).errors.join()).toContain('RAZORPAY_WEBHOOK_SECRET');
  });
  it('a hosted demo needs no email, and must not send any', () => {
    const demo = {
      ...prod,
      hostedDemo: true,
      jwtSecret: 'x'.repeat(48),
      mongoUri: 'mongodb+srv://cluster.example.net/amn',
      webOrigin: 'https://demo.example.app',
      publicApiUrl: 'https://demo.example.app',
      cookieSecure: true,
      dataEncryptionKey: Buffer.alloc(32, 7).toString('base64'),
      smtpUrl: '',
      storageDriver: 's3' as const,
      s3: { ...env.s3, bucket: 'amn-docs' },
      seedOnEmpty: false,
      paymentGateway: 'off' as const,
    };
    const ok = productionConfigProblems(demo);
    expect(ok.errors).toEqual([]);
    expect(ok.warnings.join()).toContain('HOSTED_DEMO');
    expect(productionConfigProblems({ ...demo, smtpUrl: 'smtps://u:p@smtp.example.net' }).errors.join()).toContain('HOSTED_DEMO');
  });
});
