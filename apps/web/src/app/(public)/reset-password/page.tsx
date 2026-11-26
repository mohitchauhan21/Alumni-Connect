'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AuthFrame } from '@/components/AuthFrame';
import { ErrorBox, Field, Spinner } from '@/components/ui';
import { post } from '@/lib/api';

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const invite = params.get('invite') === '1';
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Take the one-time token out of the address bar so it doesn't linger in history or get shared.
  useEffect(() => {
    const t = params.get('token');
    if (t) {
      setToken(t);
      window.history.replaceState(null, '', invite ? '/reset-password?invite=1' : '/reset-password');
    }
  }, [params, invite]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw !== confirm) return setError('The passwords don’t match');
    setBusy(true);
    try {
      await post('/auth/reset-password', { token, password: pw });
      router.replace('/login?reset=1');
    } catch (err: any) {
      setError(err.details?.fieldErrors?.password?.[0] ?? err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="text-[13.5px] text-ink-600">
        <p>This page needs the link from your email. Links work once and expire after a short time.</p>
        <Link href="/forgot-password" className="btn-primary mt-5 inline-flex">
          Get a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBox message={error} />
      <Field label={invite ? 'Password' : 'New password'} hint="8+ characters, with a letter and a number">
        <input className="input" type="password" autoComplete="new-password" required minLength={8} autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <Field label="Repeat password">
        <input className="input" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <button className="btn-primary w-full py-2.5" disabled={busy}>
        {busy && <Spinner />} {invite ? 'Set password' : 'Change password'}
      </button>
      {!invite && <p className="text-[12.5px] text-ink-500">You’ll be signed out on all your devices, then you can sign in with the new password.</p>}
    </form>
  );
}

function Title() {
  const invite = useSearchParams().get('invite') === '1';
  return (
    <AuthFrame title={invite ? 'Welcome! Choose your password' : 'Choose a new password'} subtitle={invite ? 'You’ve been invited to manage Mentor Bridge.' : undefined}>
      <ResetForm />
    </AuthFrame>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <Title />
    </Suspense>
  );
}
