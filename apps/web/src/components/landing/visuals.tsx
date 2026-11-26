'use client';
import { motion } from 'framer-motion';
import { BarChart3, CalendarClock, Check, Clock, Compass, Inbox, LayoutDashboard, Search, Sparkles, UserRound, Wallet } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { cx } from '@/components/ui';

/* Product mock-ups for the landing page. Illustrative only (labelled as such): the public page never
   calls a data endpoint. */

const EASE = [0.22, 1, 0.36, 1] as const;

/* ────────────────────────────────────────────────────────────── visuals (illustrative) */

const initialsOf = (n: string) => n.split(' ').map((p) => p[0]).join('');

export function ProductPreview() {
  const mentors: [string, string, number, string, number][] = [
    ['Priya N.', 'Senior Data Scientist · Fintech', 93, 'Shares 4 of your interests', 2],
    ['Arjun K.', 'Machine Learning Engineer · SaaS', 86, 'Close to your target role', 1],
    ['Meera R.', 'Product Manager · Consumer tech', 78, 'Offers interview prep', 3],
  ];
  const nav: [typeof LayoutDashboard, string, boolean][] = [
    [LayoutDashboard, 'Home', false],
    [Compass, 'Find a mentor', true],
    [CalendarClock, 'Mentorships', false],
    [UserRound, 'Career profile', false],
    [Wallet, 'Payments', false],
  ];
  return (
    <div className="overflow-hidden rounded-[20px] border border-[color:var(--line-strong)] bg-surface text-left shadow-[0_40px_120px_-40px_rgba(0,0,0,0.35)] dark:shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]" aria-label="Illustrative preview of the student app" role="img">
      <div className="flex items-center gap-2 border-b border-[color:var(--line)] bg-canvas/60 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        <span className="mx-auto hidden rounded-md bg-ink-900/[0.05] px-12 py-1 text-[11px] text-ink-400 sm:block">Find your mentor</span>
      </div>
      <div className="flex">
        <aside className="hidden w-52 shrink-0 border-r border-[color:var(--line)] p-3 md:block">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <LogoMark size={22} />
            <span className="text-[12.5px] font-semibold">Mentor Bridge</span>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[color:var(--line)] px-2.5 py-1.5 text-[11.5px] text-ink-400">
            <Search size={12} /> Search…
          </div>
          <div className="mt-4 space-y-0.5">
            {nav.map(([Icon, label, active]) => (
              <div key={label} className={cx('flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px]', active ? 'bg-ink-900/[0.06] font-medium text-ink-900' : 'text-ink-500')}>
                <Icon size={13} className={active ? 'text-brand-600' : ''} /> {label}
              </div>
            ))}
          </div>
        </aside>
        <div className="min-w-0 flex-1 p-5 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400">Discover</p>
          <p className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">Find your mentor</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-[color:var(--line-strong)] px-3 py-2 text-[12.5px] text-ink-400">
            <Search size={14} /> Search by name, role, company or industry
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mentors.map(([n, r, s, why, open], i) => (
              <div key={n} className={cx('rounded-2xl border border-[color:var(--line)] bg-surface p-4 shadow-card', i === 2 && 'hidden lg:block')}>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#a8a8ad] to-[#86868b] text-[12px] font-semibold text-white">{initialsOf(n)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold">{n}</div>
                    <div className="truncate text-[11.5px] text-ink-500">{r}</div>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-full border-[3px] border-brand-600 text-[12px] font-semibold tabular-nums">{s}</div>
                </div>
                <div className="mt-3 rounded-xl bg-ink-900/[0.03] p-2.5 text-[11.5px] text-ink-600">
                  <span className="flex items-center gap-1.5">
                    <Check size={12} className="text-ok-600" /> {why}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[11px]">
                  {[0, 1, 2, 3].map((k) => (
                    <span key={k} className={cx('h-2 w-3 rounded-full', k < 4 - open ? 'bg-ink-200' : 'bg-ok-400')} />
                  ))}
                  <span className="ml-1 font-medium text-ok-700">
                    {open} of 4 open
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function VisualCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('rounded-[28px] bg-gradient-to-b from-ink-900/[0.03] to-transparent p-4 sm:p-8', className)}>{children}</div>;
}

export function MatchVisual() {
  const rows: [string, number][] = [
    ['Shared expertise', 92],
    ['Role fit', 88],
    ['Industry', 100],
    ['Help offered', 75],
    ['Open capacity', 100],
  ];
  return (
    <VisualCard>
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-[#a8a8ad] to-[#86868b] text-[14px] font-semibold text-white">PN</span>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Priya N.</div>
            <div className="text-[12.5px] text-ink-500">Senior Data Scientist · Fintech</div>
          </div>
          <div className="text-right">
            <div className="text-[30px] font-semibold leading-none tracking-[-0.04em]">93</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400">match</div>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          {rows.map(([label, v], i) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-[12px] text-ink-500">
                <span>{label}</span>
                <span className="tabular-nums">{v}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-900/[0.08]">
                <motion.div className="h-full rounded-full bg-brand-600" initial={{ width: 0 }} whileInView={{ width: `${v}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.08 * i, ease: EASE }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-1.5 text-[13px] text-ink-600">
          <p className="flex gap-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-brand-600" /> Shares 4 of your interests: Machine Learning, Python…</p>
          <p className="flex gap-2"><Sparkles size={14} className="mt-0.5 shrink-0 text-brand-600" /> Works close to your target role, “Data Scientist”</p>
        </div>
      </div>
      <p className="mt-3 text-center text-[11.5px] text-ink-400">Illustrative example</p>
    </VisualCard>
  );
}

export function CapacityVisual() {
  const steps: [typeof Inbox, string, string][] = [
    [Inbox, 'Request sent', 'With the student’s goals attached'],
    [Clock, 'Seven days to reply', 'Accept, or decline in one click'],
    [Compass, 'Never left hanging', 'Expired or declined? Other open mentors are suggested'],
  ];
  return (
    <VisualCard>
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-medium text-ink-500">Your capacity</div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">2 of 4 slots open</div>
          </div>
          <span className="rounded-full bg-ok-50 px-3 py-1 text-[12px] font-medium text-ok-800">Accepting</span>
        </div>
        <div className="mt-4 flex gap-1.5">
          {[1, 1, 0, 0].map((u, i) => (
            <motion.span key={i} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: 0.08 * i, duration: 0.5, ease: EASE }} className={cx('h-2.5 flex-1 origin-left rounded-full', u ? 'bg-ink-300' : 'bg-ok-400')} />
          ))}
        </div>
      </div>
      <div className="card mt-4 p-6">
        <ol className="relative space-y-5 border-l border-[color:var(--line-strong)] pl-6">
          {steps.map(([Icon, t, d]) => (
            <li key={t} className="relative">
              <span className="absolute -left-[37px] grid h-6 w-6 place-items-center rounded-full border border-[color:var(--line-strong)] bg-surface text-ink-500">
                <Icon size={12} />
              </span>
              <div className="text-[14px] font-semibold">{t}</div>
              <div className="text-[13px] text-ink-500">{d}</div>
            </li>
          ))}
        </ol>
      </div>
    </VisualCard>
  );
}

export function ReportVisual() {
  const bars = [34, 48, 41, 57, 63, 71, 86];
  return (
    <VisualCard>
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink-500">
              <BarChart3 size={14} /> Programme report
            </div>
            <div className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">Sessions completed</div>
          </div>
          <span className="rounded-full bg-ink-900/[0.05] px-3 py-1 text-[12px] font-medium text-ink-600">This term</span>
        </div>
        <div className="mt-6 flex h-40 items-end gap-2">
          {bars.map((h, i) => (
            <motion.span key={i} initial={{ height: 0 }} whileInView={{ height: `${h}%` }} viewport={{ once: true }} transition={{ delay: 0.06 * i, duration: 0.7, ease: EASE }} className={cx('w-full rounded-t-lg', i === bars.length - 1 ? 'bg-brand-600' : 'bg-ink-900/[0.08]')} />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-[color:var(--line)] pt-5 text-[12px]">
          {['Participation', 'Mentor load', 'Health'].map((l) => (
            <div key={l}>
              <div className="text-ink-400">{l}</div>
              <div className="mt-1 h-1.5 rounded-full bg-ink-900/[0.08]">
                <div className="h-full w-2/3 rounded-full bg-ink-400" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-center text-[11.5px] text-ink-400">Illustrative example — reports contain no personal data</p>
    </VisualCard>
  );
}
