/** A mentor's own Google Meet room: validated, private, and used as the video link of their sessions. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { normalizeMeetLink } from '../src/lib/meet.js';
import { Alumnus, Mentorship, Session } from '../src/models/index.js';
import { api, auth, clearDb, makeMentor, makeStudent, startDb, stopDb } from './helpers.js';

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const ROOM = 'https://meet.google.com/abc-defg-hij';

async function pair() {
  const mentor = await makeMentor();
  const student = await makeStudent();
  const m = await Mentorship.create({ student: student.profile._id, alumnus: mentor.alumnus._id });
  return { mu: mentor.user, su: student.user, alumnus: mentor.alumnus, m };
}

/** Mentor proposes one slot three days out; the student books it (free, so it's confirmed at once). */
async function book(p: Awaited<ReturnType<typeof pair>>) {
  const start = new Date(Date.now() + 72 * 3600e3);
  const prop = await api().post(`/api/mentorships/${p.m._id}/sessions`).set(auth(p.mu)).send({ slots: [{ start, end: new Date(start.getTime() + 3600e3) }], title: 'Mock interview' });
  expect(prop.status).toBe(201);
  const res = await api().post(`/api/mentorships/${p.m._id}/sessions/${prop.body.session.id}/book`).set(auth(p.su)).send({ slotIndex: 0 });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.session;
}

describe('Meet links', () => {
  it('normalises the shapes people paste and rejects anything that is not a Meet room', () => {
    expect(normalizeMeetLink('meet.google.com/ABC-DEFG-HIJ')).toBe(ROOM);
    expect(normalizeMeetLink(' https://meet.google.com/abc-defg-hij/?authuser=0 ')).toBe(ROOM);
    expect(normalizeMeetLink('https://meet.google.com.evil.example/abc-defg-hij')).toBeNull();
    expect(normalizeMeetLink('https://meet.google.com/lookup/xyz')).toBeNull();
    expect(normalizeMeetLink('https://zoom.us/j/123')).toBeNull();
  });
});

describe("a mentor's Meet room", () => {
  it('is saved on the profile, returned only to the mentor, and rejected when it is not a Meet link', async () => {
    const p = await pair();
    const bad = await api().put('/api/alumni/me').set(auth(p.mu)).send({ meetLink: 'https://zoom.us/j/123' });
    expect(bad.status).toBe(400);

    const ok = await api().put('/api/alumni/me').set(auth(p.mu)).send({ meetLink: 'meet.google.com/ABC-DEFG-HIJ' });
    expect(ok.status).toBe(200);
    const me = await api().get('/api/alumni/me').set(auth(p.mu));
    expect(me.body.profile.meetLink).toBe(ROOM);

    // A student browsing mentors never sees it.
    for (const path of [`/api/mentors/${p.alumnus._id}`, '/api/mentors/search']) {
      const pub = await api().get(path).set(auth(p.su));
      expect(pub.status, path).toBe(200);
      expect(JSON.stringify(pub.body)).not.toContain('meet.google.com');
    }
  });

  it('becomes the video link of newly confirmed sessions, instead of a Jitsi room', async () => {
    const p = await pair();
    await api().put('/api/alumni/me').set(auth(p.mu)).send({ meetLink: ROOM });
    const s = await book(p);
    expect(s.videoLink).toBe(ROOM);
  });

  it('updates already-booked upcoming sessions, and removing it gives them a fresh Jitsi room', async () => {
    const p = await pair();
    const s = await book(p);
    expect(s.videoLink).toMatch(/^https:\/\/meet\.jit\.si\//);

    await api().put('/api/alumni/me').set(auth(p.mu)).send({ meetLink: ROOM });
    expect((await Session.findById(s.id).lean())!.videoLink).toBe(ROOM);

    await api().put('/api/alumni/me').set(auth(p.mu)).send({ meetLink: '' });
    expect((await Session.findById(s.id).lean())!.videoLink).toMatch(/^https:\/\/meet\.jit\.si\//);
    expect((await Alumnus.findById(p.alumnus._id).select('+meetLink').lean())!.meetLink).toBeUndefined();
  });
});
