/**
 * Acceptance criterion: "Alumni contact details never exposed — proven by exhaustive endpoint testing."
 *
 * Strategy:
 *  1. Load the full demo seed (60+ alumni with real-looking emails, phones and LinkedIn URLs).
 *  2. Enumerate EVERY route registered on the Express app programmatically.
 *  3. Call every GET route as a student (and as a mentor), with real ids substituted for path params.
 *  4. Exercise every student-reachable write endpoint that returns data.
 *  5. Deep-scan every response body, and every Socket.IO event, for any alumni contact value.
 * A route added later without coverage here makes the "all routes covered" test fail.
 */
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { app, api, auth, startDb, stopDb } from './helpers.js';
import { attachSocket } from '../src/socket.js';
import { setIo } from '../src/lib/realtime.js';
import { runSeed } from '../src/seed/seed.js';
import { Alumnus, CareerGoal, Mentorship, MentorshipRequest, Payment, PaymentMethod, Session, StudentProfile, User, VerificationRequest, Goal, ActionItem } from '../src/models/index.js';
import { findPrivacyViolations } from '../src/serializers/index.js';
import { maskContactDetails } from '../src/lib/mask.js';

let student: any;
let mentorUser: any;
let secrets: string[] = []; // every alumni email, phone (several formats) and LinkedIn URL
let studentSecrets: string[] = [];
let ids: Record<string, string> = {};

/* ---------------------------------------------------- route enumeration */
type Route = { method: string; path: string };
function listRoutes(): Route[] {
  const out: Route[] = [];
  const walk = (stack: any[], prefix: string) => {
    for (const layer of stack) {
      if (layer.route) {
        const full = (prefix + layer.route.path).replace(/\/+$/, '') || '/';
        for (const m of Object.keys(layer.route.methods)) out.push({ method: m.toUpperCase(), path: full });
      } else if (layer.name === 'router' && layer.handle?.stack) {
        const src: string = layer.regexp.source;
        const seg = src === '^\\/?(?=\\/|$)' ? '' : src.replace('^\\/', '/').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
        walk(layer.handle.stack, prefix + seg);
      }
    }
  };
  walk((app as any)._router.stack, '');
  return out;
}

/* ----------------------------------------------------- leak detection */
function digitsOnly(s: string) {
  return s.replace(/\D/g, '');
}
function assertNoSecrets(label: string, body: unknown, list = secrets) {
  const text = JSON.stringify(body ?? '');
  const lower = text.toLowerCase();
  const digits = digitsOnly(text);
  for (const s of list) {
    if (s.includes('@') || s.startsWith('http')) {
      expect(lower.includes(s.toLowerCase()), `${label} leaked ${s}`).toBe(false);
    } else {
      // phone: check the 10 significant digits anywhere in the digit stream of the payload
      const sig = digitsOnly(s).slice(-10);
      expect(digits.includes(sig), `${label} leaked phone ${s}`).toBe(false);
    }
  }
  const v = findPrivacyViolations(body, { id: String(student?._id ?? ''), role: 'student', email: 'student@demo.edu' });
  expect(v.filter((p) => !p.endsWith('.email') && !p.endsWith('.phone')), `${label} forbidden keys`).toEqual([]);
}

/** Substitute real ids into a route path. Every `:param` must be replaced (asserted by callers). */
function fill(path: string): string {
  return path
    .replace('/jobs/:group', '/jobs/frequent')
    .replace('/students/me/goals/:id', `/students/me/goals/${ids.careerGoal}`)
    .replace('/payments/methods/:id', `/payments/methods/${ids.paymentMethod}`)
    .replace('/payments/:id', `/payments/${ids.payment}`)
    .replace('/mentors/:id', `/mentors/${ids.mentor}`)
    .replace('/mentorships/:id', `/mentorships/${ids.mentorship}`)
    .replace(':sid', ids.session)
    .replace(':gid', ids.goal)
    .replace(':aid', ids.action)
    .replace('/verify/:id/documents/:docId', `/verify/${ids.verification}/documents/${ids.doc}`)
    .replace('/verify/:id', `/verify/${ids.verification}`)
    .replace(':provider', 'google')
    .replace('/users/:id', `/users/${ids.mentorUser}`)
    .replace('/requests/:id', `/requests/${ids.request}`)
    .replace('/jobs/:job', '/jobs/expiry');
}

const QUERY: Record<string, string> = {
  '/api/messages': `?mentorshipId=`,
  '/api/mentors/search': '?hasCapacity=false&limit=100',
};

beforeAll(async () => {
  await startDb();
  await runSeed({ reset: true });
  student = await User.findOne({ email: 'student@demo.edu' }).lean();
  mentorUser = await User.findOne({ email: 'mentor@demo.edu' }).lean();

  const alumniUsers = await User.find({ role: 'alumnus' }).select('+email +phone').lean();
  const alumni = await Alumnus.find().select('+linkedinUrl').lean();
  secrets = [
    ...alumniUsers.map((u) => u.email),
    ...alumniUsers.map((u) => u.phone).filter(Boolean),
    ...alumni.map((a) => a.linkedinUrl).filter(Boolean),
  ] as string[];
  expect(secrets.length).toBeGreaterThan(150);
  const studentUsers = await User.find({ role: 'student', _id: { $ne: student._id } }).select('+email +phone').lean();
  studentSecrets = [...studentUsers.map((u) => u.email), ...studentUsers.map((u) => u.phone).filter(Boolean)] as string[];

  const sp = await StudentProfile.findOne({ user: student._id }).lean();
  const m = await Mentorship.findOne({ student: sp!._id, status: 'active' }).lean();
  const s = await Session.findOne({ mentorship: m!._id }).lean();
  const g = await Goal.findOne({ mentorship: m!._id }).lean();
  const a = await ActionItem.findOne({ mentorship: m!._id }).lean();
  const req = await MentorshipRequest.findOne({ student: sp!._id }).lean();
  const vr = await VerificationRequest.findOne({ status: 'pending' }).lean();
  const anyMentor = await Alumnus.findOne({ verificationStatus: 'verified' }).lean();
  const cg = await CareerGoal.findOne({ student: sp!._id }).lean();
  const pay = await Payment.findOne({ payer: student._id, status: 'paid' }).lean();
  const pm = await PaymentMethod.findOne({ user: student._id }).lean();
  ids = {
    careerGoal: String(cg!._id),
    mentorship: String(m!._id),
    session: String(s!._id),
    goal: String(g!._id),
    action: String(a!._id),
    request: String(req!._id),
    verification: String(vr!._id),
    doc: String(vr!.documents[0]._id),
    mentor: String(m!.alumnus),
    anyMentor: String(anyMentor!._id),
    mentorUser: String(mentorUser._id),
    payment: String(pay!._id),
    paymentMethod: String(pm!._id),
  };
  QUERY['/api/messages'] = `?mentorshipId=${ids.mentorship}`;
}, 240_000);

afterAll(stopDb);

describe('privacy: alumni contact details never reach a student', () => {
  it('the route table is enumerated', () => {
    const routes = listRoutes();
    expect(routes.length).toBeGreaterThan(60);
    expect(routes.some((r) => r.path === '/api/mentors/search')).toBe(true);
  });

  it('every GET endpoint, called as a student, returns no alumni email/phone/LinkedIn', async () => {
    const routes = listRoutes().filter((r) => r.method === 'GET');
    const ok200: string[] = [];
    for (const r of routes) {
      const p = fill(r.path);
      expect(p, `unfilled path parameter in ${r.path}`).not.toContain(':');
      const res = await api().get(p + (QUERY[r.path] ?? '')).set(auth(student));
      // Real ids are used, so a student either gets data (200), is refused (403 staff/mentor-only),
      // hits an unconfigured integration (501), or is redirected by an OAuth callback (302). Never 404/500.
      expect([200, 302, 403, 501], `${r.path} → ${res.status} ${JSON.stringify(res.body)}`).toContain(res.status);
      if (res.status === 200) ok200.push(r.path);
      assertNoSecrets(`GET ${r.path}`, res.body);
      if (res.type?.includes('text')) assertNoSecrets(`GET ${r.path} (text)`, res.text);
    }
    // The student-facing data endpoints really returned data (guards against vacuous passes).
    for (const must of ['/api/mentors/search', '/api/mentors/:id', '/api/mentorships', '/api/mentorships/:id', '/api/mentorships/:id/sessions', '/api/mentorships/:id/goals', '/api/mentorships/:id/feedback', '/api/messages', '/api/requests', '/api/students/me', '/api/notifications', '/api/auth/me', '/api/payments', '/api/payments/:id', '/api/payments/methods', '/api/payments/config']) {
      expect(ok200, `${must} should return 200 to a student`).toContain(must);
    }
  });

  it('every non-GET endpoint, called as a student, returns no contact data and never a 500', async () => {
    const routes = listRoutes().filter((r) => r.method !== 'GET');
    expect(routes.length).toBeGreaterThan(30);
    for (const r of routes) {
      const p = fill(r.path);
      expect(p, `unfilled path parameter in ${r.path}`).not.toContain(':');
      const res = await (api() as any)[r.method.toLowerCase()](p).set(auth(student)).send({});
      expect(res.status, `${r.method} ${r.path} → ${res.status} ${JSON.stringify(res.body)}`).toBeLessThan(500);
      assertNoSecrets(`${r.method} ${r.path}`, res.body);
    }
  });

  it('every GET endpoint, called as a mentor, returns no student contact details either (symmetric privacy)', async () => {
    const routes = listRoutes().filter((r) => r.method === 'GET');
    for (const r of routes) {
      const p = fill(r.path);
      const res = await api().get(p + (QUERY[r.path] ?? '')).set(auth(mentorUser));
      expect(res.body?.error?.code, `${r.path}`).not.toBe('privacy_guard');
      const text = JSON.stringify(res.body ?? '').toLowerCase();
      for (const s of studentSecrets.filter((x) => x.includes('@'))) expect(text.includes(s.toLowerCase()), `${r.path} leaked ${s}`).toBe(false);
    }
  });

  it('matching results across ALL verified mentors contain no contact data (paged, with every facet)', async () => {
    const seen = new Set<string>();
    for (const sort of ['relevance', 'experience', 'capacity']) {
      for (let offset = 0; offset < 120; offset += 25) {
        const res = await api().get(`/api/mentors/search?hasCapacity=false&limit=25&offset=${offset}&sort=${sort}`).set(auth(student));
        expect(res.status).toBe(200);
        assertNoSecrets('search', res.body);
        res.body.mentors.forEach((m: any) => seen.add(m.id));
        for (const m of res.body.mentors) {
          expect(Object.keys(m).sort()).toEqual(
            ['availability', 'bio', 'capacity', 'city', 'currentCompany', 'currentRole', 'degree', 'department', 'expertise', 'graduationYear', 'headline', 'id', 'industry', 'languages', 'match', 'mentoringAreas', 'name', 'sessionFee', 'verified', 'yearsExperience'].filter((k) => k in m).sort(),
          );
          expect(m.match.reasons.length).toBeGreaterThan(0);
        }
      }
    }
    const verified = await Alumnus.countDocuments({ verificationStatus: 'verified' });
    // every verified mentor not already mentoring this student was returned and checked
    expect(seen.size).toBeGreaterThanOrEqual(verified - 1);
    for (const facet of ['industries=Software', 'industries=FinTech,Data%20%26%20AI', 'areas=interview_prep', 'tags=Python', 'q=engineer', 'department=Computer%20Science%20%26%20Engineering', 'minYears=5']) {
      const res = await api().get(`/api/mentors/search?hasCapacity=false&limit=100&${facet}`).set(auth(student));
      assertNoSecrets(`search ${facet}`, res.body);
    }
  });

  it('every mentor profile page is clean', async () => {
    const all = await Alumnus.find({ verificationStatus: 'verified' }).select('_id').lean();
    for (const a of all) {
      const res = await api().get(`/api/mentors/${a._id}`).set(auth(student));
      expect(res.status).toBe(200);
      assertNoSecrets(`GET /mentors/${a._id}`, res.body);
    }
  });

  it('student-reachable write endpoints return no contact data', async () => {
    const h = auth(student);
    const target = (await Alumnus.findOne({ verificationStatus: 'verified', _id: { $ne: ids.mentor } }).sort({ _id: -1 }).lean())!;
    const calls = [
      api().put('/api/students/me').set(h).send({ bio: 'Updated bio' }),
      api().post('/api/students/me/goals').set(h).send({ title: 'Learn MLOps', targetRole: 'ML Engineer' }),
      api().post('/api/requests').set(h).send({ alumnusId: String(target._id), message: 'I would love your guidance on breaking into data science roles.' }),
      api().post('/api/messages').set(h).send({ mentorshipId: ids.mentorship, body: 'Hello! Looking forward to our next session.' }),
      api().post(`/api/mentorships/${ids.mentorship}/sessions`).set(h).send({ slots: [{ start: new Date(Date.now() + 3 * 864e5), end: new Date(Date.now() + 3 * 864e5 + 3600e3) }], agenda: 'Mock interview' }),
      api().post(`/api/mentorships/${ids.mentorship}/goals`).set(h).send({ title: 'Finish portfolio project' }),
      api().post(`/api/mentorships/${ids.mentorship}/actions`).set(h).send({ title: 'Read chapter 3', assignee: 'student' }),
      api().patch(`/api/mentorships/${ids.mentorship}/actions/${ids.action}`).set(h).send({ status: 'done' }),
      api().patch(`/api/mentorships/${ids.mentorship}/goals/${ids.goal}`).set(h).send({ status: 'in_progress' }),
      api().post(`/api/mentorships/${ids.mentorship}/feedback`).set(h).send({ rating: 5, kind: 'periodic', comment: 'Great' }),
      api().post('/api/messages/read').set(h).send({ mentorshipId: ids.mentorship }),
      api().post('/api/notifications/read').set(h).send({ all: true }),
      api().patch('/api/auth/me').set(h).send({ timezone: 'Asia/Kolkata' }),
      api().post('/api/auth/login').send({ email: 'student@demo.edu', password: 'Demo@1234' }),
    ];
    for (const c of calls) {
      const res = await c;
      expect(res.status, JSON.stringify(res.body)).toBeLessThan(500);
      assertNoSecrets(`write ${res.req.method} ${res.req.path}`, res.body);
    }
  });

  it('contact details typed into messages are masked before storage and delivery', async () => {
    const mentorEmail = (await User.findById(mentorUser._id).select('+email').lean())!.email;
    const res = await api()
      .post('/api/messages')
      .set(auth(mentorUser))
      .send({ mentorshipId: ids.mentorship, body: `Email me at ${mentorEmail} or call +91 98765 43210, or linkedin.com/in/priya-nair-1234` });
    expect(res.status).toBe(201);
    expect(res.body.message.body).not.toContain(mentorEmail);
    expect(res.body.message.body).not.toMatch(/98765\s?43210/);
    expect(res.body.message.body).not.toMatch(/linkedin\.com/);
    expect(res.body.message.masked).toBe(true);
    const list = await api().get(`/api/messages?mentorshipId=${ids.mentorship}`).set(auth(student));
    assertNoSecrets('messages after masking', list.body, [...secrets, mentorEmail]);
  });

  it('an alumnus cannot publish contact details in their own profile text', async () => {
    const mentorEmail = (await User.findById(mentorUser._id).select('+email').lean())!.email;
    const res = await api().put('/api/alumni/me').set(auth(mentorUser)).send({ bio: `Write to me: ${mentorEmail}, or WhatsApp +91 98765 43210`, headline: `DS lead | ${mentorEmail}` });
    expect(res.status).toBe(200);
    const view = await api().get(`/api/mentors/${ids.mentor}`).set(auth(student));
    assertNoSecrets('mentor profile after bio edit', view.body, [...secrets, mentorEmail]);
    expect(view.body.mentor.bio).toContain('[contact hidden]');
  });

  it('Socket.IO events delivered to a student contain no contact data', async () => {
    const server = http.createServer(app);
    const io = attachSocket(server);
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as any).port;
    const { tokenFor } = await import('./helpers.js');
    const client = ioClient(`http://127.0.0.1:${port}`, { auth: { token: tokenFor(student) }, transports: ['websocket'] });
    const events: unknown[] = [];
    client.onAny((_e, payload) => events.push(payload));
    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', reject);
    });
    await new Promise((r) => client.emit('join', ids.mentorship, r));
    const mentorEmail = (await User.findById(mentorUser._id).select('+email +phone').lean())!;
    await api().post('/api/messages').set(auth(mentorUser)).send({ mentorshipId: ids.mentorship, body: `my mail ${mentorEmail.email} phone ${mentorEmail.phone}` });
    await new Promise((r) => setTimeout(r, 400));
    expect(events.length).toBeGreaterThan(0);
    assertNoSecrets('socket events', events);
    client.close();
    io.close();
    setIo(null);
    await new Promise((r) => server.close(r));
  });

  it('full student flows (withdraw, book, cancel, complete, end) return no contact data', async () => {
    const hs = auth(student);
    const hm = auth(mentorUser);
    const scan = (label: string, res: any) => {
      expect(res.status, `${label}: ${JSON.stringify(res.body)}`).toBeLessThan(300);
      assertNoSecrets(label, res.body);
    };
    // withdraw
    const pend = await MentorshipRequest.findOne({ student: (await StudentProfile.findOne({ user: student._id }).lean())!._id, status: 'pending' }).lean();
    if (pend) scan('withdraw', await api().post(`/api/requests/${pend._id}/withdraw`).set(hs));
    // mentor proposes, student books, then completes after the start time
    const start = new Date(Date.now() + 5 * 864e5);
    const slot = { start, end: new Date(start.getTime() + 3600e3) };
    const p1 = await api().post(`/api/mentorships/${ids.mentorship}/sessions`).set(hm).send({ slots: [slot], title: 'Call me on 98765 43210', agenda: 'x' });
    scan('propose (mentor)', p1);
    expect(p1.body.session.title).toContain('[contact hidden]');
    const booked = await api().post(`/api/mentorships/${ids.mentorship}/sessions/${p1.body.session.id}/book`).set(hs).send({ slotIndex: 0 });
    scan('book', booked);
    // the demo mentor charges per session: pay through the test gateway (every response is scanned too)
    expect(booked.body.session.status).toBe('awaiting_payment');
    const co = await api().post('/api/payments/checkout').set(hs).send({ sessionId: p1.body.session.id });
    scan('checkout', co);
    const paid = await api().post('/api/payments/test/complete').set(hs).send({ paymentId: co.body.checkout.paymentId, method: { type: 'card', network: 'visa', cardType: 'credit', last4: '4242', expMonth: 12, expYear: new Date().getFullYear() + 2, save: true } });
    scan('pay', paid);
    expect(paid.body.session.status).toBe('scheduled');
    scan('payment (mentor view)', await api().get(`/api/payments/${paid.body.payment.id}`).set(hm));
    scan('earnings (mentor)', await api().get('/api/payments').set(hm));
    await Session.updateOne({ _id: p1.body.session.id }, { scheduledStart: new Date(Date.now() - 3600e3), scheduledEnd: new Date() });
    scan('complete', await api().post(`/api/mentorships/${ids.mentorship}/sessions/${p1.body.session.id}/complete`).set(hs).send({ summary: 'Good' }));
    // cancel
    const p2 = await api().post(`/api/mentorships/${ids.mentorship}/sessions`).set(hs).send({ slots: [{ start: new Date(Date.now() + 9 * 864e5), end: new Date(Date.now() + 9 * 864e5 + 1800e3) }] });
    scan('cancel', await api().post(`/api/mentorships/${ids.mentorship}/sessions/${p2.body.session.id}/cancel`).set(hs).send({ reason: 'exam' }));
    // career goal edit + delete
    const g = await api().post('/api/students/me/goals').set(hs).send({ title: 'Ship a portfolio project' });
    scan('goal create', g);
    scan('goal edit', await api().put(`/api/students/me/goals/${g.body.goal.id}`).set(hs).send({ title: 'Updated goal' }));
    scan('goal delete', await api().delete(`/api/students/me/goals/${g.body.goal.id}`).set(hs));
    // end the mentorship last (it closes messaging)
    scan('end', await api().post(`/api/mentorships/${ids.mentorship}/end`).set(hs).send({ outcome: 'completed' }));
    // everything the student can see afterwards is still clean
    for (const p of ['/api/mentorships?status=all', `/api/mentorships/${ids.mentorship}`, `/api/mentorships/${ids.mentorship}/sessions`, '/api/notifications', '/api/requests']) {
      scan(`after: ${p}`, await api().get(p).set(hs));
    }
  });

  it('the privacy guard blocks a response that would leak contact data', () => {
    const v = findPrivacyViolations({ mentors: [{ name: 'X', user: { email: 'x@alumni.test' } }] }, { id: '1', role: 'student', email: 'me@uni.test' });
    expect(v).toEqual(['$.mentors[0].user.email']);
    expect(findPrivacyViolations({ user: { email: 'me@uni.test' } }, { id: '1', role: 'student', email: 'me@uni.test' })).toEqual([]);
    expect(findPrivacyViolations({ a: { linkedinUrl: 'https://linkedin.com/in/x' } }, { id: '1', role: 'student' })).toHaveLength(1);
    expect(findPrivacyViolations({ contact: { email: 'x@y.z' } }, { id: '1', role: 'aro' })).toEqual([]);
  });

  it('masking catches obfuscations but leaves dates alone', () => {
    expect(maskContactDetails('reach me: priya [at] gmail [dot] com').count).toBe(1);
    expect(maskContactDetails('mail priya at gmail.com today').text).toBe('mail [contact hidden] today');
    // regression: a loose "me at x.y" match must not split a real address and leave "@gmail.com" behind
    const split = maskContactDetails('You can also reach me at aarav.personal@gmail.com or 98765 43210 — thanks').text;
    expect(split).toBe('You can also reach me at [contact hidden] or [contact hidden] — thanks');
    expect(maskContactDetails('Let us meet at 7 and discuss the data pipeline.').count).toBe(0);
    expect(maskContactDetails('Keep practising at leetcode.com and read docs at react.dev').count).toBe(0);
    expect(maskContactDetails('ping me at gmail dot com: priya.n').count).toBe(1);
    expect(maskContactDetails('call 98765-43210').count).toBe(1);
    expect(maskContactDetails('+91 (987) 654 3210').count).toBe(1);
    expect(maskContactDetails('wa.me/919876543210').count).toBeGreaterThanOrEqual(1);
    expect(maskContactDetails('Session on 2026-05-12 10:30, room 204').count).toBe(0);
  });

  // Last in the file: as admin, some writes change seeded data (a refund, a nudge, a job run).
  it('every route answers the alumni office, placement and admin without a server error; placement reaches only reporting', async () => {
    const staff = {
      aro: await User.findOne({ email: 'aro@demo.edu' }).lean(),
      placement: await User.findOne({ email: 'placement@demo.edu' }).lean(),
      admin: await User.findOne({ email: 'admin@demo.edu' }).lean(),
    };
    const placementOk: string[] = [];
    for (const [role, u] of Object.entries(staff)) {
      for (const r of listRoutes()) {
        const p = fill(r.path);
        const res = await (api() as any)[r.method.toLowerCase()](p + (r.method === 'GET' ? QUERY[r.path] ?? '' : '')).set(auth(u!)).send({});
        // 501 = an integration this server has no credentials for (e.g. Google Calendar), by design.
        expect(res.status < 500 || res.status === 501, `${role} ${r.method} ${r.path} → ${res.status} ${JSON.stringify(res.body)}`).toBe(true);
        if (role === 'placement' && r.method === 'GET' && res.status === 200) placementOk.push(r.path);
      }
    }
    // Placement is a read-only reporting role: no admin, verification, records, payments, mentorships or requests.
    const off = placementOk.filter((p) => /^\/api\/(admin|alumni\/(verify|records)|payments\/(?!config)|payments$|mentorships|requests|students|analytics\/mentors)/.test(p));
    expect(off, 'placement reached staff or participant data').toEqual([]);
    expect(placementOk).toEqual(expect.arrayContaining(['/api/analytics/programme', '/api/analytics/placement']));
  });
});
