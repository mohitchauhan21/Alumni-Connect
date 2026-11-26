'use client';
import { ArrowLeft, Briefcase, CheckCircle2, GraduationCap, HeartHandshake, Settings2, ShieldCheck, UserPlus, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { AuthFrame } from '@/components/AuthFrame';
import { GOOGLE_ERRORS, GoogleButton } from '@/components/GoogleButton';
import { CodeInput } from '@/components/TwoFactorSetup';
import { ErrorBox, Field, Spinner, useToast } from '@/components/ui';
import { post } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { homeFor } from '@/lib/format';

type LoginResult = { user?: { role: string }; mfaRequired?: boolean; challenge?: string };

/**
 * One-tap demo sign-ins. They match the accounts loaded by the API's demo data (apps/api/src/seed),
 * which only exists in development, so the panel is hidden in production builds unless
 * NEXT_PUBLIC_DEMO_LOGINS=true (for a hosted demo that was seeded on purpose).
 */
const SHOW_DEMO = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO_LOGINS === 'true';
const DEMO_PASSWORD = 'Demo@1234';
const DEMO_ACCOUNTS: { label: string; email: string; icon: LucideIcon; tint: string }[] = [
  { label: 'Student', email: 'student@demo.edu', icon: GraduationCap, tint: 'bg-brand-50 text-brand-700' },
  { label: 'Mentor', email: 'mentor@demo.edu', icon: HeartHandshake, tint: 'bg-violet-50 text-violet-800' },
  { label: 'New alumna', email: 'newalumni@demo.edu', icon: UserPlus, tint: 'bg-amber-50 text-amber-700' },
  { label: 'Alumni office', email: 'aro@demo.edu', icon: ShieldCheck, tint: 'bg-sky-50 text-sky-800' },
  { label: 'Placement', email: 'placement@demo.edu', icon: Briefcase, tint: 'bg-ink-100 text-ink-700' },
  { label: 'Admin', email: 'admin@demo.edu', icon: Settings2, tint: 'bg-ink-100 text-ink-700' },
];

function DemoAccounts({ email, password, onPick }: { email: string; password: string; onPick: (email: string) => void }) {
  const active = password === DEMO_PASSWORD ? DEMO_ACCOUNTS.find((d) => d.email === email) : undefined;
  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-ink-400">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-ink-200" />
        Try a demo account
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-ink-200" />
      </div>
      <div className="mt-3 grid auto-rows-fr grid-cols-3 gap-2" role="group" aria-label="Demo accounts">
        {DEMO_ACCOUNTS.map(({ label, email: e, icon: Icon, tint }) => {
          const on = active?.email === e;
          return (
            <button
              key={e}
              type="button"
              onClick={() => onPick(e)}
              aria-pressed={on}
              aria-label={`Fill in the ${label} demo account`}
              title={e}
              className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-[12px] font-medium leading-tight transition ${
                on ? 'border-brand-500 bg-brand-50 text-brand-800 shadow-[0_0_0_3px_rgba(31,163,136,.12)]' : 'border-[color:var(--line-strong)] bg-surface text-ink-700 hover:-translate-y-px hover:border-ink-300 hover:bg-ink-50'
              }`}
            >
              <span className={`grid h-8 w-8 place-items-center rounded-lg ${tint}`}>
                <Icon size={16} />
              </span>
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-center text-[12px] text-ink-500" aria-live="polite">
        {active ? (
          <>
            Filled in <span className="font-medium text-ink-800">{active.email}</span>. Press Sign in.
          </>
        ) : (
          'Tap a role to fill in its email and password.'
        )}
      </p>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refresh } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const urlError = params.get('error');
  const [error, setError] = useState<string | null>(urlError ? (GOOGLE_ERRORS[urlError] ?? 'Sign-in failed. Please try again.') : null);
  const [busy, setBusy] = useState(false);
  // Second step: after a correct password, or straight from Google when two-factor is on.
  const [step, setStep] = useState<'password' | 'mfa'>(params.get('mfa') === '1' ? 'mfa' : 'password');
  const [challenge, setChallenge] = useState<string | undefined>();
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const next = params.get('next');
  const signInRef = useRef<HTMLButtonElement>(null);
  const pickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
    signInRef.current?.focus(); // so Enter signs in straight away
  };
  const notice =
    params.get('reset') === '1'
      ? 'Password changed. Sign in with your new password.'
      : params.get('deleted') === '1'
        ? 'Your account has been deleted. Thank you for being part of the network.'
        : null;

  const go = (role: string) => router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(role));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post<LoginResult>('/auth/login', { email, password });
      if (r.mfaRequired) {
        setChallenge(r.challenge);
        setStep('mfa');
        return;
      }
      await refresh();
      go(r.user!.role);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ user: { role: string }; recoveryCodesLeft: number }>('/auth/login/2fa', { code: code.replace(/\s/g, ''), challenge });
      await refresh();
      if (useRecovery || r.recoveryCodesLeft <= 3) toast(`${r.recoveryCodesLeft} recovery code${r.recoveryCodesLeft === 1 ? '' : 's'} left. You can make new ones in Settings.`);
      go(r.user.role);
    } catch (err: any) {
      setError(err.message);
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'mfa') {
    return (
      <form onSubmit={submitCode} className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-brand-50 px-3.5 py-3 text-[13px] text-brand-900 ring-1 ring-inset ring-brand-200">
          <ShieldCheck size={17} className="mt-0.5 shrink-0" />
          <p>{useRecovery ? 'Enter one of the recovery codes you saved when you set up two-factor sign-in. Each code works once.' : 'Open your authenticator app and enter the 6-digit code for Mentor Bridge.'}</p>
        </div>
        <ErrorBox message={error} />
        <CodeInput value={code} onChange={setCode} autoFocus recovery={useRecovery} />
        <button className="btn-primary w-full py-2.5" disabled={busy || code.replace(/\s/g, '').length < 6}>
          {busy && <Spinner />} Verify and sign in
        </button>
        <div className="flex items-center justify-between text-[13px]">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-ink-500 hover:text-ink-800"
            onClick={() => {
              setStep('password');
              setCode('');
              setError(null);
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => (setUseRecovery((v) => !v), setCode(''), setError(null))}>
            {useRecovery ? 'Use authenticator code' : 'Lost your phone? Use a recovery code'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      {notice && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-[13px] text-brand-900 ring-1 ring-inset ring-brand-200">
          <CheckCircle2 size={15} /> {notice}
        </p>
      )}
      <ErrorBox message={error} />
      <div className={error ? 'mt-4' : ''}>
        <GoogleButton role="student" next={next} />
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="password" className="label mb-0">
              Password
            </label>
            <Link href="/forgot-password" className="text-[12.5px] font-medium text-brand-700 hover:underline">
              Forgot password?
            </Link>
          </div>
          <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button ref={signInRef} className="btn-primary w-full py-2.5" disabled={busy}>
          {busy && <Spinner />} Sign in
        </button>
      </form>
      {SHOW_DEMO && <DemoAccounts email={email} password={password} onPick={pickDemo} />}
    </>
  );
}

export default function LoginPage() {
  return (
    <AuthFrame
      title="Welcome back"
      subtitle="Sign in to continue your mentoring."
      footer={
        <>
          New here?{' '}
          <Link className="font-semibold text-brand-700 hover:text-brand-800" href="/register">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}
