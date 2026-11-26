import Link from 'next/link';
import { LogoMark } from './Logo';

const COLUMNS: { title: string; links: [string, string][] }[] = [
  {
    title: 'Product',
    links: [
      ['Features', '/#product'],
      ['How it works', '/#how'],
      ['Who it’s for', '/#roles'],
      ['FAQ', '/#faq'],
    ],
  },
  {
    title: 'Get started',
    links: [
      ['Create an account', '/register'],
      ['Become a mentor', '/register?role=alumnus'],
      ['Sign in', '/login'],
      ['For institutions', '/contact'],
    ],
  },
  {
    title: 'Company',
    links: [
      ['Contact', '/contact'],
      ['Privacy statement', '/privacy'],
      ['Terms of service', '/terms'],
      ['Cancellations & refunds', '/refunds'],
    ],
  },
];

/** The public footer: brand, three link columns, and the legal line. Every link resolves. */
export function SiteFooter() {
  return (
    <footer className="border-t border-[color:var(--line)] bg-canvas">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-6 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Mentor Bridge home">
            <LogoMark size={28} />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Mentor Bridge</span>
          </Link>
          <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-ink-500">Verified alumni mentorship for institutions — built around everyone’s time and privacy.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-[12.5px] font-semibold text-ink-900">{c.title}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-[13.5px] text-ink-500 transition-colors hover:text-ink-900">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-[color:var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-[12px] text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>© {new Date().getFullYear()} Mentor Bridge. All rights reserved.</span>
          <span>Made in India</span>
        </div>
      </div>
    </footer>
  );
}
