'use client';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarClock, Clock, Compass, Send, Sparkles, UserRound } from 'lucide-react';
import Link from 'next/link';
import { MentorCard } from '@/components/MentorCard';
import { Ring, Stagger, StaggerItem } from '@/components/motion';
import { SessionCountdown, soonestMeeting } from '@/components/SessionCountdown';
import { Avatar, Card, EmptyState, LinkButton, PageLoader, Stat, StatusBadge, useToast } from '@/components/ui';
import { post } from '@/lib/api';
import { fmtDateTime, relTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import type { Mentor, MentorshipRequest, Mentorship } from '@/lib/types';

/** Profile strength drives match quality, so we show it and nudge towards completing it. */
function strength(p: any): { pct: number; missing: string[] } {
  if (!p) return { pct: 0, missing: [] };
  const checks: [boolean, string][] = [
    [!!p.goals?.length, 'a career goal'],
    [!!p.targetRoles?.length, 'target roles'],
    [!!p.targetIndustries?.length, 'target industries'],
    [(p.interests?.length ?? 0) >= 3, 'at least 3 interests'],
    [!!p.mentoringAreasWanted?.length, 'the help you want'],
    [!!p.department, 'your department'],
    [!!p.bio, 'a short bio'],
  ];
  const done = checks.filter(([ok]) => ok).length;
  return { pct: Math.round((done / checks.length) * 100), missing: checks.filter(([ok]) => !ok).map(([, l]) => l) };
}

export default function StudentHome() {
  const toast = useToast();
  const profile = useApi<{ profile: any; throttle: any }>('/students/me');
  const ms = useApi<{ mentorships: Mentorship[] }>('/mentorships');
  const reqs = useApi<{ requests: MentorshipRequest[] }>('/requests');
  const matches = useApi<{ mentors: Mentor[] }>('/mentors/search?limit=3');

  if (profile.loading && !profile.data) return <PageLoader />;
  const p = profile.data?.profile;
  const t = profile.data?.throttle;
  const first = p?.name?.split(' ')[0] ?? 'there';
  const active = (ms.data?.mentorships ?? []).filter((m) => m.status === 'active');
  const pendingReqs = (reqs.data?.requests ?? []).filter((r) => r.status === 'pending');
  const recent = (reqs.data?.requests ?? []).slice(0, 5);
  const { pct, missing } = strength(p);
  const pass = soonestMeeting(active, (m) => m.mentor.name);

  // The single most useful thing to do next. When a session is booked, its countdown takes this
  // spot instead, so the page never says the same thing twice.
  const hero =
    pct < 60
      ? { kicker: 'Next step', title: 'Finish your career profile', body: `Mentors are matched on your goals. Add ${missing.slice(0, 2).join(' and ')} to unlock better matches.`, cta: 'Complete profile', href: '/student/profile', icon: UserRound }
      : active.length
          ? { kicker: 'Keep momentum', title: `Book your next session with ${active[0].mentor.name.split(' ')[0]}`, body: 'Mentorships that meet every 2–3 weeks are the ones that last. Propose a couple of times that suit you.', cta: 'Propose times', href: `/mentorships/${active[0].id}?tab=sessions`, icon: CalendarClock }
          : pendingReqs.length
            ? { kicker: 'Waiting on a reply', title: `${pendingReqs.length} request${pendingReqs.length > 1 ? 's' : ''} with mentors`, body: 'Mentors have a week to reply. Meanwhile, explore other strong matches.', cta: 'See matches', href: '/mentors', icon: Clock }
            : { kicker: 'Next step', title: 'Find your first mentor', body: 'We’ve ranked verified alumni by how well they fit your goals — with the reasons why.', cta: 'See my matches', href: '/mentors', icon: Compass };

  async function withdraw(id: string) {
    try {
      await post(`/requests/${id}/withdraw`);
      toast('Request withdrawn — your slot is free again.');
      reqs.reload();
      profile.reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  const HeroIcon = hero.icon;
  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mb-8">
        <p className="mb-1.5 text-[14px] font-medium text-ink-500">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <h1 className="h1">Good to see you, {first}.</h1>
      </motion.div>

      {/* hero: the next best action (only when there's no session counting down) */}
      {!pass && (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }} className="card mb-6 p-6 sm:p-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-700">
              <HeroIcon size={14} /> {hero.kicker}
            </p>
            <h2 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.03em] sm:text-[28px]">{hero.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{hero.body}</p>
            <Link href={hero.href} className="btn-primary mt-6 px-5 py-2.5">
              {hero.cta}
            </Link>
          </div>
          <div className="flex items-center gap-4 sm:flex-col sm:text-center">
            <Ring value={pct} label="profile" size={84} />
            <div className="text-[13px]">
              <div className="font-semibold">Profile strength</div>
              <div className="text-ink-500">{pct === 100 ? 'Complete' : `${missing.length} thing${missing.length === 1 ? '' : 's'} to add`}</div>
              {pct < 100 && (
                <Link href="/student/profile" className="link mt-1 inline-block">
                  Improve
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.div>
      )}

      {/* the next meeting, counting down; Join switches on ten minutes before */}
      {pass && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }} className="mb-8" aria-label="Your next session">
          <SessionCountdown meeting={pass.meeting} withName={pass.withName} mentorshipId={pass.mentorshipId} />
        </motion.section>
      )}

      {t && (
        <Stagger className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StaggerItem>
            <Stat label="Active mentorships" value={`${t.activeMentorships}`} hint={`of ${t.maxActiveMentorships} allowed`} tone="good" />
          </StaggerItem>
          <StaggerItem>
            <Stat label="Awaiting reply" value={`${t.pending}`} hint={`of ${t.maxPending} at a time`} tone={t.pending >= t.maxPending ? 'warn' : undefined} />
          </StaggerItem>
          <StaggerItem>
            <Stat label="Requests left" value={`${Math.max(0, t.maxPerPeriod - t.inPeriod)}`} hint={`this ${t.periodDays}-day window`} tone={t.inPeriod >= t.maxPerPeriod ? 'warn' : undefined} />
          </StaggerItem>
          <StaggerItem>
            <Stat label="Top match" value={matches.data?.mentors[0]?.match ? `${matches.data.mentors[0].match.score}` : '—'} hint={matches.data?.mentors[0]?.name ?? 'Complete your profile'} />
          </StaggerItem>
        </Stagger>
      )}

      {/* mentorships and requests side by side; top matches in a row underneath */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Your mentorships" className="flex h-full min-h-[320px] flex-col" actions={<Link href="/mentorships" className="text-[13px] font-medium text-brand-700">View all</Link>}>
          {active.length === 0 ? (
            <EmptyState title="No active mentorship yet" body="Send a thoughtful request to one of your top matches." action={<LinkButton href="/mentors" variant="primary">Find a mentor</LinkButton>} />
          ) : (
            <div className="grid gap-3">
              {active.map((m) => (
                <Link key={m.id} href={`/mentorships/${m.id}`} className="group rounded-2xl border border-[color:var(--line)] p-4 transition hover:-translate-y-0.5 hover:border-[color:var(--line-strong)] hover:shadow-card">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.mentor.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-semibold">{m.mentor.name}</div>
                      <div className="truncate text-[12px] text-ink-500">{m.mentor.headline}</div>
                    </div>
                    <ArrowRight size={16} className="text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-ink-600" />
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-ink-900/[0.04] px-3 py-2 text-[12px]">
                    <span className="flex items-center gap-1.5 text-ink-600">
                      <CalendarClock size={13} /> {m.nextSessionAt ? fmtDateTime(m.nextSessionAt) : 'No session booked'}
                    </span>
                    <StatusBadge status={m.health} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title="Requests" className="flex h-full min-h-[320px] flex-col" actions={<span className="text-[12px] text-ink-400">Latest 5</span>}>
          {recent.length === 0 ? (
            <p className="muted">No requests yet.</p>
          ) : (
            <ol className="relative space-y-5 border-l border-[color:var(--line-strong)] pl-5">
              {recent.map((r) => (
                <li key={r.id} className="relative">
                  <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-surface ${r.status === 'accepted' ? 'bg-ok-400' : r.status === 'pending' ? 'bg-amber-400' : 'bg-ink-300'}`} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-medium">{r.mentor?.name}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="text-[12px] text-ink-500">
                        <Send size={11} className="mr-1 inline" />
                        Sent {relTime(r.createdAt)}
                        {r.status === 'pending' && ` · expires ${relTime(r.expiresAt)}`}
                        {r.status === 'declined' && r.declineNote && ` · “${r.declineNote}”`}
                      </p>
                    </div>
                    {r.status === 'pending' && (
                      <button className="btn-ghost px-2 py-1 text-[12px]" onClick={() => withdraw(r.id)}>
                        Withdraw
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <section className="mt-10" aria-label="Top matches">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="h2 flex items-center gap-1.5">
            <Sparkles size={15} className="text-ink-400" /> Top matches
          </h2>
          <Link href="/mentors" className="text-[13px] font-medium text-brand-700">
            See all
          </Link>
        </div>
        <Stagger className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(matches.data?.mentors ?? []).map((m, i) => (
            <StaggerItem key={m.id} className="h-full">
              <MentorCard m={m} topMatch={i === 0 && (m.match?.score ?? 0) >= 60} />
            </StaggerItem>
          ))}
        </Stagger>
        {matches.data && matches.data.mentors.length === 0 && <p className="muted">No mentors with open capacity match yet.</p>}
      </section>
    </>
  );
}
