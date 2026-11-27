'use client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, CalendarDays, CalendarPlus, Clock, Video } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cx } from './ui';

export type Meeting = { id: string; title: string | null; scheduledStart: string | null; scheduledEnd: string | null; videoLink: string | null };

/** Join opens this long before the start, so nobody is left staring at a disabled button. */
const JOIN_EARLY_MS = 10 * 60e3;

const fmtDay = (d: Date) => new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(d).replace(/\s?([ap])\.?m\.?/i, ' $1m').toLowerCase();

/** Only real web links are followed; anything else falls back to the session page. */
const safeLink = (url: string | null) => (url && /^https?:\/\//i.test(url) ? url : null);
const isMeet = (url: string | null) => !!url && /^https:\/\/meet\.google\.com\//i.test(url);

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/**
 * The next booked meeting as a live countdown: days, hours, minutes and seconds to the start, then a
 * "live" state with how far in you are. Join lights up ten minutes before and opens the call (Google
 * Meet when the mentor set their own room, otherwise the generated video link) in a new tab.
 * Shown to both the student and the mentor.
 *
 * `preview` renders the same card with inert buttons, for the landing page.
 */
export function SessionCountdown({
  meeting,
  withName,
  mentorshipId,
  preview = false,
  showDetails = true,
  extra,
}: {
  meeting: Meeting;
  withName: string;
  mentorshipId?: string;
  preview?: boolean;
  /** Off on the session page itself, where "Details" would link to where you already are. */
  showDetails?: boolean;
  /** Extra actions for this session (paid badge, log, cancel…) shown after the built-in ones. */
  extra?: React.ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (!meeting.scheduledStart) return null;
  const start = new Date(meeting.scheduledStart);
  const end = meeting.scheduledEnd ? new Date(meeting.scheduledEnd) : new Date(start.getTime() + 45 * 60e3);
  if (now >= end.getTime()) return null; // it's over; the dashboard moves on to the next one
  const minutes = Math.max(5, Math.round((end.getTime() - start.getTime()) / 60e3));
  const live = now >= start.getTime();
  const soon = !live && start.getTime() - now <= JOIN_EARLY_MS;
  const canJoin = live || soon;
  const link = safeLink(meeting.videoLink);
  const where = isMeet(link) ? 'Google Meet' : 'Video call';
  const sessionPage = mentorshipId ? `/mentorships/${mentorshipId}?tab=sessions` : '#';
  const left = parts(start.getTime() - now);
  const elapsed = Math.min(1, (now - start.getTime()) / (end.getTime() - start.getTime()));

  const status = live ? 'Live now' : soon ? 'Starting soon' : 'Next session';
  const tone = live || soon ? 'text-ok-600 dark:text-[#30d158]' : 'text-brand-600';

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[color:var(--line)] bg-surface p-6 shadow-card sm:p-8">
      <div aria-hidden className={cx('pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-3xl', live || soon ? 'bg-ok-400/20' : 'bg-brand-500/15')} />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <span className={cx('inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]', tone)}>
          <span className="relative flex h-2 w-2">
            {(live || soon) && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          {status}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900/[0.05] px-3 py-1 text-[12px] font-medium text-ink-600">
          <Video size={13} /> {where}
        </span>
      </div>

      <h3 className="relative mt-4 truncate text-[24px] font-semibold leading-tight tracking-[-0.03em] sm:text-[26px]">{meeting.title || 'Mentoring session'}</h3>
      <p className="relative mt-1 truncate text-[14px] text-ink-500">
        with {withName} · {minutes} min
      </p>

      <div className="relative mt-6">
        {live ? (
          <div>
            <div className="flex items-baseline justify-between text-[13px] text-ink-500">
              <span>
                Started {fmtTime(start)} · ends {fmtTime(end)}
              </span>
              <span className="tabular-nums">{Math.max(0, Math.ceil((end.getTime() - now) / 60e3))} min left</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-900/[0.07]">
              <div className="h-full rounded-full bg-ok-400 transition-[width] duration-1000 ease-linear" style={{ width: `${elapsed * 100}%` }} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:gap-3" role="timer" aria-label={`Starts in ${left.d} days ${left.h} hours ${left.m} minutes`}>
            <Unit value={left.d} label={left.d === 1 ? 'day' : 'days'} />
            <Unit value={left.h} label="hrs" />
            <Unit value={left.m} label="min" />
            <Unit value={left.s} label="sec" />
          </div>
        )}
        <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-500">
          <CalendarDays size={14} className="shrink-0" />
          {fmtDay(start)} · {fmtTime(start)}
        </p>
      </div>

      <div className="relative mt-6 flex flex-wrap items-center gap-2">
        {preview ? (
          <span className={cx('btn px-5 py-2.5 text-[14px]', 'bg-ink-900/[0.06] text-ink-500')}>
            <Clock size={15} /> Join opens 10 min before
          </span>
        ) : canJoin ? (
          link ? (
            <a href={link} target="_blank" rel="noopener noreferrer" className="btn bg-ok-600 px-5 py-2.5 text-[14px] text-white hover:bg-ok-700">
              <Video size={15} /> Join {where === 'Google Meet' ? 'on Google Meet' : 'the call'} <ArrowUpRight size={14} />
            </a>
          ) : (
            <Link href={sessionPage} className="btn-primary px-5 py-2.5 text-[14px]">
              Open session <ArrowUpRight size={14} />
            </Link>
          )
        ) : (
          <span className="btn cursor-default bg-ink-900/[0.06] px-5 py-2.5 text-[14px] text-ink-500" title="The Join button switches on 10 minutes before the start">
            <Clock size={15} /> Join opens 10 min before
          </span>
        )}
        {!preview && mentorshipId && (
          <>
            <a href={`/api/mentorships/${mentorshipId}/sessions/${meeting.id}/ics`} className="btn-ghost px-4 py-2.5 text-[14px]">
              <CalendarPlus size={15} /> Add to calendar
            </a>
            {showDetails && (
              <Link href={sessionPage} className="btn-ghost px-4 py-2.5 text-[14px]">
                Details
              </Link>
            )}
          </>
        )}
        {extra}
        {preview && (
          <span className="btn-ghost pointer-events-none px-4 py-2.5 text-[14px]">
            <CalendarPlus size={15} /> Add to calendar
          </span>
        )}
      </div>
    </div>
  );
}

/** One countdown tile; the digits slide when they change. */
function Unit({ value, label }: { value: number; label: string }) {
  const reduce = useReducedMotion();
  const text = String(value).padStart(2, '0');
  return (
    <div className="rounded-2xl bg-ink-900/[0.04] px-2 py-3 text-center dark:bg-white/[0.05]">
      <div className="relative h-[34px] overflow-hidden text-[28px] font-semibold leading-[34px] tracking-[-0.04em] tabular-nums sm:h-[40px] sm:text-[34px] sm:leading-[40px]">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={text}
            className="block"
            initial={reduce ? false : { y: '-100%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            exit={reduce ? undefined : { y: '100%', opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {text}
          </motion.span>
        </AnimatePresence>
      </div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-400">{label}</div>
    </div>
  );
}

/** The soonest meeting across mentorships, with the other person's name. */
export function soonestMeeting<T extends { id: string; nextMeeting?: Meeting | null }>(items: T[], nameOf: (m: T) => string) {
  const withMeeting = items.filter((m) => m.nextMeeting?.scheduledStart);
  withMeeting.sort((a, b) => +new Date(a.nextMeeting!.scheduledStart!) - +new Date(b.nextMeeting!.scheduledStart!));
  const m = withMeeting[0];
  return m ? { meeting: m.nextMeeting!, withName: nameOf(m), mentorshipId: m.id } : null;
}
