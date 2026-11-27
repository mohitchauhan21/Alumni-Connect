'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { LogoMark } from '../Logo';
import { CountUp } from '../motion';
import { initials } from '@/lib/format';
import type { Capacity } from '@/lib/types';

/**
 * The app's UI kit. Quiet by design: flat fills, soft surfaces, one accent.
 * The bigger interactive pieces (glass folder, glass sidebar, gooey nav) live next to this
 * file in components/ui/.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={cx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-label="Loading" />;
}

/** Branded loader: the logo mark draws itself. */
export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24" role="status" aria-label="Loading">
      <LogoMark size={40} variant="glyph" animated className="text-ink-900" />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow, icon: Icon }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; eyebrow?: string; icon?: LucideIcon }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }} className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {(eyebrow || Icon) && (
          <div className="mb-2 flex items-center gap-1.5 text-ink-500">
            {Icon && <Icon size={14} strokeWidth={2} />}
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          </div>
        )}
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </motion.div>
  );
}

export function Card({ children, className = '', title, actions }: { children: React.ReactNode; className?: string; title?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }} className={cx('card', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
          <h2 className="h2">{title}</h2>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </motion.section>
  );
}

const TONES = {
  gray: 'bg-ink-900/[0.06] text-ink-700',
  green: 'bg-ok-50 text-ok-800',
  amber: 'bg-amber-50 text-amber-800',
  red: 'bg-red-50 text-red-800',
  blue: 'bg-brand-50 text-brand-800',
  violet: 'bg-violet-50 text-violet-800',
};
export function Badge({ children, tone = 'gray', className = '' }: { children: React.ReactNode; tone?: keyof typeof TONES; className?: string }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[tone], className)}>{children}</span>;
}

export function statusTone(s: string): keyof typeof TONES {
  return (
    ({
      pending: 'amber',
      accepted: 'green',
      active: 'green',
      verified: 'green',
      approved: 'green',
      completed: 'blue',
      scheduled: 'blue',
      proposed: 'violet',
      awaiting_payment: 'amber',
      paid: 'green',
      refunded: 'violet',
      failed: 'red',
      declined: 'gray',
      withdrawn: 'gray',
      expired: 'gray',
      ended: 'gray',
      cancelled: 'gray',
      rejected: 'red',
      no_show: 'red',
      needs_info: 'amber',
      unverified: 'gray',
      healthy: 'green',
      at_risk: 'amber',
      lapsed: 'red',
    } as Record<string, keyof typeof TONES>)[s] ?? 'gray'
  );
}
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={statusTone(status)}>{status.replace(/_/g, ' ')}</Badge>;

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'warn' | 'bad' | 'good' }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        {tone && <span className={cx('h-1.5 w-1.5 rounded-full', tone === 'warn' ? 'bg-amber-500' : tone === 'bad' ? 'bg-red-500' : 'bg-ok-400')} />}
        <span className="text-[13px] font-medium text-ink-500">{label}</span>
      </div>
      <div className={cx('mt-2 text-[32px] font-semibold leading-none tracking-[-0.035em] tabular-nums', tone === 'warn' && 'text-amber-700', tone === 'bad' && 'text-red-700', tone === 'good' && 'text-ok-700')}>
        {typeof value === 'number' || typeof value === 'string' ? <CountUp value={value} /> : value}
      </div>
      {hint && <div className="mt-2 text-xs text-ink-500">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="rounded-[22px] bg-ink-900/[0.03] px-6 py-14 text-center">
      <div className="mx-auto mb-4 grid h-11 w-11 place-items-center rounded-full bg-surface text-ink-400 shadow-card" aria-hidden>
        <LogoMark size={20} variant="glyph" />
      </div>
      <p className="text-[15px] font-semibold text-ink-900">{title}</p>
      {body && <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed text-ink-500">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function ErrorBox({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <div className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{message}</div>;
}

/** Monochrome, like Apple's contact avatars. */
export function Avatar({ name, size = 'md', src }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; src?: string | null }) {
  const s = size === 'sm' ? 'h-8 w-8 text-[11px]' : size === 'lg' ? 'h-14 w-14 text-lg' : size === 'xl' ? 'h-28 w-28 text-[34px]' : 'h-10 w-10 text-sm';
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" referrerPolicy="no-referrer" className={cx('shrink-0 rounded-full object-cover', s)} />;
  return <div className={cx('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#a8a8ad] to-[#86868b] font-semibold tracking-normal text-white', s)}>{initials(name)}</div>;
}

/** Clear capacity indication — a core design requirement. */
export function CapacityMeter({ capacity, compact }: { capacity?: Capacity; compact?: boolean }) {
  if (!capacity) return null;
  const { maxMentees, activeCount, openSlots, paused } = capacity;
  const label = paused ? 'Paused' : openSlots > 0 ? `${openSlots} of ${maxMentees} slot${maxMentees === 1 ? '' : 's'} open` : 'Full';
  return (
    <div className={cx('flex items-center gap-2', compact ? 'text-xs' : 'text-sm')}>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: Math.max(maxMentees, 1) }).map((_, i) => (
          <motion.span
            key={i}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ delay: 0.04 * i, duration: 0.35, ease: EASE }}
            className={cx('h-3 w-3.5 origin-bottom rounded-full', paused ? 'bg-ink-200' : i < activeCount ? 'bg-ink-300' : 'bg-ok-400')}
          />
        ))}
      </div>
      <span className={cx('font-medium', paused ? 'text-ink-500' : openSlots > 0 ? 'text-ok-700' : 'text-ink-500')}>{label}</span>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 backdrop-blur-md dark:bg-black/60 sm:items-center sm:p-4" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            className="max-h-[92vh] w-full overflow-auto rounded-t-[28px] bg-surface shadow-depth sm:max-w-lg sm:rounded-[28px]"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <div className="flex items-center justify-between px-6 pb-1 pt-5">
              <h3 className="text-[17px] font-semibold tracking-[-0.015em]">{title}</h3>
              <button className="btn-ghost -mr-2 p-2" onClick={onClose} aria-label="Close">
                <X size={17} />
              </button>
            </div>
            <div className="px-6 py-4">{children}</div>
            {footer && <div className="flex justify-end gap-2 px-6 pb-6 pt-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Apple-style segmented control. */
export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: React.ReactNode }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex gap-0.5 rounded-full bg-ink-900/[0.06] p-1" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)} className={cx('relative whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors', active === t.id ? 'text-ink-900' : 'text-ink-500 hover:text-ink-800')}>
            {active === t.id && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgba(0,0,0,.12)]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, error }: { label: string; children: React.ReactNode; hint?: string; error?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-ink-500">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs text-red-700">{error}</span>}
    </label>
  );
}

export function ChipToggle({ options, value, onChange, max }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            type="button"
            key={o.value}
            aria-pressed={on}
            className={cx('chip', on && 'chip-active')}
            onClick={() => (on ? onChange(value.filter((x) => x !== o.value)) : (!max || value.length < max) && onChange([...value, o.value]))}
          >
            {on && <Check size={12} strokeWidth={2.6} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Bar({ value, max = 100, tone = 'brand' }: { value: number; max?: number; tone?: 'brand' | 'amber' | 'red' | 'ink' }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const c = { brand: 'bg-brand-600', amber: 'bg-amber-500', red: 'bg-red-500', ink: 'bg-ink-500' }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-900/[0.08]">
      <motion.div className={cx('h-full rounded-full', c)} initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE }} />
    </div>
  );
}

export const LinkButton = ({ href, children, variant = 'secondary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost' }) => (
  <Link href={href} className={variant === 'primary' ? 'btn-primary' : variant === 'ghost' ? 'btn-ghost' : 'btn-secondary'}>
    {children}
  </Link>
);

/* ---------------------------------------------------------------- toasts */
type Toast = { id: number; text: string; tone: 'ok' | 'err' };
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'err') => void>(() => {});
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              role="status"
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.3, ease: EASE }}
              className={cx('pointer-events-auto max-w-md rounded-full px-5 py-2.5 text-[13.5px] font-medium shadow-depth backdrop-blur-xl', t.tone === 'ok' ? 'bg-ink-900/90 text-ink-50' : 'bg-red-600/95 text-white')}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
