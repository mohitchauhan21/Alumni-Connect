'use client';
import { Receipt } from 'lucide-react';
import { SessionCountdown } from '@/components/SessionCountdown';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Checkout } from '@/components/payments/Checkout';
import { Badge, Card, EmptyState, Field, Modal, Spinner, StatusBadge, cx, useToast } from '@/components/ui';
import { get, patch, post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AREA_LABELS, DAYS, fmtDate, fmtDateTime, minutesToTime, relTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { inr, usePaymentConfig } from '@/lib/payments';
import { getSocket } from '@/lib/socket';
import type { CareerGoal, Mentorship, SessionT } from '@/lib/types';

type Role = 'student' | 'mentor' | 'staff';

/* -------------------------------------------------------------- overview */
export function OverviewTab({ m, careerGoals, stats, onGo }: { m: Mentorship; careerGoals: CareerGoal[]; stats: { sessionsCompleted: number; goals: number; openActions: number }; onGo: (t: string) => void }) {
  const s = m.student;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="grid grid-cols-3 gap-3">
          <button className="card p-4 text-left hover:shadow-md" onClick={() => onGo('sessions')}>
            <div className="text-2xl font-semibold">{stats.sessionsCompleted}</div>
            <div className="text-xs text-ink-500">sessions held</div>
          </button>
          <button className="card p-4 text-left hover:shadow-md" onClick={() => onGo('goals')}>
            <div className="text-2xl font-semibold">{stats.goals}</div>
            <div className="text-xs text-ink-500">shared goals</div>
          </button>
          <button className="card p-4 text-left hover:shadow-md" onClick={() => onGo('goals')}>
            <div className="text-2xl font-semibold">{stats.openActions}</div>
            <div className="text-xs text-ink-500">open actions</div>
          </button>
        </div>
        <Card title="Student's career goals">
          {careerGoals.length ? (
            <ul className="space-y-2">
              {careerGoals.map((g) => (
                <li key={g.id}>
                  <div className="font-medium">{g.title}</div>
                  <div className="text-xs text-ink-500">{[g.targetRole, g.targetIndustry].filter(Boolean).join(' · ')}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No goals listed.</p>
          )}
        </Card>
      </div>
      <div className="space-y-6">
        <Card title="About the student">
          <p className="text-sm text-ink-700">{s.bio ?? '—'}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {s.targetRoles.map((r) => <Badge key={r}>{r}</Badge>)}
            {s.mentoringAreasWanted.map((a) => <Badge key={a} tone="blue">{AREA_LABELS[a]}</Badge>)}
          </div>
        </Card>
        {m.mentor.availability && (
          <Card title="Mentor availability">
            <ul className="space-y-1 text-sm">
              {m.mentor.availability.map((w) => (
                <li key={w.id} className="flex justify-between">
                  <span>{DAYS[w.dayOfWeek]}</span>
                  <span>
                    {minutesToTime(w.startMinute)}–{minutesToTime(w.endMinute)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <p className="text-xs text-ink-500">All contact happens here on the platform. Email addresses and phone numbers typed into messages are hidden automatically.</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- sessions */
export function SessionsTab({ id, role, active, mentorFee = 0, otherName = 'the other person' }: { id: string; role: Role; active: boolean; mentorFee?: number; otherName?: string }) {
  const toast = useToast();
  const { me } = useAuth();
  const pay = usePaymentConfig();
  const [paying, setPaying] = useState<SessionT | null>(null);
  const charges = !!pay?.enabled && mentorFee > 0;
  const feeLabel = inr(Math.min(mentorFee, pay?.maxSessionFee ?? mentorFee) * 100);
  const { data, reload } = useApi<{ sessions: SessionT[] }>(`/mentorships/${id}/sessions`);
  const [proposing, setProposing] = useState(false);
  const [slots, setSlots] = useState<{ date: string; time: string; duration: number }[]>([{ date: '', time: '19:00', duration: 45 }]);
  const [title, setTitle] = useState('Mentoring session');
  const [agenda, setAgenda] = useState('');
  const [logging, setLogging] = useState<SessionT | null>(null);
  const [summary, setSummary] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [busy, setBusy] = useState(false);

  async function propose() {
    setBusy(true);
    try {
      const body = {
        title,
        agenda: agenda || undefined,
        slots: slots.filter((s) => s.date).map((s) => {
          const start = new Date(`${s.date}T${s.time}`);
          return { start: start.toISOString(), end: new Date(start.getTime() + s.duration * 60000).toISOString() };
        }),
      };
      await post(`/mentorships/${id}/sessions`, body);
      toast('Times proposed — waiting for the other person to pick one.');
      setProposing(false);
      setSlots([{ date: '', time: '19:00', duration: 45 }]);
      setAgenda('');
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }
  async function book(s: SessionT, i: number) {
    try {
      const r = await post<{ session: SessionT }>(`/mentorships/${id}/sessions/${s.id}/book`, { slotIndex: i });
      if (r.session.status === 'awaiting_payment') {
        if (role === 'student') setPaying(r.session);
        else toast(`Time picked. ${otherName} has 30 minutes to pay ${inr(r.session.fee)} to confirm it.`);
      } else toast('Session confirmed. Video link and calendar file are ready.');
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }
  async function cancel(s: SessionT) {
    // Paid sessions: tell the student up front whether this cancellation is refunded.
    if (s.paid && role === 'student') {
      const cutoff = pay?.refundCutoffHours ?? 24;
      const hours = s.scheduledStart ? (new Date(s.scheduledStart).getTime() - Date.now()) / 3600e3 : 0;
      const msg = hours >= cutoff ? `You'll get a full refund of ${inr(s.fee)}.` : `It's less than ${cutoff} hours before the session, so the ${inr(s.fee)} won't be refunded.`;
      if (!window.confirm(`Cancel this session? ${msg}`)) return;
    }
    const reason = window.prompt('Reason for cancelling (optional)') ?? undefined;
    try {
      const r = await post<{ refund: { refunded: boolean; amount: number; status: string } | null }>(`/mentorships/${id}/sessions/${s.id}/cancel`, { reason });
      if (r.refund?.refunded) toast(`Session cancelled. ${role === 'student' ? 'Your' : `${otherName}'s`} refund of ${inr(r.refund.amount)} is on its way.`);
      else if (r.refund && !r.refund.refunded && r.refund.status === 'late') toast('Session cancelled. Late cancellations are not refunded.');
      else toast('Session cancelled.');
    } catch (e: any) {
      toast(e.message, 'err');
    }
    reload();
  }
  async function log(outcome: 'completed' | 'no_show') {
    if (!logging) return;
    try {
      await post(`/mentorships/${id}/sessions/${logging.id}/complete`, { outcome, summary: summary || undefined, mentorPrivateNotes: role === 'mentor' ? privateNotes || undefined : undefined });
      toast('Session logged');
      setLogging(null);
      setSummary('');
      setPrivateNotes('');
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  const sessions = data?.sessions ?? [];
  const upcoming = sessions.filter((s) => s.status === 'proposed' || s.status === 'awaiting_payment' || s.status === 'scheduled');
  const past = sessions.filter((s) => !['proposed', 'awaiting_payment', 'scheduled'].includes(s.status));
  // The next confirmed meeting that hasn't ended, shown as a live countdown with Join.
  const meeting = role === 'staff' ? undefined : sessions.filter((s) => s.status === 'scheduled' && s.scheduledStart && new Date(s.scheduledEnd ?? s.scheduledStart).getTime() > Date.now()).sort((a, b) => +new Date(a.scheduledStart!) - +new Date(b.scheduledStart!))[0];
  // The countdown already shows that session, so the list below only holds the others.
  const others = meeting ? upcoming.filter((s) => s.id !== meeting.id) : upcoming;
  const meetingBegun = !!meeting?.scheduledStart && new Date(meeting.scheduledStart).getTime() <= Date.now();
  const meetingStarted = !!meeting?.scheduledStart && new Date(meeting.scheduledStart).getTime() < Date.now() + 15 * 60000;

  return (
    <div className="space-y-6">
      {meeting && (
        <section aria-label="Your next session">
          <SessionCountdown
            meeting={{ id: meeting.id, title: meeting.title ?? null, scheduledStart: meeting.scheduledStart ?? null, scheduledEnd: meeting.scheduledEnd ?? null, videoLink: meeting.videoLink ?? null }}
            withName={otherName}
            mentorshipId={id}
            showDetails={false}
            extra={
              <>
                {meeting.calendarSynced && <Badge tone="green">In your calendar</Badge>}
                {meeting.paid &&
                  (role === 'student' && meeting.paymentId ? (
                    <Link href={`/payments/${meeting.paymentId}`} className="inline-flex items-center gap-1 self-center px-2 text-[13px] font-medium text-brand-700 hover:underline">
                      <Receipt size={13} /> Paid {inr(meeting.fee)}
                    </Link>
                  ) : (
                    <Badge tone="green">Paid {inr(meeting.fee)}</Badge>
                  ))}
                {meetingStarted && (
                  <button className="btn-secondary px-4 py-2.5 text-[14px]" onClick={() => setLogging(meeting)}>
                    Log session
                  </button>
                )}
                {!meetingBegun && (
                  <button className="btn-ghost px-4 py-2.5 text-[14px] text-ink-500" onClick={() => cancel(meeting)}>
                    Cancel
                  </button>
                )}
              </>
            }
          />
        </section>
      )}
      <Card title={meeting ? 'Other upcoming sessions' : 'Upcoming'} actions={active && role !== 'staff' && <button className="btn-primary text-xs" onClick={() => setProposing(true)}>Propose times</button>}>
        {others.length === 0 ? (
          meeting ? (
            <p className="muted">Nothing else booked yet. Propose times for your next session whenever you’re ready.</p>
          ) : (
            <EmptyState title="No upcoming sessions" body="Propose two or three times that suit you — the other person picks one." />
          )
        ) : (
          <ul className="space-y-4">
            {others.map((s) => {
              const mine = s.proposedBy === me?.user.id;
              const started = s.scheduledStart && new Date(s.scheduledStart).getTime() < Date.now() + 15 * 60000;
              // Once a booked session's time has come it can't be cancelled, only logged.
              const begun = s.status === 'scheduled' && !!s.scheduledStart && new Date(s.scheduledStart).getTime() <= Date.now();
              return (
                <li key={s.id} className="rounded-xl border border-ink-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.title}</span>
                      <StatusBadge status={s.status} />
                    </div>
                    {(s.status === 'scheduled' || s.status === 'awaiting_payment') && <span className="text-sm font-medium">{fmtDateTime(s.scheduledStart)}</span>}
                  </div>
                  {s.agenda && <p className="mt-1 text-sm text-ink-600">{s.agenda}</p>}
                  {s.status === 'proposed' && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs text-ink-500">{mine ? 'Waiting for the other person to choose:' : 'Pick a time that works for you:'}</p>
                      {charges && (
                        <p className="mb-2 text-xs text-ink-500">
                          {role === 'student' ? (
                            <>
                              Each session costs <span className="font-semibold text-ink-800">{feeLabel}</span>. You pay when a time is picked; the slot is held for 30 minutes.
                            </>
                          ) : (
                            <>
                              Sessions cost {feeLabel}; {otherName} pays when a time is picked.
                            </>
                          )}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {s.proposedSlots.map((sl, i) => (
                          <button key={i} className={mine || role === 'staff' || !active ? 'chip' : 'btn-secondary'} disabled={mine || role === 'staff' || !active} onClick={() => book(s, i)}>
                            {fmtDateTime(sl.start)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {s.status === 'awaiting_payment' && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-3.5 py-3 ring-1 ring-inset ring-amber-200">
                      <p className="text-[13px] text-amber-900">
                        {role === 'student' ? (
                          <>
                            Pay <span className="font-semibold">{inr(s.fee)}</span> to confirm this time.
                          </>
                        ) : (
                          <>Waiting for {otherName} to pay {inr(s.fee)}.</>
                        )}{' '}
                        The slot is held until {fmtDateTime(s.paymentDueAt)}.
                      </p>
                      {role === 'student' && (
                        <button className="btn-primary" onClick={() => setPaying(s)}>
                          Pay {inr(s.fee)}
                        </button>
                      )}
                    </div>
                  )}
                  {s.status === 'scheduled' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.videoLink && (
                        <a className="btn-primary" href={s.videoLink} target="_blank" rel="noopener noreferrer">
                          Join video call
                        </a>
                      )}
                      <a className="btn-secondary" href={`/api/mentorships/${id}/sessions/${s.id}/ics`}>
                        Add to calendar (.ics)
                      </a>
                      {s.calendarSynced && <Badge tone="green">In your calendar</Badge>}
                      {s.paid &&
                        (role === 'student' && s.paymentId ? (
                          <Link href={`/payments/${s.paymentId}`} className="inline-flex items-center gap-1 self-center text-xs font-medium text-brand-700 hover:underline">
                            <Receipt size={13} /> Paid {inr(s.fee)}
                          </Link>
                        ) : (
                          <Badge tone="green">Paid {inr(s.fee)}</Badge>
                        ))}
                      {started && role !== 'staff' && (
                        <button className="btn-secondary" onClick={() => setLogging(s)}>
                          Log session
                        </button>
                      )}
                    </div>
                  )}
                  {role !== 'staff' && !begun && (
                    <button className="btn-ghost mt-2 px-0 text-xs text-ink-500" onClick={() => cancel(s)}>
                      Cancel
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Session history">
        {past.length === 0 ? (
          <p className="muted">No past sessions yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {past.map((s) => (
              <li key={s.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.title}</span>
                  <StatusBadge status={s.status} />
                  <span className="text-xs text-ink-500">{fmtDateTime(s.scheduledStart ?? s.completedAt)}</span>
                </div>
                {s.summary && <p className="mt-1 text-sm text-ink-700">{s.summary}</p>}
                {s.mentorPrivateNotes && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">Private note: {s.mentorPrivateNotes}</p>}
                {s.cancelReason && <p className="mt-1 text-xs text-ink-500">Reason: {s.cancelReason}</p>}
                {s.paid && s.fee > 0 && (
                  <p className="mt-1 text-xs text-ink-500">
                    {role === 'student' && s.paymentId ? (
                      <Link href={`/payments/${s.paymentId}`} className="font-medium text-brand-700 hover:underline">
                        Payment {inr(s.fee)}
                      </Link>
                    ) : (
                      `Paid ${inr(s.fee)}`
                    )}
                    {s.status === 'cancelled' && ' · see the receipt for the refund'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Checkout
        session={paying}
        open={!!paying}
        onClose={() => {
          setPaying(null);
          reload();
        }}
        onPaid={() => reload()}
      />

      <Modal open={proposing} onClose={() => setProposing(false)} title="Propose session times" footer={<><button className="btn-secondary" onClick={() => setProposing(false)}>Cancel</button><button className="btn-primary" onClick={propose} disabled={busy || !slots.some((s) => s.date)}>{busy && <Spinner />} Send proposal</button></>}>
        <div className="space-y-4">
          <Field label="Title">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div>
            <span className="label">Time options (up to 5)</span>
            <div className="space-y-2">
              {slots.map((s, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <input type="date" className="input w-40" value={s.date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
                  <input type="time" className="input w-28" value={s.time} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
                  <select className="input w-28" value={s.duration} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, duration: Number(e.target.value) } : x)))}>
                    {[30, 45, 60, 90].map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {slots.length < 5 && (
              <button className="btn-ghost mt-2 px-0 text-sm" onClick={() => setSlots([...slots, { date: '', time: '19:00', duration: 45 }])}>
                + Add another option
              </button>
            )}
          </div>
          <Field label="Agenda (optional)">
            <textarea className="input" value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="What would you like to cover?" />
          </Field>
        </div>
      </Modal>

      <Modal open={!!logging} onClose={() => setLogging(null)} title="Log session" footer={<><button className="btn-secondary" onClick={() => log('no_show')}>Didn&apos;t happen</button><button className="btn-primary" onClick={() => log('completed')}>Mark completed</button></>}>
        <Field label="Shared summary" hint="Visible to both of you">
          <textarea className="input" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What you covered and agreed next steps" />
        </Field>
        {role === 'mentor' && (
          <div className="mt-4">
            <Field label="Private notes" hint="Only you can see these">
              <textarea className="input" value={privateNotes} onChange={(e) => setPrivateNotes(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ----------------------------------------------------------------- goals */
export function GoalsTab({ id, role, active, careerGoals }: { id: string; role: Role; active: boolean; careerGoals: CareerGoal[] }) {
  const toast = useToast();
  const { data, reload } = useApi<{ goals: any[]; actionItems: any[] }>(`/mentorships/${id}/goals`);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [careerGoalId, setCareerGoalId] = useState('');
  const [action, setAction] = useState<{ title: string; assignee: string; dueDate: string; goalId: string }>({ title: '', assignee: 'student', dueDate: '', goalId: '' });
  const canEdit = active && role !== 'staff';

  async function addGoal() {
    try {
      await post(`/mentorships/${id}/goals`, { title: goalTitle, targetDate: goalDate || undefined, careerGoalId: careerGoalId || undefined });
      setGoalTitle('');
      setGoalDate('');
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }
  async function addAction() {
    try {
      await post(`/mentorships/${id}/actions`, { title: action.title, assignee: action.assignee, dueDate: action.dueDate || undefined, goalId: action.goalId || undefined });
      setAction({ ...action, title: '', dueDate: '' });
      reload();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }
  const setGoalStatus = async (gid: string, status: string) => (await patch(`/mentorships/${id}/goals/${gid}`, { status }), reload());
  const toggleAction = async (a: any) => (await patch(`/mentorships/${id}/actions/${a.id}`, { status: a.status === 'done' ? 'open' : 'done' }), reload());

  const goals = data?.goals ?? [];
  const actions = data?.actionItems ?? [];
  const overdue = (a: any) => a.status === 'open' && a.dueDate && new Date(a.dueDate) < new Date();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Shared goals">
        {goals.length === 0 && <p className="muted mb-4">Agree on 1–3 goals for this mentorship.</p>}
        <ul className="space-y-3">
          {goals.map((g) => (
            <li key={g.id} className="rounded-lg border border-ink-100 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className={cx('font-medium', g.status === 'achieved' && 'text-brand-700')}>{g.title}</div>
                  {g.targetDate && <div className="text-xs text-ink-500">Target {fmtDate(g.targetDate)}</div>}
                </div>
                {canEdit ? (
                  <select className="input w-auto py-1 text-xs" value={g.status} onChange={(e) => setGoalStatus(g.id, e.target.value)}>
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="achieved">Achieved</option>
                    <option value="dropped">Dropped</option>
                  </select>
                ) : (
                  <StatusBadge status={g.status} />
                )}
              </div>
            </li>
          ))}
        </ul>
        {canEdit && (
          <div className="mt-4 space-y-2 border-t border-ink-100 pt-4">
            <input className="input" placeholder="New goal, e.g. Interview-ready by March" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <input type="date" className="input w-40" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
              {careerGoals.length > 0 && (
                <select className="input w-auto flex-1" value={careerGoalId} onChange={(e) => setCareerGoalId(e.target.value)}>
                  <option value="">Link to career goal (optional)</option>
                  {careerGoals.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}
              <button className="btn-primary" disabled={goalTitle.trim().length < 3} onClick={addGoal}>
                Add goal
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Action items">
        <ul className="space-y-2">
          {actions.map((a) => (
            <li key={a.id} className="flex items-start gap-3">
              <input type="checkbox" className="mt-1 rounded text-brand-600" checked={a.status === 'done'} disabled={!canEdit} onChange={() => toggleAction(a)} aria-label={`Mark ${a.title} done`} />
              <div className="flex-1">
                <div className={cx('text-sm', a.status === 'done' && 'text-ink-400 line-through')}>{a.title}</div>
                <div className="text-xs text-ink-500">
                  {a.assignee === 'mentor' ? 'Mentor' : 'Student'}
                  {a.dueDate && <span className={cx(overdue(a) && 'font-medium text-red-700')}> · due {fmtDate(a.dueDate)}</span>}
                </div>
              </div>
            </li>
          ))}
          {actions.length === 0 && <p className="muted">No action items yet.</p>}
        </ul>
        {canEdit && (
          <div className="mt-4 space-y-2 border-t border-ink-100 pt-4">
            <input className="input" placeholder="Action, e.g. Rewrite resume summary" value={action.title} onChange={(e) => setAction({ ...action, title: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              <select className="input w-auto" value={action.assignee} onChange={(e) => setAction({ ...action, assignee: e.target.value })}>
                <option value="student">For student</option>
                <option value="mentor">For mentor</option>
              </select>
              <input type="date" className="input w-40" value={action.dueDate} onChange={(e) => setAction({ ...action, dueDate: e.target.value })} />
              {goals.length > 0 && (
                <select className="input w-auto" value={action.goalId} onChange={(e) => setAction({ ...action, goalId: e.target.value })}>
                  <option value="">No goal</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              )}
              <button className="btn-primary" disabled={action.title.trim().length < 2} onClick={addAction}>
                Add
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------- messages */
type Msg = { id: string; senderId: string; senderRole: string; body: string; masked: boolean; createdAt: string; readAt: string | null };
export function MessagesTab({ id, role, active, otherName }: { id: string; role: Role; active: boolean; otherName: string }) {
  const { me } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState('');
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    get<{ messages: Msg[] }>(`/messages?mentorshipId=${id}`).then((d) => {
      if (alive) {
        setMessages(d.messages);
        setLoading(false);
      }
    });
    if (role !== 'staff') post('/messages/read', { mentorshipId: id }).catch(() => undefined);
    const s = getSocket();
    const join = () => s.emit('join', id);
    join();
    s.on('connect', join);
    const onMsg = (m: Msg & { mentorshipId: string }) => {
      if (m.mentorshipId !== id) return;
      setMessages((xs) => (xs.some((x) => x.id === m.id) ? xs : [...xs, m]));
      if (m.senderId !== me?.user.id && role !== 'staff') post('/messages/read', { mentorshipId: id }).catch(() => undefined);
    };
    let t: ReturnType<typeof setTimeout>;
    const onTyping = (p: { mentorshipId: string }) => {
      if (p.mentorshipId !== id) return;
      setTyping(true);
      clearTimeout(t);
      t = setTimeout(() => setTyping(false), 2500);
    };
    s.on('message', onMsg);
    s.on('typing', onTyping);
    // Polling fallback keeps messaging working if websockets are blocked by a network.
    const poll = setInterval(() => {
      if (!s.connected) get<{ messages: Msg[] }>(`/messages?mentorshipId=${id}`).then((d) => alive && setMessages(d.messages));
    }, 10000);
    return () => {
      alive = false;
      s.emit('leave', id);
      s.off('connect', join);
      s.off('message', onMsg);
      s.off('typing', onTyping);
      clearInterval(poll);
    };
  }, [id, me?.user.id, role]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const text = body;
    setBody('');
    try {
      const r = await post<{ message: Msg; notice?: string }>('/messages', { mentorshipId: id, body: text });
      setMessages((xs) => (xs.some((x) => x.id === r.message.id) ? xs : [...xs, r.message]));
      if (r.notice) toast(r.notice);
    } catch (err: any) {
      setBody(text);
      toast(err.message, 'err');
    }
  }

  return (
    <div className="card flex h-[65vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center py-8 text-ink-400">
            <Spinner />
          </div>
        )}
        {!loading && messages.length === 0 && <p className="py-8 text-center text-sm text-ink-500">Start the conversation with {otherName}.</p>}
        {messages.map((m) => {
          const mine = m.senderId === me?.user.id;
          return (
            <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cx('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm', mine ? 'rounded-br-sm bg-brand-600 text-white' : 'rounded-bl-sm bg-ink-100 text-ink-900')}>
                {role === 'staff' && <div className="mb-0.5 text-[10px] uppercase opacity-70">{m.senderRole}</div>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div className={cx('mt-0.5 text-[10px]', mine ? 'text-brand-100' : 'text-ink-500')}>
                  {relTime(m.createdAt)}
                  {m.masked && ' · contact details hidden'}
                </div>
              </div>
            </div>
          );
        })}
        {typing && <p className="text-xs text-ink-400">{otherName.split(' ')[0]} is typing…</p>}
        <div ref={endRef} />
      </div>
      {active && role !== 'staff' ? (
        <form onSubmit={send} className="flex gap-2 border-t border-ink-100 p-3">
          <textarea
            className="input min-h-[42px] flex-1 resize-none"
            rows={1}
            value={body}
            maxLength={4000}
            placeholder="Write a message…"
            onChange={(e) => {
              setBody(e.target.value);
              getSocket().emit('typing', id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(e as any);
              }
            }}
          />
          <button className="btn-primary" disabled={!body.trim()}>
            Send
          </button>
        </form>
      ) : (
        <p className="border-t border-ink-100 p-3 text-center text-xs text-ink-500">{role === 'staff' ? 'Read-only' : 'This mentorship is closed.'}</p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- feedback */
export function FeedbackTab({ id, role, sessionParam }: { id: string; role: Role; sessionParam: string | null }) {
  const toast = useToast();
  const { me } = useAuth();
  const fb = useApi<{ feedback: any[] }>(`/mentorships/${id}/feedback`);
  const sessions = useApi<{ sessions: SessionT[] }>(`/mentorships/${id}/sessions`);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sessionId, setSessionId] = useState(sessionParam ?? '');
  const [busy, setBusy] = useState(false);

  const mine = (fb.data?.feedback ?? []).filter((f) => f.from === me?.user.id);
  const received = (fb.data?.feedback ?? []).filter((f) => f.from !== me?.user.id);
  const completed = (sessions.data?.sessions ?? []).filter((s) => s.status === 'completed' && !mine.some((f) => f.sessionId === s.id));

  async function submit() {
    setBusy(true);
    try {
      await post(`/mentorships/${id}/feedback`, { rating, comment: comment || undefined, sessionId: sessionId || undefined, kind: sessionId ? 'session' : 'periodic' });
      toast('Thanks for the feedback');
      setRating(0);
      setComment('');
      setSessionId('');
      fb.reload();
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  const Stars = ({ value, onChange }: { value: number; onChange?: (v: number) => void }) => (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} onClick={() => onChange?.(n)} className={cx('text-2xl leading-none', n <= value ? 'text-amber-400' : 'text-ink-200')} aria-label={`${n} star${n > 1 ? 's' : ''}`}>
          ★
        </button>
      ))}
    </div>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {role !== 'staff' && (
        <Card title="Give feedback">
          <div className="space-y-4">
            <Field label="About">
              <select className="input" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                <option value="">The mentorship overall</option>
                {completed.map((s) => (
                  <option key={s.id} value={s.id}>
                    Session: {s.title} ({fmtDate(s.scheduledStart)})
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <span className="label">Rating</span>
              <Stars value={rating} onChange={setRating} />
            </div>
            <Field label="Comment (optional)" hint={role === 'student' ? 'Shared with your mentor and the programme team.' : 'Shared with your mentee and the programme team.'}>
              <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} />
            </Field>
            <button className="btn-primary" disabled={!rating || busy} onClick={submit}>
              {busy && <Spinner />} Submit feedback
            </button>
          </div>
        </Card>
      )}
      <Card title={role === 'staff' ? 'All feedback' : 'Feedback received'}>
        {(role === 'staff' ? fb.data?.feedback ?? [] : received).length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <ul className="space-y-3">
            {(role === 'staff' ? fb.data!.feedback : received).map((f) => (
              <li key={f.id} className="rounded-lg border border-ink-100 p-3">
                <div className="flex items-center justify-between">
                  <Stars value={f.rating} />
                  <span className="text-xs text-ink-500">
                    {f.fromRole} · {f.kind} · {fmtDate(f.createdAt)}
                  </span>
                </div>
                {f.comment && <p className="mt-1 text-sm text-ink-700">{f.comment}</p>}
              </li>
            ))}
          </ul>
        )}
        {mine.length > 0 && role !== 'staff' && <p className="mt-4 text-xs text-ink-500">You&apos;ve given {mine.length} piece{mine.length === 1 ? '' : 's'} of feedback in this mentorship.</p>}
      </Card>
    </div>
  );
}
