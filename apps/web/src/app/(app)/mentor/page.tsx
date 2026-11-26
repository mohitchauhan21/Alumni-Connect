'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clock, Inbox, PauseCircle, PlayCircle, ShieldCheck, Sparkles, Target, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/lib/theme';
import { Ring } from '@/components/motion';
import AnimatedList from '@/components/reactbits/AnimatedList';
import ClickSpark from '@/components/reactbits/ClickSpark';
import { Avatar, Badge, Card, CapacityMeter, EmptyState, LinkButton, Modal, PageHeader, PageLoader, Spinner, StatusBadge, cx, useToast } from '@/components/ui';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AREA_LABELS, DECLINE_LABELS, fmtDateTime, relTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { SessionPass, soonestMeeting } from '@/components/SessionPass';
import type { Capacity, MentorshipRequest, Mentorship } from '@/lib/types';

type Cap = Capacity & { maxPendingRequests: number; pendingRequests: number; visibleInDiscovery: boolean; pauseReason: string | null };

/**
 * Mentor inbox. Designed so a busy professional can triage in under a minute:
 * a keyboard-navigable list (React Bits AnimatedList) beside the full request, with
 * A / D shortcuts, one-click decline with optional reasons, and "decline all" when full.
 */
function Dashboard() {
  const toast = useToast();
  const { theme } = useTheme();
  const router = useRouter();
  const params = useSearchParams();
  const { me } = useAuth();
  const reqs = useApi<{ requests: MentorshipRequest[] }>('/requests?status=pending');
  const cap = useApi<{ capacity: Cap | null }>('/mentors/me/capacity');
  const ms = useApi<{ mentorships: Mentorship[] }>('/mentorships?status=active');
  const [selectedId, setSelectedId] = useState<string | null>(params.get('request'));
  const [declining, setDeclining] = useState<MentorshipRequest | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [declineAll, setDeclineAll] = useState(false);

  const pending = useMemo(() => reqs.data?.requests ?? [], [reqs.data]);
  const selected = pending.find((r) => r.id === selectedId) ?? pending[0] ?? null;
  const c = cap.data?.capacity;
  const full = c ? c.openSlots === 0 : false;

  // Deep link from notification emails: ?request=<id>&decline=1 opens the decline dialog directly.
  useEffect(() => {
    const id = params.get('request');
    if (id && params.get('decline') && reqs.data) {
      const r = reqs.data.requests.find((x) => x.id === id);
      if (r) setDeclining(r);
    }
  }, [params, reqs.data]);

  // A / D shortcuts (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!selected || declining || declineAll || busy || e.metaKey || e.ctrlKey || e.altKey) return;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key.toLowerCase() === 'a' && !full) {
        e.preventDefault();
        accept(selected);
      } else if (e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDeclining(selected);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, declining, declineAll, busy, full]);

  const verification = me?.profile.verificationStatus;
  if (verification && verification !== 'verified') {
    return (
      <>
        <PageHeader icon={ShieldCheck} eyebrow="Welcome" title="Let’s get you verified" subtitle="Students can only find mentors whose alumni status is confirmed against institutional records." />
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-ink-700">
              {verification === 'pending'
                ? 'Your verification is with the Alumni Relations office. You’ll be notified as soon as it’s complete — usually within two working days.'
                : 'It takes about two minutes: confirm your roll number and programme, and optionally attach your degree certificate.'}
            </p>
            <LinkButton href="/mentor/profile" variant="primary">
              {verification === 'pending' ? 'View status' : 'Start verification'}
            </LinkButton>
          </div>
        </Card>
      </>
    );
  }
  if (reqs.loading && !reqs.data) return <PageLoader />;

  async function accept(r: MentorshipRequest) {
    if (busy) return;
    setBusy(r.id);
    try {
      const res = await post<{ mentorshipId: string }>(`/requests/${r.id}/accept`);
      toast(`You’re now mentoring ${r.student?.name}. Say hello!`);
      setTimeout(() => router.push(`/mentorships/${res.mentorshipId}`), 450); // let the spark play; stay busy until we leave
    } catch (e: any) {
      toast(e.message, 'err');
      setBusy(null);
      reqs.reload();
      cap.reload();
    }
  }

  async function decline() {
    if (!declining) return;
    setBusy(declining.id);
    try {
      await post(`/requests/${declining.id}/decline`, { reason, note: note.trim() || null });
      toast('Declined kindly — the student has been pointed to other mentors.');
      setDeclining(null);
      setReason(null);
      setNote('');
      setSelectedId(null);
      reqs.reload();
      cap.reload();
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy(null);
    }
  }

  async function doDeclineAll() {
    setBusy('all');
    try {
      const r = await post<{ declined: number }>('/requests/decline-all', { reason: 'at_capacity' });
      toast(`Declined ${r.declined} request${r.declined === 1 ? '' : 's'} — each student was kindly redirected.`);
      setDeclineAll(false);
      reqs.reload();
      cap.reload();
    } finally {
      setBusy(null);
    }
  }

  async function togglePause() {
    if (!c) return;
    await post(c.paused ? '/mentors/me/resume' : '/mentors/me/pause', c.paused ? {} : { reason: 'Taking a short break' });
    toast(c.paused ? 'Welcome back — students can find you again.' : 'Paused. No new requests until you resume.');
    cap.reload();
  }

  const selectedIndex = Math.max(0, pending.findIndex((r) => r.id === selected?.id));
  const pass = soonestMeeting(ms.data?.mentorships ?? [], (m) => m.student.name);

  return (
    <>
      <PageHeader
        icon={Inbox}
        eyebrow="Mentor inbox"
        title={pending.length ? `${pending.length} request${pending.length === 1 ? '' : 's'} waiting` : 'You’re all caught up'}
        subtitle="Accept what you can, decline the rest — no explanation needed. Unanswered requests expire on their own."
        actions={
          c && (
            <>
              <div className="hidden items-center gap-3 rounded-[10px] border border-[color:var(--line)] bg-surface px-3 py-1.5 shadow-sm sm:flex">
                <CapacityMeter capacity={c} compact />
              </div>
              <button className="btn-secondary" onClick={togglePause}>
                {c.paused ? <PlayCircle size={15} /> : <PauseCircle size={15} />}
                {c.paused ? 'Resume' : 'Pause'}
              </button>
            </>
          )
        }
      />

      {/* the next meeting as a pass: tearing the stub joins the video call */}
      {pass && (
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="mb-8 rounded-[22px] bg-ink-900/[0.03] px-4 py-8" aria-label="Your next session">
          <SessionPass meeting={pass.meeting} withName={pass.withName} mentorshipId={pass.mentorshipId} />
        </motion.section>
      )}

      {full && pending.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-surface p-4 text-[13px] text-amber-900 dark:from-amber-500/10 dark:to-transparent sm:flex-row sm:items-center sm:justify-between">
          <span>
            <strong>You’re at capacity</strong>, so accepting is paused. Raise your limit, or decline — students are shown other mentors straight away.
          </span>
          <div className="flex gap-2">
            <LinkButton href="/mentor/availability">Adjust limit</LinkButton>
            <button className="btn-primary" onClick={() => setDeclineAll(true)}>
              Decline all
            </button>
          </div>
        </motion.div>
      )}

      {pending.length === 0 ? (
        <EmptyState title="No requests right now" body="New requests appear here. You’ll never receive more than your inbox limit at once, and you disappear from search automatically when you’re full." />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_1fr]">
          {/* list */}
          <div>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="eyebrow">Requests</span>
              <span className="hidden items-center gap-1 text-[11px] text-ink-400 lg:flex">
                <span className="kbd">↑</span>
                <span className="kbd">↓</span> to browse
              </span>
            </div>
            <AnimatedList
              key={pending.map((p) => p.id).join(',')}
              theme={theme}
              accentColor="#cf4a06"
              width="100%"
              maxHeight={560}
              gap={6}
              radius={14}
              animation="slide"
              enableArrowNavigation
              selectOnHover={false}
              initialSelectedIndex={selectedIndex}
              items={pending.map((r) => ({ id: r.id, title: r.student?.name ?? 'Student' }))}
              onItemSelect={(_, i) => setSelectedId(pending[i]?.id ?? null)}
              onSelectedChange={(i) => setSelectedId(pending[i]?.id ?? null)}
              renderItem={(_, i, isSel) => {
                const r = pending[i];
                const s = r.student!;
                const soon = new Date(r.expiresAt).getTime() - Date.now() < 2 * 864e5;
                return (
                  <div className="flex w-full min-w-0 items-center gap-3" onMouseDown={() => setSelectedId(r.id)}>
                    <Avatar name={s.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cx('truncate text-[13.5px] font-semibold', isSel ? 'text-ink-900' : 'text-ink-800')}>{s.name}</span>
                        {r.matchScore != null && <span className="shrink-0 rounded-md bg-brand-50 px-1.5 text-[10.5px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">{r.matchScore}</span>}
                      </div>
                      <div className="truncate text-[12px] text-ink-500">{s.targetRoles[0] ?? s.program ?? 'Student'}</div>
                    </div>
                    <span className={cx('flex shrink-0 items-center gap-1 text-[11px]', soon ? 'font-medium text-amber-700' : 'text-ink-400')}>
                      <Clock size={11} /> {relTime(r.expiresAt).replace('in ', '')}
                    </span>
                  </div>
                );
              }}
            />
          </div>

          {/* detail */}
          <AnimatePresence mode="wait">
            {selected && (
              <motion.div key={selected.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
                <div className="card overflow-hidden">
                  <div className="relative border-b border-[color:var(--line)] p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <Avatar name={selected.student!.name} size="lg" />
                        <div>
                          <h2 className="text-lg font-semibold tracking-[-0.02em]">{selected.student!.name}</h2>
                          <p className="text-[13px] text-ink-600">{[selected.student!.program, selected.student!.graduationYear && `Class of ${selected.student!.graduationYear}`].filter(Boolean).join(' · ')}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[12px] text-ink-500">
                            <Clock size={12} /> Sent {relTime(selected.createdAt)} · expires {relTime(selected.expiresAt)}
                          </p>
                        </div>
                      </div>
                      {selected.matchScore != null && <Ring value={selected.matchScore} label="fit" size={60} />}
                    </div>
                  </div>

                  <div className="space-y-5 p-5 sm:p-6">
                    <div>
                      <div className="eyebrow mb-2">Their message</div>
                      <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-800">{selected.message}</p>
                    </div>

                    {(selected.goals?.length || selected.student!.targetRoles.length) ? (
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <div className="eyebrow mb-2 flex items-center gap-1.5">
                            <Target size={12} /> Goals shared
                          </div>
                          <ul className="space-y-1.5 text-[13px] text-ink-700">
                            {(selected.goals?.length ? selected.goals.map((g) => g.title) : selected.student!.targetRoles).map((g) => (
                              <li key={g} className="flex gap-2">
                                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                                {g}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <div className="eyebrow mb-2">Looking for help with</div>
                          <div className="flex flex-wrap gap-1">
                            {selected.student!.mentoringAreasWanted.map((a) => (
                              <Badge key={a} tone="blue">
                                {AREA_LABELS[a]}
                              </Badge>
                            ))}
                            {selected.student!.interests.slice(0, 4).map((t) => (
                              <Badge key={t.id}>{t.name}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {selected.matchReasons.length > 0 && (
                      <div className="rounded-xl border border-[color:var(--line)] bg-ink-50/60 p-3.5">
                        <div className="eyebrow mb-1.5 flex items-center gap-1.5">
                          <Sparkles size={12} className="text-brand-600" /> Why you were matched
                        </div>
                        <p className="text-[13px] text-ink-700">{selected.matchReasons.slice(0, 2).join(' · ')}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-[color:var(--line)] bg-ink-50/40 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="flex gap-2">
                      <ClickSpark sparkColor={['#cf4a06', '#f43f5e', '#34c759']} sparkCount={12} sparkRadius={26} className="!h-auto !w-auto">
                        <button className="btn-brand px-5" disabled={full || busy === selected.id} onClick={() => accept(selected)}>
                          {busy === selected.id ? <Spinner /> : <Check size={15} />} Accept
                          <span className="kbd ml-1 border-white/30 bg-white/15 text-white shadow-none">A</span>
                        </button>
                      </ClickSpark>
                      <button className="btn-secondary" disabled={busy === selected.id} onClick={() => setDeclining(selected)}>
                        <X size={15} /> Decline <span className="kbd ml-1">D</span>
                      </button>
                    </div>
                    {pending.length > 1 && (
                      <button className="text-[12px] font-medium text-ink-500 hover:text-ink-800" onClick={() => setDeclineAll(true)}>
                        Decline all {pending.length}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* lower row */}
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <Card title="Current mentees" className="lg:col-span-2" actions={<Link href="/mentorships" className="text-[13px] font-medium text-brand-700">View all</Link>}>
          {(ms.data?.mentorships ?? []).length === 0 ? (
            <p className="muted">No active mentees yet.</p>
          ) : (
            <ul className="-my-2 divide-y divide-[color:var(--line)]">
              {ms.data!.mentorships.map((m) => (
                <li key={m.id}>
                  <Link href={`/mentorships/${m.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-ink-50">
                    <Avatar name={m.student.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium">{m.student.name}</div>
                      <div className="text-[12px] text-ink-500">{m.nextSessionAt ? `Next session ${fmtDateTime(m.nextSessionAt)}` : `Last activity ${relTime(m.lastActivityAt)}`}</div>
                    </div>
                    <StatusBadge status={m.health} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="How we protect your time">
          <ul className="space-y-3 text-[13px] text-ink-600">
            {[
              ['Throttled requests', 'Students can only send a few at a time, so each one is considered.'],
              ['Silence is fine', 'Unanswered requests expire after a week.'],
              ['Auto-hide when full', 'You leave search the moment your slots are taken.'],
              ['Private by design', 'Your email and phone are never shown to students.'],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200">
                  <Check size={11} strokeWidth={3} />
                </span>
                <span>
                  <span className="font-medium text-ink-800">{t}.</span> {d}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Modal
        open={!!declining}
        onClose={() => setDeclining(null)}
        title="Decline this request"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeclining(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={decline} disabled={busy === declining?.id}>
              {busy === declining?.id && <Spinner />} Decline kindly
            </button>
          </>
        }
      >
        <p className="text-[13px] text-ink-600">A reason is optional. {declining?.student?.name.split(' ')[0]} gets a kind note and is shown other mentors who fit.</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {Object.entries(DECLINE_LABELS).map(([k, l]) => (
            <button key={k} type="button" className={cx('chip', reason === k && 'chip-active')} onClick={() => setReason(reason === k ? null : k)}>
              {l}
            </button>
          ))}
        </div>
        <textarea className="input mt-4 min-h-[88px]" placeholder="Optional note, e.g. a suggestion for who else to ask" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
      </Modal>

      <Modal
        open={declineAll}
        onClose={() => setDeclineAll(false)}
        title={`Decline all ${pending.length} requests?`}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setDeclineAll(false)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={doDeclineAll} disabled={busy === 'all'}>
              {busy === 'all' && <Spinner />} Decline all
            </button>
          </>
        }
      >
        <p className="text-[13px] text-ink-600">Each student gets a kind note that you’re at capacity and is pointed to other mentors. Consider pausing as well, so new requests stop for a while.</p>
      </Modal>
    </>
  );
}

export default function MentorDashboardPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Dashboard />
    </Suspense>
  );
}
