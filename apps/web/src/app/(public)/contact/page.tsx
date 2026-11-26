import { Building2, LifeBuoy, Mail, MapPin, Phone } from 'lucide-react';
import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { SITE } from '@/lib/site';

export const metadata = { title: 'Contact', description: 'Get in touch with Mentor Bridge — support, and bringing the platform to your institution.' };

export default function ContactPage() {
  const mail = (subject: string) => (SITE.email ? `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}` : undefined);
  const cards = [
    { icon: Building2, title: 'For institutions', body: 'Bring verified alumni mentorship to your campus. We’ll set up your programme, import your alumni register and onboard your Alumni Relations team.', cta: 'Talk to us', href: mail('Bringing Mentor Bridge to our institution') },
    { icon: LifeBuoy, title: 'Support', body: 'Trouble signing in, a payment or refund question, or something not working? Include your account email and, for payments, the payment reference.', cta: 'Get help', href: mail('Support request') },
  ];
  return (
    <LegalPage title="Contact us" intro={<p>We read every message and usually reply within one working day.</p>}>
      <div className="grid gap-5 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.title} className="card p-7">
            <c.icon size={22} className="text-brand-600" />
            <h2 className="!mt-4 !text-[19px]">{c.title}</h2>
            <p className="!text-[14.5px]">{c.body}</p>
            {c.href ? (
              <a href={c.href} className="btn-primary mt-5 !no-underline !text-white">
                {c.cta}
              </a>
            ) : (
              <p className="!mt-5 !text-[13px] !text-ink-400">Contact email coming soon.</p>
            )}
          </div>
        ))}
      </div>

      <div className="card mt-5 divide-y divide-[color:var(--line)] px-7">
        {SITE.email && (
          <p className="!mt-0 flex items-center gap-3 py-4">
            <Mail size={17} className="text-ink-400" /> <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
          </p>
        )}
        {SITE.phone && (
          <p className="!mt-0 flex items-center gap-3 py-4">
            <Phone size={17} className="text-ink-400" /> <a href={`tel:${SITE.phone.replace(/\s/g, '')}`}>{SITE.phone}</a>
          </p>
        )}
        {SITE.address && (
          <p className="!mt-0 flex items-start gap-3 py-4">
            <MapPin size={17} className="mt-1 shrink-0 text-ink-400" /> <span>{SITE.address}</span>
          </p>
        )}
        <p className="!mt-0 py-4 !text-[14px]">
          Already a member? Most questions are answered in your account — see <Link href="/refunds">cancellations &amp; refunds</Link>, the <Link href="/privacy">privacy statement</Link> and the <Link href="/terms">terms</Link>.
        </p>
      </div>
    </LegalPage>
  );
}
