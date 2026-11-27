import crypto from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import { notFound, unauthorized } from '../lib/errors.js';
import { ah } from '../middleware/common.js';
import { JOB_GROUPS, runJobGroup, type JobGroup } from '../jobs/index.js';

/**
 * POST /api/jobs/:group?key=<CRON_SECRET> runs one group of background jobs (jobs/index.ts) and
 * answers with what each did. It's for host schedulers that call an address on a timetable, such as
 * Antideploy's scheduled jobs, because the app may be stopped between requests and in-process timers
 * would never fire.
 *
 * Off unless CRON_SECRET is set. A scheduler's own header can be sent by anyone, so the key is what
 * protects it; it is compared in constant time. The key may also come in an x-cron-key header.
 */
const r = Router();

const sameKey = (given: string, expected: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

r.post(
  '/:group',
  ah(async (req, res) => {
    if (!env.cronSecret) throw notFound('Route');
    const key = String(req.get('x-cron-key') ?? req.query.key ?? '');
    if (!key || !sameKey(key, env.cronSecret)) throw unauthorized('A valid job key is required');
    const group = req.params.group as JobGroup;
    if (!JOB_GROUPS.includes(group)) throw notFound('Job group');
    const results = await runJobGroup(group);
    res.json({ group, ok: results.every((x) => x.ok), results });
  }),
);

export default r;
