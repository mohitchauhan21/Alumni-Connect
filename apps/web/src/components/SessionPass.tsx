'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { relTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import TearTicket from './ui/tear-ticket';

export type Meeting = { id: string; title: string | null; scheduledStart: string | null; scheduledEnd: string | null; videoLink: string | null };

/** "Thu · 6:00 pm", or "Thu 4 Dec · 6:00 pm" when it's more than six days away. */
function when(start: Date) {
  const day = new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(start);
  const date = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(start);
  const time = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(start).replace(/\s?([ap])\.?m\.?/i, ' $1m').toLowerCase();
  const far = start.getTime() - Date.now() > 6 * 24 * 3600e3;
  return `${day}${far ? ` ${date}` : ''} · ${time}`;
}

/** Only real web links are followed; anything else falls back to the session page. */
const safeLink = (url: string | null) => (url && /^https:\/\/|^http:\/\//i.test(url) ? url : null);

/**
 * The session pass: a booked meeting as a ticket. Tearing the stub (drag it, or focus it and press
 * Enter) takes you straight into the video call, in this tab — a new tab opened after the tear
 * animation would be blocked by the browser. Shown to both the student and the mentor.
 */
export function SessionPass({ meeting, withName, mentorshipId }: { meeting: Meeting; withName: string; mentorshipId: string }) {
  const router = useRouter();
  const dark = useTheme().theme === 'dark';
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  if (!meeting.scheduledStart) return null;
  const start = new Date(meeting.scheduledStart);
  const end = meeting.scheduledEnd ? new Date(meeting.scheduledEnd) : new Date(start.getTime() + 45 * 60e3);
  const minutes = Math.max(5, Math.round((end.getTime() - start.getTime()) / 60e3));
  const live = now >= start.getTime() && now < end.getTime();
  const link = safeLink(meeting.videoLink);
  const sessionPage = `/mentorships/${mentorshipId}?tab=sessions`;

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-[480px] drop-shadow-[0_24px_40px_rgba(0,0,0,0.12)] dark:drop-shadow-[0_24px_40px_rgba(0,0,0,0.6)]">
        <TearTicket
          key={meeting.id}
          width={480}
          height={224}
          stubSize={140}
          radius={20}
          rotate={-2}
          tiltMax={6}
          background={dark ? '#1c1c1e' : '#ffffff'}
          color={dark ? '#f5f5f7' : '#1d1d1f'}
          ariaLabel={link ? `Tear the stub to join the video call with ${withName}` : `Tear the stub to open your session with ${withName}`}
          onTear={() => (link ? window.location.assign(link) : router.push(sessionPage))}
          stub={
            <div className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] opacity-50">Admit one</span>
              <span className="text-[22px] font-semibold tracking-[-0.03em]">Join</span>
              <span className="mt-2 text-[11px] opacity-50">Pull to tear ›</span>
            </div>
          }
        >
          <div className="flex h-full flex-col justify-between p-6 text-left">
            <div className="min-w-0">
              {live ? (
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ok-600 dark:text-[#30d158]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
                  </span>
                  Live now
                </span>
              ) : (
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand-600 dark:text-[#fb923c]">Session pass · {relTime(start.toISOString())}</span>
              )}
              <p className="mt-2 truncate text-[22px] font-semibold leading-tight tracking-[-0.03em]">{meeting.title || 'Mentoring session'}</p>
              <p className="mt-1 truncate text-[13px] opacity-60">
                with {withName} · {minutes} min
              </p>
            </div>
            <div className="flex gap-7 text-[12px]">
              <div>
                <div className="opacity-45">When</div>
                <div className="mt-0.5 font-semibold">{when(start)}</div>
              </div>
              <div>
                <div className="opacity-45">Where</div>
                <div className="mt-0.5 font-semibold">Video call</div>
              </div>
            </div>
          </div>
        </TearTicket>
      </div>
      <p className="mt-5 text-center text-[13px] text-ink-500">
        {link ? (live ? 'Your session has started — tear the stub to join.' : 'Tear the stub to join the video call.') : 'The video link appears once the session is confirmed.'}
      </p>
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
