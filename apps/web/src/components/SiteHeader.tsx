'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { homeFor } from '@/lib/format';
import { SITE_NAV } from '@/lib/nav';
import { useTheme } from '@/lib/theme';
import { Logo } from './Logo';
import { ThemeToggle } from './ThemeToggle';
import GooeyNav from './ui/gooey-nav';
import { cx } from './ui';

const SECTIONS = ['product', 'roles', 'how'];

/**
 * Which navbar item is current: the landing section in view, or none.
 * A click pins its item at once; the scroll tracker then waits until the smooth scroll has
 * stopped, so the pill goes straight to the clicked item instead of hopping through the others.
 */
function useActiveIndex(path: string) {
  const [section, setSection] = useState(-1);
  const [pinned, setPinned] = useState<number | null>(null);
  const pinnedRef = useRef<number | null>(null);
  const latest = useRef(-1);

  useEffect(() => {
    setPinned(null);
    pinnedRef.current = null;
    if (path !== '/') return;
    let io: IntersectionObserver | null = null;
    // The page renders with the header; wait a frame so the sections exist.
    const raf = requestAnimationFrame(() => {
      const els = SECTIONS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
      if (!els.length) return;
      const seen = new Map<string, boolean>();
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => seen.set(e.target.id, e.isIntersecting));
          latest.current = SECTIONS.findIndex((id) => seen.get(id));
          if (pinnedRef.current === null) setSection(latest.current);
        },
        { rootMargin: '-45% 0px -50% 0px' },
      );
      els.forEach((el) => io!.observe(el));
    });
    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
    };
  }, [path]);

  const pin = (index: number) => {
    pinnedRef.current = index;
    setPinned(index);
    let last = window.scrollY;
    let still = 0;
    // Release once the page has stopped scrolling for ~200 ms (or after 2.5 s at most).
    const started = performance.now();
    const check = () => {
      if (pinnedRef.current !== index) return;
      still = Math.abs(window.scrollY - last) < 1 ? still + 1 : 0;
      last = window.scrollY;
      if (still >= 12 || performance.now() - started > 2500) {
        pinnedRef.current = null;
        setPinned(null);
        setSection(latest.current);
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  };

  const active = path === '/' ? (pinned ?? section) : -1;
  return { active, pin };
}

/**
 * The one public navbar: landing, sign-in pages, legal pages, demo and 404. A translucent bar
 * with the gooey pill nav in the middle; phones get the same links in a drop-down. Signed-in
 * visitors see a Dashboard button instead of Sign in / Get started.
 */
export function SiteHeader() {
  const path = usePathname();
  const router = useRouter();
  const { me, loading } = useAuth();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const { active, pin } = useActiveIndex(path);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Client-side routing; a same-page section link just scrolls.
  const go = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    setOpen(false);
    if (href.startsWith('/#') && path === '/') {
      const i = SITE_NAV.findIndex((l) => l.href === href);
      if (i >= 0) pin(i);
      return;
    }
    e.preventDefault();
    router.push(href);
  };

  const actions = loading ? null : me ? (
    <Link href={homeFor(me.user.role)} className="btn-primary px-4 py-1.5 text-[13px]">
      Dashboard
    </Link>
  ) : (
    <>
      {path !== '/login' && (
        <Link href="/login" className="btn-ghost px-3.5 py-1.5 text-[13px]">
          Sign in
        </Link>
      )}
      {path !== '/register' && (
        <Link href="/register" className="btn-primary px-4 py-1.5 text-[13px]">
          Get started
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--line)] bg-canvas/75 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5 sm:px-6">
        <Link href="/" className="flex" aria-label="Mentor Bridge home">
          <Logo size={26} compact />
        </Link>

        <GooeyNav
          aria-label="Main"
          className="!hidden lg:!inline-flex"
          items={SITE_NAV}
          activeIndex={active}
          theme={theme}
          size="sm"
          frame={false}
          particleCount={12}
          spread={36}
          onLinkClick={(e, item) => item.href && go(e, item.href)}
        />

        <div className="flex items-center gap-1">
          <ThemeToggle size={16} />
          <div className="hidden items-center gap-1.5 lg:flex">{actions}</div>
          <button
            type="button"
            className="btn-ghost p-2 lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {/* Phones: the same links and actions in a drop-down panel. */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="site-menu"
            className="absolute inset-x-0 top-full border-b border-[color:var(--line)] bg-canvas/95 px-5 pb-6 pt-2 backdrop-blur-2xl lg:hidden"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <nav aria-label="Main" className="flex flex-col">
              {SITE_NAV.map((l, i) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => go(e, l.href)}
                  aria-current={i === active ? 'page' : undefined}
                  className={cx('border-b border-[color:var(--line)] py-3.5 text-[17px] font-medium tracking-[-0.015em]', i === active ? 'text-ink-900' : 'text-ink-700')}
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="mt-5 flex gap-2 [&>a]:flex-1 [&>a]:py-2.5">{actions}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
