'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, CreditCard, Lock, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Spinner, cx } from '@/components/ui';
import { ApiError, get, post } from '@/lib/api';
import { detectNetwork, digits, inr, luhn, NETWORK_LABEL, parseExpiry, type SavedMethod } from '@/lib/payments';
import { CardNumberField, CvvField, ExpiryField } from './CardFields';
import type { SessionT } from '@/lib/types';

type CheckoutData = {
  gateway: 'test' | 'razorpay';
  paymentId: string;
  orderId: string;
  amount: number;
  currency: 'INR';
  keyId: string | null;
  customerId: string | null;
  name: string;
  description: string;
  prefill: { name: string; email: string };
  holdExpiresAt: string | null;
};

type Tab = 'saved' | 'card' | 'upi';


function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  const ms = Math.max(0, new Date(until).getTime() - now);
  return `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
}

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: any) => void) => void };
  }
}
function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.'));
    document.body.appendChild(s);
  });
}

/**
 * Pay for a session that is awaiting payment. Opens straight into Razorpay Checkout when Razorpay is
 * configured; with the built-in test gateway it shows its own form (saved card, new card or UPI).
 */
export function Checkout({ session, open, onClose, onPaid }: { session: SessionT | null; open: boolean; onClose: () => void; onPaid: (s: SessionT) => void }) {
  const [co, setCo] = useState<CheckoutData | null>(null);
  const [methods, setMethods] = useState<SavedMethod[]>([]);
  const [tab, setTab] = useState<Tab>('card');
  const [savedId, setSavedId] = useState<string>('');
  const [card, setCard] = useState({ number: '', exp: '', cvv: '', name: '', save: true });
  const [vpa, setVpa] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ receiptNo: string; paymentId: string } | null>(null);
  const started = useRef<string | null>(null);
  const left = useCountdown(co?.holdExpiresAt ?? session?.paymentDueAt ?? null);

  async function begin() {
    if (!session) return null;
    const r = await post<{ checkout: CheckoutData }>('/payments/checkout', { sessionId: session.id });
    setCo(r.checkout);
    return r.checkout;
  }

  // Start an order when the dialog opens (once per session).
  useEffect(() => {
    if (!open || !session || started.current === session.id) return;
    started.current = session.id;
    setError(null);
    setDone(null);
    setCo(null);
    (async () => {
      try {
        const c = await begin();
        if (!c) return;
        if (c.gateway === 'razorpay') return openRazorpay(c);
        const r = await get<{ methods: SavedMethod[] }>('/payments/methods');
        setMethods(r.methods);
        if (r.methods.length) {
          setTab('saved');
          setSavedId((r.methods.find((m) => m.isDefault) ?? r.methods[0]).id);
        }
      } catch (e: any) {
        setError(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id]);
  useEffect(() => {
    if (!open) started.current = null;
  }, [open]);

  async function openRazorpay(c: CheckoutData) {
    try {
      await loadRazorpay();
      const rzp = new window.Razorpay!({
        key: c.keyId,
        order_id: c.orderId,
        amount: c.amount,
        currency: c.currency,
        name: c.name,
        description: c.description,
        customer_id: c.customerId ?? undefined,
        save: 1, // offer "save this card" (RBI-compliant tokenisation by Razorpay)
        prefill: c.prefill,
        theme: { color: '#cf4a06' },
        handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          setBusy(true);
          try {
            const r = await post<{ ok: boolean; payment: { id: string; receiptNo: string }; session: SessionT }>('/payments/razorpay/verify', { paymentId: c.paymentId, ...resp });
            setDone({ receiptNo: r.payment.receiptNo, paymentId: r.payment.id });
            onPaid(r.session);
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => !done && setError('Payment was not completed. Your slot stays held until the timer runs out.') },
      });
      rzp.on('payment.failed', (r: any) => setError(r?.error?.description ?? 'The payment failed. Try another method.'));
      rzp.open();
    } catch (e: any) {
      setError(e.message);
    }
  }

  const network = detectNetwork(card.number);
  const cardErrors = useMemo(() => {
    const e: Record<string, string> = {};
    const d = digits(card.number);
    if (d.length < 12 || !luhn(d)) e.number = 'Enter a valid card number';
    if (!parseExpiry(card.exp)) e.exp = 'MM/YY in the future';
    if (!/^\d{3,4}$/.test(card.cvv)) e.cvv = '3 or 4 digits';
    return e;
  }, [card]);

  async function payTest() {
    setBusy(true);
    setError(null);
    try {
      // A declined attempt closes its order; start a fresh one for the retry.
      const c = co ?? (await begin());
      if (!c) return;
      let method: Record<string, unknown>;
      if (tab === 'saved') method = { type: 'saved', methodId: savedId };
      else if (tab === 'upi') method = { type: 'upi', vpa: vpa.trim() };
      else {
        const exp = parseExpiry(card.exp)!;
        const d = digits(card.number);
        method = { type: 'card', network, cardType: 'credit', last4: d.slice(-4), expMonth: exp.month, expYear: exp.year, holder: card.name.trim() || undefined, save: card.save };
      }
      const r = await post<{ ok: boolean; payment: { id: string; receiptNo: string; failureReason?: string }; session: SessionT }>('/payments/test/complete', { paymentId: c.paymentId, method });
      if (!r.ok) {
        setCo(null);
        setError(r.payment.failureReason ?? 'The payment was declined. Try another card.');
        return;
      }
      setDone({ receiptNo: r.payment.receiptNo, paymentId: r.payment.id });
      onPaid(r.session);
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'payment_closed') setCo(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const amount = co?.amount ?? session?.fee ?? 0;
  const formValid = tab === 'saved' ? !!savedId : tab === 'upi' ? /^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(vpa.trim()) : Object.keys(cardErrors).length === 0;
  // After a decline the order is closed (co is null); pressing Pay again starts a new one.
  const canPay = !busy && formValid && (!!co || !!error);
  const isTest = co?.gateway !== 'razorpay';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={done ? 'Payment complete' : `Pay ${inr(amount)}`}
      footer={
        done ? (
          <>
            <Link href={`/payments/${done.paymentId}`} className="btn-secondary">
              View receipt
            </Link>
            <button className="btn-primary" onClick={onClose}>
              Done
            </button>
          </>
        ) : isTest ? (
          <>
            <button className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn-primary min-w-[140px]" onClick={payTest} disabled={!canPay}>
              {busy ? <Spinner /> : <Lock size={14} />} Pay {inr(amount)}
            </button>
          </>
        ) : (
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="py-4 text-center">
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.05 }} className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok-50 text-ok-600">
              <CheckCircle2 size={30} />
            </motion.span>
            <p className="mt-3 text-[15px] font-semibold text-ink-900">Your session is confirmed</p>
            <p className="mt-1 text-[13px] text-ink-500">
              {inr(amount)} paid · Receipt <span className="font-mono text-ink-700">{done.receiptNo}</span>
            </p>
            <p className="mt-1 text-[13px] text-ink-500">The video link and calendar file are on the session.</p>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="flex items-start justify-between gap-3 rounded-xl bg-ink-50 px-3.5 py-3 ring-1 ring-inset ring-[color:var(--line)]">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium text-ink-900">{co?.description ?? session?.title}</p>
                <p className="text-[12px] text-ink-500">Slot held for you{left ? ` · ${left} left` : ''}</p>
              </div>
              <span className="shrink-0 text-[18px] font-semibold tabular-nums text-ink-900">{inr(amount)}</span>
            </div>

            {!co && !error && (
              <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-ink-500">
                <Spinner /> {isTest ? 'Preparing secure checkout…' : 'Opening Razorpay…'}
              </div>
            )}

            {co && !isTest && !error && (
              <div className="py-8 text-center text-[13px] text-ink-500">
                <ShieldCheck size={28} className="mx-auto text-brand-600" />
                <p className="mt-2">Complete the payment in the Razorpay window. Your card details go straight to Razorpay.</p>
                <button className="btn-secondary mt-4" onClick={() => openRazorpay(co)} disabled={busy}>
                  {busy && <Spinner />} Reopen Razorpay
                </button>
              </div>
            )}

            {isTest && (co || error) && (
              <div className="mt-4">
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink-50 p-1 ring-1 ring-inset ring-[color:var(--line)]" role="tablist">
                  {(
                    [
                      ['saved', 'Saved cards', Wallet],
                      ['card', 'New card', CreditCard],
                      ['upi', 'UPI', Smartphone],
                    ] as const
                  ).map(([k, label, Icon]) => (
                    <button
                      key={k}
                      role="tab"
                      aria-selected={tab === k}
                      disabled={k === 'saved' && methods.length === 0}
                      onClick={() => setTab(k)}
                      className={cx('flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-medium transition', tab === k ? 'bg-surface text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800 disabled:opacity-40')}
                    >
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>

                {tab === 'saved' && (
                  <ul className="mt-3 space-y-2" role="radiogroup" aria-label="Saved cards">
                    {methods.map((m) => (
                      <li key={m.id}>
                        <button
                          role="radio"
                          aria-checked={savedId === m.id}
                          onClick={() => setSavedId(m.id)}
                          className={cx('flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition', savedId === m.id ? 'border-brand-500 bg-brand-50 shadow-[0_0_0_3px_rgba(31,163,136,.12)]' : 'border-[color:var(--line-strong)] hover:bg-ink-50')}
                        >
                          <span className="grid h-8 w-14 shrink-0 place-items-center rounded-md bg-ink-900 text-[9.5px] font-bold text-ink-50">{NETWORK_LABEL[m.network]}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium text-ink-900">{m.nickname ?? `${NETWORK_LABEL[m.network]} ${m.cardType}`}</span>
                            <span className="block text-[12px] text-ink-500">
                              •••• {m.last4} · expires {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}
                            </span>
                          </span>
                          {m.isDefault && <span className="text-[11px] font-medium text-brand-700">Default</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {tab === 'card' && (
                  <div className="mt-3 space-y-3">
                    <CardNumberField value={card.number} onChange={(number) => setCard({ ...card, number })} />
                    <div className="grid grid-cols-2 gap-3">
                      <ExpiryField value={card.exp} onChange={(exp) => setCard({ ...card, exp })} />
                      <CvvField value={card.cvv} onChange={(cvv) => setCard({ ...card, cvv })} />
                    </div>
                    <label className="block">
                      <span className="label">Name on card</span>
                      <input className="input" autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} />
                    </label>
                    <label className="flex items-center gap-2 text-[13px] text-ink-700">
                      <input type="checkbox" checked={card.save} onChange={(e) => setCard({ ...card, save: e.target.checked })} className="h-4 w-4 rounded border-ink-300 accent-brand-600" />
                      Save this card for next time
                    </label>
                    <p className="rounded-lg bg-ink-50 px-3 py-2 text-[12px] text-ink-500 ring-1 ring-inset ring-[color:var(--line)]">
                      Test cards: <span className="font-mono text-ink-700">4242 4242 4242 4242</span> pays, <span className="font-mono text-ink-700">4000 0000 0000 0002</span> is declined. Any future expiry and any CVV.
                    </p>
                  </div>
                )}

                {tab === 'upi' && (
                  <div className="mt-3 space-y-3">
                    <label className="block">
                      <span className="label">UPI id</span>
                      <input className="input" placeholder="yourname@okhdfc" value={vpa} onChange={(e) => setVpa(e.target.value)} />
                    </label>
                    <p className="rounded-lg bg-ink-50 px-3 py-2 text-[12px] text-ink-500 ring-1 ring-inset ring-[color:var(--line)]">
                      Test ids: <span className="font-mono text-ink-700">success@razorpay</span> pays, <span className="font-mono text-ink-700">failure@razorpay</span> is declined.
                    </p>
                  </div>
                )}
              </div>
            )}

            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 ring-1 ring-inset ring-red-200">{error}</p>}

            <p className="mt-4 flex items-center gap-1.5 text-[12px] text-ink-500">
              <Lock size={12} /> {isTest ? 'Test gateway — no real money moves. Card numbers never leave your browser.' : 'Secured by Razorpay. Card numbers never reach our servers.'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
