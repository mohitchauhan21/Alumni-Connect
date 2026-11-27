import cron from 'node-cron';
import { logger } from '../lib/logger.js';
import { autoResumeExpiredPauses } from '../services/capacity.js';
import { runEngagementDecay, sendActionItemReminders } from '../services/engagement.js';
import { expireRequests } from '../services/requests.js';
import { releaseExpiredHolds } from '../services/payments.js';
import { sendSessionReminders } from '../services/sessions.js';

/**
 * Background jobs. They run one of two ways:
 *  - on timers inside a long-running process (startJobs: the API with JOBS_IN_PROCESS, or worker.ts);
 *  - on demand, a whole `group` at a time, when a host's scheduler calls POST /api/jobs/:group
 *    (routes/jobs.ts). For hosts that stop the app between requests, such as Antideploy, where a
 *    timer inside the process would never fire. Each group then needs one scheduled call.
 *
 * Every job is safe to run late or twice: each one acts on whatever is due at the moment it runs.
 */
export type JobGroup = 'frequent' | 'hourly' | 'weekly';
type Job = { name: string; schedule: string; group: JobGroup; run: () => Promise<unknown> };

export const JOBS: Job[] = [
  { name: 'request-expiry', schedule: '*/10 * * * *', group: 'frequent', run: () => expireRequests() },
  { name: 'session-reminders', schedule: '*/5 * * * *', group: 'frequent', run: () => sendSessionReminders() },
  { name: 'payment-holds', schedule: '*/2 * * * *', group: 'frequent', run: () => releaseExpiredHolds() },
  { name: 'action-item-reminders', schedule: '15 * * * *', group: 'hourly', run: () => sendActionItemReminders() },
  { name: 'auto-resume-pauses', schedule: '30 * * * *', group: 'hourly', run: () => autoResumeExpiredPauses() },
  // Weekly engagement-decay job: Mondays 06:00 server time
  { name: 'engagement-decay', schedule: '0 6 * * 1', group: 'weekly', run: () => runEngagementDecay() },
];

export const JOB_GROUPS: JobGroup[] = ['frequent', 'hourly', 'weekly'];

const running = new Set<string>();

/** Runs one job, logging the outcome. A job already running in this process is skipped, not doubled. */
async function runJob(job: Job): Promise<{ name: string; ok: boolean; skipped?: true; ms?: number; result?: unknown; error?: string }> {
  if (running.has(job.name)) return { name: job.name, ok: true, skipped: true };
  running.add(job.name);
  const t = Date.now();
  try {
    const result = await job.run();
    logger.info(`job ${job.name} done`, { ms: Date.now() - t, result });
    return { name: job.name, ok: true, ms: Date.now() - t, result };
  } catch (e) {
    logger.error(`job ${job.name} failed`, { e: String(e) });
    return { name: job.name, ok: false, ms: Date.now() - t, error: String(e) };
  } finally {
    running.delete(job.name);
  }
}

/** Runs every job in a group, one after another. */
export async function runJobGroup(group: JobGroup) {
  const results = [];
  for (const job of JOBS.filter((j) => j.group === group)) results.push(await runJob(job));
  return results;
}

export function startJobs() {
  for (const job of JOBS) cron.schedule(job.schedule, () => void runJob(job));
  logger.info(`Scheduled ${JOBS.length} background jobs`);
}
