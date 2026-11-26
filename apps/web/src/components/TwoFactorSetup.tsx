'use client';
import { Check, Copy, Download, KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { post } from '@/lib/api';
import { ErrorBox, Spinner } from './ui';

type SetupData = { secret: string; otpauthUrl: string; qrSvg: string };

/** A 6-digit code input that accepts pasted codes with spaces. */
export function CodeInput({ value, onChange, autoFocus, recovery = false }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; recovery?: boolean }) {
  return (
    <input
      className="input text-center font-mono text-[18px] tracking-[0.35em]"
      inputMode={recovery ? 'text' : 'numeric'}
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      placeholder={recovery ? 'xxxx-xxxx' : '123456'}
      maxLength={recovery ? 12 : 7}
      value={value}
      onChange={(e) => onChange(recovery ? e.target.value.trim() : e.target.value.replace(/[^\d ]/g, ''))}
      aria-label={recovery ? 'Recovery code' : 'Six-digit code'}
    />
  );
}

/** Recovery codes, shown once, with copy and download. */
export function RecoveryCodes({ codes, onDone, doneLabel = 'I’ve saved them' }: { codes: string[]; onDone: () => void; doneLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const text = `Mentor Bridge recovery codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join('\n')}\n`;
  return (
    <div>
      <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-3.5 py-3 text-[13px] text-amber-900 ring-1 ring-inset ring-amber-200">
        <KeyRound size={16} className="mt-0.5 shrink-0" />
        <p>Save these recovery codes now. If you lose your phone, each code signs you in once. <strong>You won’t see them again.</strong></p>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 font-mono text-[14px]">
        {codes.map((c) => (
          <li key={c} className="rounded-lg border border-[color:var(--line)] bg-ink-50/60 px-3 py-2 text-center tracking-wider">
            {c}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary text-[13px]"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              /* clipboard blocked: the download still works */
            }
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
        </button>
        <a className="btn-secondary text-[13px]" href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`} download="alumni-mentor-recovery-codes.txt">
          <Download size={14} /> Download
        </a>
        <button type="button" className="btn-primary ml-auto text-[13px]" onClick={onDone}>
          {doneLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * Turns on two-factor sign-in: scan the QR code (drawn by our own server; the setup link never
 * goes to a third party), confirm with a code, then save the recovery codes.
 */
export function TwoFactorSetup({ onComplete, onCancel }: { onComplete: () => void; onCancel?: () => void }) {
  const [data, setData] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      setData(await post<SetupData>('/auth/2fa/setup'));
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await post<{ recoveryCodes: string[] }>('/auth/2fa/enable', { code: code.replace(/\s/g, '') });
      setCodes(r.recoveryCodes);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (codes) return <RecoveryCodes codes={codes} onDone={onComplete} />;

  if (!data) {
    return (
      <div>
        <ErrorBox message={err} />
        <p className="text-[13.5px] text-ink-600">
          You’ll need an authenticator app on your phone, such as Google Authenticator, Microsoft Authenticator or 1Password. After this, signing in asks for your password and a 6-digit code from the app.
        </p>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary" onClick={start} disabled={busy}>
            {busy ? <Spinner /> : <ShieldCheck size={15} />} Set up two-factor sign-in
          </button>
          {onCancel && (
            <button className="btn-ghost" onClick={onCancel}>
              Not now
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={confirm}>
      <ErrorBox message={err} />
      <ol className="space-y-5 text-[13.5px]">
        <li className="flex gap-4">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-semibold text-brand-700">1</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink-800">Scan this with your authenticator app</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {/* SVG generated by our API from the setup link; contains no script. */}
              <div className="h-40 w-40 rounded-xl border border-[color:var(--line)] bg-white p-2 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: data.qrSvg }} role="img" aria-label="QR code for your authenticator app" />
              <div className="min-w-0 text-[12.5px] text-ink-500">
                <p className="flex items-center gap-1.5">
                  <Smartphone size={14} /> On this phone?{' '}
                  <a className="font-medium text-brand-700 hover:underline" href={data.otpauthUrl}>
                    Open in your app
                  </a>
                </p>
                <button type="button" className="mt-1.5 font-medium text-brand-700 hover:underline" onClick={() => setShowKey((s) => !s)}>
                  {showKey ? 'Hide' : 'Can’t scan? Enter a key instead'}
                </button>
                {showKey && <code className="mt-1.5 block break-all rounded-lg bg-ink-50 px-2 py-1.5 font-mono text-[12.5px] tracking-wider text-ink-800">{data.secret.replace(/(.{4})/g, '$1 ').trim()}</code>}
              </div>
            </div>
          </div>
        </li>
        <li className="flex gap-4">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-semibold text-brand-700">2</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink-800">Enter the 6-digit code it shows</p>
            <div className="mt-2 flex max-w-xs gap-2">
              <CodeInput value={code} onChange={setCode} autoFocus />
            </div>
          </div>
        </li>
      </ol>
      <div className="mt-5 flex gap-2">
        <button className="btn-primary" disabled={busy || code.replace(/\s/g, '').length !== 6}>
          {busy && <Spinner />} Turn on
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
