'use client';
import { Settings2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { DataRightsCard } from '@/components/DataRightsCard';
import { SecurityCard } from '@/components/SecurityCard';
import { ThemePicker } from '@/components/ThemeToggle';
import { Badge, Card, Field, PageHeader, PageLoader, Spinner, useToast } from '@/components/ui';
import { del, get, patch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApi } from '@/lib/hooks';

function Inner() {
  const toast = useToast();
  const params = useSearchParams();
  const { me, refresh } = useAuth();
  const cal = useApi<{ providers: { provider: string; configured: boolean; connected: boolean }[]; videoProvider: string }>('/calendar/status');
  const [form, setForm] = useState({ name: '', phone: '', timezone: '', email: true, sms: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me) setForm({ name: me.user.name, phone: me.user.phone ?? '', timezone: me.user.timezone, email: me.user.notificationPrefs.email, sms: me.user.notificationPrefs.sms });
  }, [me]);
  useEffect(() => {
    const c = params.get('calendar');
    if (c === 'connected') toast('Calendar connected');
    if (c === 'error') toast('Calendar connection failed', 'err');
  }, [params, toast]);

  if (!me) return <PageLoader />;

  async function save() {
    setBusy(true);
    try {
      await patch('/auth/me', { name: form.name, phone: form.phone, timezone: form.timezone, notificationPrefs: { email: form.email, sms: form.sms } });
      await refresh();
      toast('Settings saved');
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setBusy(false);
    }
  }
  async function connect(p: string) {
    try {
      const r = await get<{ url: string }>(`/calendar/${p}/connect`);
      window.location.href = r.url;
    } catch (e: any) {
      toast(e.message, 'err');
    }
  }

  return (
    <>
      <PageHeader icon={Settings2} eyebrow="Account" title="Settings" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account">
          <div className="space-y-4">
            <Field label="Name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Email" hint="Used for sign-in and notifications. Never shown to other users.">
              <input className="input bg-ink-50" value={me.user.email} disabled />
            </Field>
            <Field label="Mobile" hint="Only for SMS reminders if enabled below. Never shown to other users.">
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Time zone">
              <input className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
            </Field>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Appearance">
            <p className="mb-3 text-[13px] text-ink-500">Choose a theme, or follow your device’s setting. It’s remembered on this device.</p>
            <ThemePicker />
          </Card>
          <Card title="Notifications">
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded text-brand-600" checked={form.email} onChange={(e) => setForm({ ...form, email: e.target.checked })} /> Email notifications
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded text-brand-600" checked={form.sms} onChange={(e) => setForm({ ...form, sms: e.target.checked })} /> SMS reminders for sessions
              </label>
              <p className="text-xs text-ink-500">In-app notifications are always on. Messages never trigger emails, to keep inboxes quiet.</p>
            </div>
          </Card>
          <Card title="Calendar">
            <p className="mb-3 text-sm text-ink-600">Confirmed sessions are added to your own calendar, without an attendee list so no email addresses are shared. You can always download an .ics file instead.</p>
            <ul className="space-y-2">
              {cal.data?.providers.map((p) => (
                <li key={p.provider} className="flex items-center justify-between rounded-lg border border-ink-100 px-3 py-2">
                  <span className="text-sm font-medium">{p.provider === 'google' ? 'Google Calendar' : 'Outlook Calendar'}</span>
                  {!p.configured ? (
                    <Badge>Not enabled on this server</Badge>
                  ) : p.connected ? (
                    <button className="btn-ghost text-xs" onClick={async () => (await del(`/calendar/${p.provider}`), cal.reload())}>
                      Disconnect
                    </button>
                  ) : (
                    <button className="btn-secondary text-xs" onClick={() => connect(p.provider)}>
                      Connect
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <div className="mt-6">
        <button className="btn-primary" onClick={save} disabled={busy}>
          {busy && <Spinner />} Save settings
        </button>
      </div>
      <div className="mt-8" id="security">
        <SecurityCard />
      </div>
      <div className="mt-6" id="your-data">
        <DataRightsCard />
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Inner />
    </Suspense>
  );
}
