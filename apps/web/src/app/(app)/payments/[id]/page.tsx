'use client';
import { ArrowLeft, Printer, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Logo } from '@/components/Logo';
import { EmptyState, PageLoader, StatusBadge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { inr, type PaymentRow } from '@/lib/payments';

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const { me } = useAuth();
  const { data, loading, error } = useApi<{ payment: PaymentRow }>(`/payments/${id}`);
  if (loading && !data) return <PageLoader />;
  if (error || !data) return <EmptyState title="Receipt not found" body={error ?? undefined} action={<Link href="/payments" className="btn-secondary">Back to payments</Link>} />;
  const p = data.payment;
  const isMentor = me?.user.role === 'alumnus';

  const rows: [string, React.ReactNode][] = [
    ['Session', p.sessionTitle ?? 'Mentoring session'],
    ['Session time', p.sessionStart ? fmtDateTime(p.sessionStart) : '—'],
    ['Mentor', p.mentorName ?? '—'],
    ['Student', p.studentName ?? '—'],
  ];
  if (p.method) rows.push(['Paid with', p.method.label]);
  rows.push(['Paid on', p.paidAt ? fmtDateTime(p.paidAt) : '—']);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/payments" className="btn-ghost px-1 text-sm">
          <ArrowLeft size={15} /> {isMentor ? 'Earnings' : 'Payments'}
        </Link>
        <button className="btn-secondary" onClick={() => window.print()}>
          <Printer size={15} /> Print
        </button>
      </div>

      <article className="card overflow-hidden !p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--line)] px-6 py-5">
          <Logo compact />
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">Receipt</p>
            <p className="font-mono text-[14px] font-medium text-ink-900">{p.receiptNo}</p>
            <div className="mt-1">
              <StatusBadge status={p.status} />
            </div>
          </div>
        </header>

        <div className="px-6 py-5">
          <p className="text-[12px] text-ink-500">Amount</p>
          <p className="text-[32px] font-semibold tracking-tight tabular-nums text-ink-900">{inr(p.amount)}</p>
          {p.status === 'failed' && p.failureReason && <p className="mt-1 text-[13px] text-red-700">{p.failureReason}</p>}

          <dl className="mt-5 divide-y divide-[color:var(--line)] text-[13.5px]">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5">
                <dt className="text-ink-500">{k}</dt>
                <dd className="text-right font-medium text-ink-900">{v}</dd>
              </div>
            ))}
          </dl>

          {p.mentorShare !== undefined && (
            <div className="mt-5 rounded-xl bg-ink-50 px-4 py-3 text-[13.5px] ring-1 ring-inset ring-[color:var(--line)]">
              <div className="flex justify-between py-1">
                <span className="text-ink-500">Session fee</span>
                <span className="tabular-nums">{inr(p.amount)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-500">Platform fee</span>
                <span className="tabular-nums">−{inr(p.platformFee ?? 0)}</span>
              </div>
              <div className="flex justify-between border-t border-[color:var(--line)] pt-2 font-semibold text-ink-900">
                <span>Mentor’s share</span>
                <span className="tabular-nums">{inr(p.mentorShare)}</span>
              </div>
            </div>
          )}

          {p.refund && (
            <div className="mt-5 flex gap-3 rounded-xl bg-violet-50 px-4 py-3 text-[13.5px] text-violet-800 ring-1 ring-inset ring-violet-200">
              <RotateCcw size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">
                  {p.refund.status === 'processed' ? 'Refunded' : p.refund.status === 'pending' ? 'Refund on its way' : 'Refund failed — the alumni office will retry'} · {inr(p.refund.amount)}
                </p>
                <p>
                  {p.refund.reason}
                  {p.refund.at ? ` · ${fmtDate(p.refund.at)}` : ''}
                </p>
              </div>
            </div>
          )}
        </div>
        <footer className="border-t border-[color:var(--line)] px-6 py-4 text-[12px] text-ink-500">Mentor Bridge · Payments are processed by the payment gateway; card details are never stored by the platform.</footer>
      </article>
    </div>
  );
}
