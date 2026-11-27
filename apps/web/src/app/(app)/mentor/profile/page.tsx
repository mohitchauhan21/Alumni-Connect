'use client';
import { useSearchParams } from 'next/navigation';
import { ExternalLink, Video } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { EducationIcon, ProfileEntry, ProfileHeader, ProfileSection } from '@/components/Profile';
import { ChipToggle, ErrorBox, Field, PageLoader, Spinner, StatusBadge, useToast } from '@/components/ui';
import { api, put } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AREA_LABELS, fmtDate } from '@/lib/format';
import { useApi } from '@/lib/hooks';
import { inr, usePaymentConfig } from '@/lib/payments';
import { VerificationWizard } from '@/components/VerificationWizard';
import type { Tag } from '@/lib/types';

/** Mirrors the API's check (lib/meet.ts): a standard Meet room code, with or without https://. */
const MEET_LINK = /^(?:https?:\/\/)?meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?(?:[?#].*)?$/i;

function Inner() {
  const toast = useToast();
  const welcome = useSearchParams().get('welcome');
  const { me, refresh } = useAuth();
  const { data, loading, reload } = useApi<{ profile: any; verification: any }>('/alumni/me');
  const meta = useApi<{ industries: string[]; departments: string[] }>('/meta');
  const tags = useApi<{ tags: Tag[] }>('/tags');
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pay = usePaymentConfig();

  useEffect(() => {
    if (data?.profile && !form) {
      const p = data.profile;
      setForm({ headline: p.headline ?? '', currentRole: p.currentRole ?? '', currentCompany: p.currentCompany ?? '', industry: p.industry ?? '', yearsExperience: p.yearsExperience ?? '', city: p.city ?? '', bio: p.bio ?? '', expertise: p.expertise.map((t: Tag) => t.id), mentoringAreas: p.mentoringAreas, languages: (p.languages ?? []).join(', '), linkedinUrl: p.linkedinUrl ?? '', mentorOptIn: p.mentorOptIn, sessionFee: String(p.sessionFee ?? 0), meetLink: p.meetLink ?? '' });
    }
  }, [data, form]);

  if (loading || !form) return <PageLoader />;
  const p = data!.profile;

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await put('/alumni/me', {
        ...form,
        yearsExperience: form.yearsExperience === '' ? undefined : Number(form.yearsExperience),
        industry: form.industry || undefined,
        languages: form.languages.split(',').map((s: string) => s.trim()).filter(Boolean),
        sessionFee: Math.max(0, Math.round(Number(form.sessionFee) || 0)),
        meetLink: form.meetLink.trim(),
      });
      toast('Profile saved');
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const meetTyped = form.meetLink.trim();
  const meetOk = !meetTyped || MEET_LINK.test(meetTyped);
  const tagsByCat = (tags.data?.tags ?? []).reduce<Record<string, Tag[]>>((acc, t) => ((acc[t.category ?? 'Other'] ??= []).push(t), acc), {});

  const name = me?.user.name ?? p.name;
  const verified = p.verificationStatus === 'verified';
  const save_ = (
    <button className="btn-primary px-5" onClick={save} disabled={busy || !meetOk}>
      {busy && <Spinner />} Save profile
    </button>
  );

  return (
    <>
      {welcome && <div className="mb-6 rounded-2xl bg-brand-50 px-5 py-4 text-[14px] text-brand-900">Thanks for joining! Start by verifying your alumni status below, then complete your profile.</div>}
      <ErrorBox message={err} />
      <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <ProfileHeader
            name={name}
            headline={form.headline || 'Add a headline'}
            verified={verified}
            lines={[[form.currentRole, form.currentCompany].filter(Boolean).join(' at '), [form.city, form.industry].filter(Boolean).join(' · ')]}
            note="This is how students see you. Your email, phone and LinkedIn are never shown to them."
            actions={save_}
            badges={
              <>
                <StatusBadge status={p.verificationStatus} />
                {p.graduationYear && <span className="rounded-full bg-ink-900/[0.05] px-3 py-1 text-[12.5px] font-medium text-ink-600">Class of {p.graduationYear}</span>}
              </>
            }
          />

          {!verified && (
            <VerificationWizard
              v={data!.verification}
              departments={meta.data?.departments ?? []}
              onDone={() => {
                reload();
                refresh();
              }}
            />
          )}

          <ProfileSection title="About">
            <Field label="Bio" hint="What you do, what you've learned, and how you like to mentor.">
              <textarea className="input min-h-[140px]" value={form.bio} maxLength={2000} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </Field>
          </ProfileSection>

          <ProfileSection title="Experience">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Headline">
                  <input className="input" value={form.headline} maxLength={140} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="Senior Data Scientist at Quantia AI" />
                </Field>
              </div>
              <Field label="Current role">
                <input className="input" value={form.currentRole} onChange={(e) => setForm({ ...form, currentRole: e.target.value })} />
              </Field>
              <Field label="Company">
                <input className="input" value={form.currentCompany} onChange={(e) => setForm({ ...form, currentCompany: e.target.value })} />
              </Field>
              <Field label="Industry">
                <select className="input" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                  <option value="">Select…</option>
                  {(meta.data?.industries ?? []).map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </Field>
              <Field label="Years of experience">
                <input className="input" type="number" min={0} value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: e.target.value })} />
              </Field>
              <Field label="City">
                <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </Field>
            </div>
          </ProfileSection>

          {p.department && (
            <ProfileSection title="Education">
              <ProfileEntry icon={EducationIcon} title={[p.degree, p.department].filter(Boolean).join(', ')} subtitle={p.graduationYear ? `Class of ${p.graduationYear}` : null} meta={verified ? `Verified against institution records${p.verifiedAt ? ` on ${fmtDate(p.verifiedAt)}` : ''}` : 'From your verification record'} />
            </ProfileSection>
          )}

          <ProfileSection title="Skills & mentoring">
            <div className="space-y-6">
              <div>
                <span className="label">How you can help</span>
                <ChipToggle options={Object.entries(AREA_LABELS).map(([value, label]) => ({ value, label }))} value={form.mentoringAreas} onChange={(v) => setForm({ ...form, mentoringAreas: v })} />
              </div>
              <div>
                <span className="label">Expertise (up to 15)</span>
                <div className="space-y-3">
                  {Object.entries(tagsByCat).map(([cat, ts]) => (
                    <div key={cat}>
                      <div className="mb-1.5 text-[12.5px] font-medium text-ink-500">{cat}</div>
                      <ChipToggle options={ts.map((t) => ({ value: t.id, label: t.name }))} value={form.expertise} onChange={(v) => setForm({ ...form, expertise: v })} max={15} />
                    </div>
                  ))}
                </div>
              </div>
              <Field label="Languages" hint="Comma separated">
                <input className="input" value={form.languages} onChange={(e) => setForm({ ...form, languages: e.target.value })} />
              </Field>
            </div>
          </ProfileSection>
        </div>

        <aside className="space-y-6">
          <ProfileSection title="Visibility">
            <label className="flex items-start gap-3 text-[14px]">
              <input type="checkbox" className="mt-0.5 rounded text-brand-600" checked={form.mentorOptIn} onChange={(e) => setForm({ ...form, mentorOptIn: e.target.checked })} />
              <span>
                <span className="font-medium">Show me to students as a mentor</span>
                <span className="mt-0.5 block text-[13px] text-ink-500">Turn off to stop appearing in search. Current mentees are unaffected.</span>
              </span>
            </label>
          </ProfileSection>
          <div id="fee" className="scroll-mt-24">
            <ProfileSection title="Session fee">
              <Field label="Price per session (₹)" hint={pay ? `0 means free. The programme allows up to ₹${pay.maxSessionFee}.` : '0 means free.'}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-500">₹</span>
                  <input className="input pl-7 tabular-nums" inputMode="numeric" value={form.sessionFee} onChange={(e) => setForm({ ...form, sessionFee: e.target.value.replace(/[^0-9]/g, '').slice(0, 6) })} />
                </div>
              </Field>
              {pay && Number(form.sessionFee) > 0 && (
                <p className="mt-3 text-[12.5px] leading-relaxed text-ink-500">
                  Students pay <span className="font-medium text-ink-800">{inr(Number(form.sessionFee) * 100)}</span> when they book; you receive{' '}
                  <span className="font-medium text-ink-800">{inr(Math.round(Number(form.sessionFee) * 100 * (1 - pay.platformFeePercent / 100)))}</span> after the {pay.platformFeePercent}% platform fee. Cancel a paid session and the student is refunded in full.
                </p>
              )}
              {pay && !pay.enabled && <p className="mt-3 text-[12.5px] text-amber-800">Paid sessions are switched off for the programme right now, so sessions stay free.</p>}
            </ProfileSection>
          </div>
          <div id="video" className="scroll-mt-24">
            <ProfileSection title="Video calls">
              <Field label="Your Google Meet link" hint="Sessions you confirm use this room instead of an auto-generated Jitsi link. Only your mentees see it, and only on their confirmed sessions with you.">
                <div className="relative">
                  <Video size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    className={`input pl-10 ${meetOk ? '' : 'border-red-500 focus:border-red-500 focus:ring-red-500/20'}`}
                    value={form.meetLink}
                    onChange={(e) => setForm({ ...form, meetLink: e.target.value })}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    inputMode="url"
                    aria-invalid={!meetOk}
                  />
                </div>
              </Field>
              {!meetOk && <p className="mt-2 text-[12.5px] text-red-600">That doesn’t look like a Google Meet link. It should look like meet.google.com/abc-defg-hij.</p>}
              {meetOk && meetTyped && (
                <a href={meetTyped.startsWith('http') ? meetTyped : `https://${meetTyped}`} target="_blank" rel="noopener noreferrer" className="link mt-2 inline-flex items-center gap-1 text-[12.5px]">
                  Test this link <ExternalLink size={12} />
                </a>
              )}
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-500">
                In Google Meet, choose <span className="font-medium text-ink-700">New meeting → Create a meeting for later</span> and paste the link here. Saving also updates your upcoming sessions. Leave it empty to go back to Jitsi.
              </p>
            </ProfileSection>
          </div>
          <ProfileSection title="Private (staff only)">
            <Field label="LinkedIn URL" hint="Visible only to Alumni Relations. Never shown to students.">
              <input className="input" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} placeholder="https://www.linkedin.com/in/…" />
            </Field>
          </ProfileSection>
          <div className="lg:hidden">{save_}</div>
        </aside>
      </div>
    </>
  );
}

export default function MentorProfilePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Inner />
    </Suspense>
  );
}
