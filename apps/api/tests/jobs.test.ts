/** POST /api/jobs/:group: background jobs run on demand by a host scheduler, behind a key. */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../src/config/env.js';
import { MentorshipRequest } from '../src/models/index.js';
import { api, clearDb, makeMentor, makeStudent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const KEY = 'k'.repeat(40);
afterEach(() => {
  env.cronSecret = '';
});

describe('job endpoint', () => {
  it('does not exist unless CRON_SECRET is set', async () => {
    const res = await api().post('/api/jobs/frequent?key=anything');
    expect(res.status).toBe(404);
  });

  it('refuses a missing or wrong key, even with the scheduler header', async () => {
    env.cronSecret = KEY;
    expect((await api().post('/api/jobs/frequent').set('x-antideploy-cron', '1')).status).toBe(401);
    expect((await api().post('/api/jobs/frequent?key=wrong')).status).toBe(401);
    expect((await api().post(`/api/jobs/frequent?key=${KEY}x`)).status).toBe(401);
  });

  it('runs a group with the right key, from the query or a header, and reports each job', async () => {
    env.cronSecret = KEY;
    const m = await makeMentor();
    const s = await makeStudent();
    const overdue = await MentorshipRequest.create({ student: s.profile._id, alumnus: m.alumnus._id, message: 'x'.repeat(30), status: 'pending', expiresAt: new Date(Date.now() - 60_000) });

    const res = await api().post(`/api/jobs/frequent?key=${KEY}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.results.map((r: { name: string }) => r.name)).toEqual(['request-expiry', 'session-reminders', 'payment-holds']);
    expect((await MentorshipRequest.findById(overdue._id).lean())!.status).toBe('expired');

    const weekly = await api().post('/api/jobs/weekly').set('x-cron-key', KEY);
    expect(weekly.status).toBe(200);
    expect(weekly.body.results.map((r: { name: string }) => r.name)).toEqual(['engagement-decay']);
  });

  it('answers 404 for a group that does not exist', async () => {
    env.cronSecret = KEY;
    expect((await api().post(`/api/jobs/nightly?key=${KEY}`)).status).toBe(404);
  });
});
