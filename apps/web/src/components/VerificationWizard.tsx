'use client';
import { CheckCircle2, FileText, GraduationCap, IdCard, ShieldCheck, Upload } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { useTheme } from '@/lib/theme';
import Stepper, { Step } from './reactbits/Stepper';
import { Badge, Card, ErrorBox, Field, Spinner, StatusBadge, useToast } from './ui';

/**
 * Alumni verification as a 4-step wizard (React Bits Stepper):
 * Identity → Programme → Document → Review. Each step validates before "Continue" unlocks,
 * and the review step shows exactly what will be matched against institutional records.
 */
export function VerificationWizard({ v, departments, onDone }: { v: any; departments: string[]; onDone: () => void }) {
  const toast = useToast();
  const { theme } = useTheme();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ fullName: '', dateOfBirth: '', rollNumber: '', graduationYear: '', degree: 'B.Tech', department: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canSubmit = !v || v.status === 'needs_info' || v.status === 'rejected';
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const valid: Record<number, boolean> = {
    1: form.fullName.trim().length >= 2,
    2: form.rollNumber.trim().length >= 3 && /^\d{4}$/.test(form.graduationYear) && !!form.degree && !!form.department,
    3: files.length <= 3 && files.every((f) => f.size <= 5 * 1024 * 1024),
    4: true,
  };

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, val]) => val && fd.append(k, val));
      files.forEach((f) => fd.append('documents', f));
      await api('/alumni/verify', { method: 'POST', form: fd });
      setStep(5);
      toast('Submitted — the Alumni Relations office will review it shortly.');
      setTimeout(onDone, 1600);
    } catch (e: any) {
      setErr(e.message);
      setStep(4);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={<span className="flex items-center gap-2"><ShieldCheck size={16} className="text-brand-600" /> Alumni verification</span>} actions={v && <StatusBadge status={v.status} />}>
      {v && (
        <div className="mb-6 space-y-3">
          {v.matchResult && (
            <p className="flex flex-wrap items-center gap-2 text-[13px]">
              Institutional record check: {v.matchResult.matched ? <Badge tone="green">Matched</Badge> : <Badge tone="amber">Needs manual review</Badge>}
              {v.matchResult.mismatchedFields?.length > 0 && <span className="text-xs text-ink-500">Differences: {v.matchResult.mismatchedFields.join(', ')}</span>}
            </p>
          )}
          {v.reviewNote && <p className="rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-900 ring-1 ring-inset ring-amber-200">Note from Alumni Relations: {v.reviewNote}</p>}
          <ol className="space-y-2 border-l-2 border-[color:var(--line-strong)] pl-4 text-[13px]">
            {v.history.map((h: any, i: number) => (
              <li key={i}>
                <span className="font-medium capitalize">{h.status.replace('_', ' ')}</span>{' '}
                <span className="text-ink-500">
                  · {fmtDateTime(h.at)}
                  {h.byName ? ` · ${h.byName}` : ''}
                </span>
                {h.note && <div className="text-xs text-ink-500">{h.note}</div>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {canSubmit && (
        <>
          <ErrorBox message={err} />
          <Stepper
            step={step}
            onStepChange={(n) => setStep(n)}
            onFinalStepCompleted={submit}
            theme={theme}
            accentColor="#cf4a06"
            width="100%"
            frame={false}
            linear
            nextButtonText="Continue"
            completeButtonText={busy ? 'Submitting…' : 'Submit for verification'}
            nextButtonProps={{ disabled: !valid[step] || busy }}
            completedContent={
              <div className="flex flex-col items-center py-8 text-center">
                <CheckCircle2 size={44} className="text-ok-500" />
                <h3 className="mt-3 text-lg font-semibold">Verification submitted</h3>
                <p className="mt-1 max-w-sm text-[13px] text-ink-500">We’re matching your details against the institution’s records. You’ll get a notification as soon as it’s reviewed.</p>
              </div>
            }
          >
            <Step title="Identity" description="As on your records" icon={<IdCard size={15} />}>
              <div className="grid gap-4 pt-2 sm:grid-cols-2">
                <Field label="Full name" hint="Exactly as it appears on your degree">
                  <input className="input" value={form.fullName} onChange={set('fullName')} autoComplete="name" />
                </Field>
                <Field label="Date of birth (optional)" hint="Only used to match records">
                  <input className="input" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
                </Field>
              </div>
            </Step>
            <Step title="Programme" description="What you studied" icon={<GraduationCap size={15} />}>
              <div className="grid gap-4 pt-2 sm:grid-cols-2">
                <Field label="Roll / enrolment number">
                  <input className="input" value={form.rollNumber} onChange={set('rollNumber')} placeholder="e.g. 2018CS901" />
                </Field>
                <Field label="Graduation year">
                  <input className="input" inputMode="numeric" maxLength={4} value={form.graduationYear} onChange={set('graduationYear')} placeholder="2018" />
                </Field>
                <Field label="Degree">
                  <select className="input" value={form.degree} onChange={set('degree')}>
                    {['B.Tech', 'M.Tech', 'MBA', 'MCA', 'B.Sc', 'M.Sc', 'PhD'].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Department">
                  <select className="input" value={form.department} onChange={set('department')}>
                    <option value="">Select…</option>
                    {departments.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </Step>
            <Step title="Document" description="Optional, speeds things up" icon={<FileText size={15} />}>
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setFiles(Array.from(e.dataTransfer.files).filter((f) => /pdf|png|jpe?g|webp/i.test(f.type)).slice(0, 3));
                }}
                className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/50 px-6 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50/40"
              >
                <Upload size={22} className="text-ink-400" />
                <span className="text-[13.5px] font-medium">Drop or choose your degree / provisional certificate</span>
                <span className="text-xs text-ink-500">PDF, JPG or PNG · up to 3 files · 5 MB each</span>
                <input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))} />
              </label>
              {files.length > 0 && (
                <ul className="mt-3 space-y-1 text-[13px]">
                  {files.map((f) => (
                    <li key={f.name} className="flex items-center gap-2">
                      <FileText size={14} className="text-ink-400" /> {f.name} <span className="text-ink-400">({Math.round(f.size / 1024)} KB)</span>
                    </li>
                  ))}
                </ul>
              )}
            </Step>
            <Step title="Review" description="Check and submit" icon={<ShieldCheck size={15} />}>
              <dl className="mt-2 divide-y divide-[color:var(--line)] rounded-2xl border border-[color:var(--line)] text-[13px]">
                {[
                  ['Name', form.fullName],
                  ['Date of birth', form.dateOfBirth || '—'],
                  ['Roll number', form.rollNumber.toUpperCase()],
                  ['Programme', `${form.degree} ${form.department}`],
                  ['Graduation year', form.graduationYear],
                  ['Documents', files.length ? files.map((f) => f.name).join(', ') : 'None'],
                ].map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                    <dt className="text-ink-500">{k}</dt>
                    <dd className="text-right font-medium text-ink-800">{val}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs text-ink-500">These details are compared with the institution’s alumni register. Only Alumni Relations staff see your submission and documents.</p>
              {busy && (
                <p className="mt-2 flex items-center gap-2 text-[13px] text-ink-600">
                  <Spinner /> Submitting…
                </p>
              )}
            </Step>
          </Stepper>
        </>
      )}
    </Card>
  );
}
