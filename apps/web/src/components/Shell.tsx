'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronsLeft, ChevronsUpDown, LogOut, Menu, Moon, Search, Settings2, Sun, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { get } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { homeFor } from '@/lib/format';
import { NAV, ROLE_LABEL, flatNav, type NavItem } from '@/lib/nav';
import { closeSocket, getSocket } from '@/lib/socket';
import { useTheme } from '@/lib/theme';
import type { Notice, Role } from '@/lib/types';
import { EmailBanner, StaffMfaGate } from './AccountNotices';
import { openCommandPalette } from './CommandPalette';
import { LogoMark } from './Logo';
import { PageTransition } from './motion';
import { Avatar, PageLoader, cx, useToast } from './ui';

/** Role home pages: current only on an exact match, so they don't light up for every page under them. */
const ROOTS = new Set(['/admin', '/mentor', '/student']);
const matches = (path: string, href: string) => path === href || (!ROOTS.has(href) && path.startsWith(href + '/'));

/**
 * Signed-in layout. All navigation lives in the sidebar: search, the role's sections,
 * Notifications (with its unread count), and the account menu (Settings, theme, sign out).
 * On desktop it is docked and collapses to an icon rail (remembered per browser); on phones the
 * same sidebar slides in from the menu button.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const { me, loading, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const [unread, setUnread] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!loading && !me) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [loading, me, router, path]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('amn.sidebar') === 'collapsed');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('amn.sidebar', c ? 'open' : 'collapsed');
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  useEffect(() => {
    if (!me) return;
    get<{ unread: number }>('/notifications?limit=1').then((d) => setUnread(d.unread)).catch(() => undefined);
    const s = getSocket();
    const onNote = (n: Notice) => {
      setUnread((u) => u + 1);
      if (n.type !== 'message' || !window.location.pathname.startsWith('/mentorships/')) toast(n.title);
    };
    s.on('notification', onNote);
    return () => {
      s.off('notification', onNote);
    };
  }, [me, toast]);

  useEffect(() => {
    const h = () => setUnread(0);
    window.addEventListener('notifications-read', h);
    return () => window.removeEventListener('notifications-read', h);
  }, []);

  // Phone drawer: close on navigation and Escape, keep the page behind it still, give focus back.
  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    const button = menuButton.current;
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
      button?.focus();
    };
  }, [drawer]);

  if (loading || !me) return <PageLoader />;
  if (me.security?.mfaSetupRequired) {
    return (
      <div className="min-h-screen bg-canvas px-4 py-10">
        <StaffMfaGate />
      </div>
    );
  }
  const role = me.user.role as Role;
  const ids = [...flatNav(role).map((n) => n.href), '/notifications', '/settings'];
  const activeHref = ids.filter((h) => matches(path, h)).sort((a, b) => b.length - a.length)[0];
  const signOut = () => {
    closeSocket();
    logout();
  };

  const sidebar = (rail: boolean, inDrawer: boolean) => (
    <Sidebar
      role={role}
      name={me.user.name}
      email={me.user.email}
      avatarUrl={me.user.avatarUrl}
      activeHref={activeHref}
      unread={unread}
      rail={rail}
      onCollapse={inDrawer ? () => setDrawer(false) : toggleCollapsed}
      inDrawer={inDrawer}
      onSignOut={signOut}
    />
  );

  return (
    <div className="relative min-h-screen bg-canvas lg:flex">
      {/* desktop: docked sidebar */}
      <div className={cx('sticky top-0 hidden h-screen shrink-0 border-r border-[color:var(--line)] bg-surface/60 transition-[width] duration-300 lg:block', collapsed ? 'w-[68px]' : 'w-[256px]')}>{sidebar(collapsed, false)}</div>

      {/* phones: the same sidebar in a drawer */}
      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] dark:bg-black/60" onClick={() => setDrawer(false)} aria-hidden />
            <motion.div
              id="app-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-y-0 left-0 w-[min(288px,86vw)] border-r border-[color:var(--line)] bg-surface shadow-2xl"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
            >
              {sidebar(false, true)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* main column */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-[color:var(--line)] bg-canvas/80 px-3 backdrop-blur-2xl backdrop-saturate-150 sm:px-4 lg:hidden">
          <button ref={menuButton} className="btn-ghost relative p-2" onClick={() => setDrawer(true)} aria-label={unread > 0 ? `Open menu, ${unread} unread notifications` : 'Open menu'} aria-expanded={drawer} aria-controls="app-drawer">
            <Menu size={20} />
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-canvas" />}
          </button>
          <Link href={homeFor(role)} className="flex items-center gap-2" aria-label="Home">
            <LogoMark size={26} />
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Mentor Bridge</span>
          </Link>
          <button className="btn-ghost ml-auto p-2" onClick={openCommandPalette} aria-label="Search">
            <Search size={19} />
          </button>
        </header>

        <main className="relative mx-auto w-full max-w-[1180px] flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          <EmailBanner />
          <PageTransition routeKey={path}>{children}</PageTransition>
        </main>
      </div>

    </div>
  );
}

function Sidebar({
  role,
  name,
  email,
  avatarUrl,
  activeHref,
  unread,
  rail,
  inDrawer,
  onCollapse,
  onSignOut,
}: {
  role: Role;
  name: string;
  email: string;
  avatarUrl?: string | null;
  activeHref?: string;
  unread: number;
  rail: boolean;
  inDrawer: boolean;
  onCollapse: () => void;
  onSignOut: () => void;
}) {
  const [shortcut, setShortcut] = useState('Ctrl K');
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut('⌘K');
  }, []);

  const item = (n: NavItem, badge?: number) => {
    const active = n.href === activeHref;
    const Icon = n.icon;
    return (
      <Link
        key={n.href}
        href={n.href}
        title={rail ? n.label : undefined}
        aria-current={active ? 'page' : undefined}
        className={cx(
          'group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13.5px] transition-colors',
          active ? 'bg-ink-900/[0.07] font-medium text-ink-900' : 'text-ink-600 hover:bg-ink-900/[0.04] hover:text-ink-900',
          rail && 'justify-center px-0',
        )}
      >
        <Icon size={16} strokeWidth={active ? 2.2 : 1.9} className={cx('shrink-0', active ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600')} />
        {!rail && <span className="truncate">{n.label}</span>}
        {badge ? (
          rail ? (
            <span className="absolute right-2.5 top-2 h-2 w-2 rounded-full bg-brand-600 ring-2 ring-surface" />
          ) : (
            <span className="ml-auto min-w-[20px] rounded-full bg-brand-600 px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{badge > 99 ? '99+' : badge}</span>
          )
        ) : null}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* brand */}
      <div className={cx('flex h-16 shrink-0 items-center gap-2.5 px-4', rail && 'justify-center px-0')}>
        <Link href={homeFor(role)} className="flex min-w-0 items-center gap-2.5" aria-label="Home">
          <LogoMark size={30} />
          {!rail && (
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[14px] font-semibold tracking-[-0.015em]">Mentor Bridge</span>
              <span className="block truncate text-[11.5px] text-ink-500">{ROLE_LABEL[role]}</span>
            </span>
          )}
        </Link>
        {!rail && (
          <button className="btn-ghost ml-auto p-1.5 text-ink-400" onClick={onCollapse} aria-label={inDrawer ? 'Close menu' : 'Collapse sidebar'} title={inDrawer ? 'Close menu' : 'Collapse sidebar'}>
            {inDrawer ? <X size={17} /> : <ChevronsLeft size={17} />}
          </button>
        )}
      </div>

      {/* search */}
      <div className={cx('px-3', rail && 'px-2.5')}>
        <button
          onClick={openCommandPalette}
          className={cx('flex h-9 w-full items-center gap-2 rounded-lg border border-[color:var(--line-strong)] bg-surface px-2.5 text-[13px] text-ink-400 transition hover:border-ink-300 hover:text-ink-600', rail && 'justify-center px-0')}
          aria-label="Search pages and mentors"
          title={rail ? `Search (${shortcut})` : undefined}
        >
          <Search size={15} />
          {!rail && (
            <>
              <span className="flex-1 text-left">Search</span>
              <span className="kbd">{shortcut}</span>
            </>
          )}
        </button>
      </div>

      {/* sections */}
      <nav aria-label="Sections" className={cx('mt-4 flex-1 space-y-5 overflow-y-auto px-3 pb-4', rail && 'px-2.5')}>
        {NAV[role].map((g, gi) => (
          <div key={gi} className="space-y-0.5">
            {g.label && !rail && <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">{g.label}</p>}
            {g.label && rail && <div className="mx-auto my-2 h-px w-6 bg-[color:var(--line-strong)]" />}
            {g.items.map((n) => item(n))}
          </div>
        ))}
        <div className="space-y-0.5 border-t border-[color:var(--line)] pt-4">{item({ href: '/notifications', label: 'Notifications', icon: Bell }, unread)}</div>
      </nav>

      {/* account */}
      <div className={cx('shrink-0 border-t border-[color:var(--line)] p-3', rail && 'px-2.5')}>
        <AccountMenu name={name} email={email} avatarUrl={avatarUrl} role={role} rail={rail} onSignOut={onSignOut} active={activeHref === '/settings'} />
        {rail && !inDrawer && (
          <button className="btn-ghost mt-1 w-full p-2 text-ink-400" onClick={onCollapse} aria-label="Expand sidebar" title="Expand sidebar">
            <ChevronsLeft size={17} className="rotate-180" />
          </button>
        )}
      </div>
    </div>
  );
}

function AccountMenu({ name, email, avatarUrl, role, rail, active, onSignOut }: { name: string; email: string; avatarUrl?: string | null; role: Role; rail: boolean; active: boolean; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const path = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const row = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] text-ink-700 transition-colors hover:bg-ink-900/[0.05] hover:text-ink-900';
  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        onClick={() => setOpen((o) => !o)}
        className={cx('flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors hover:bg-ink-900/[0.05]', (open || active) && 'bg-ink-900/[0.05]', rail && 'justify-center')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={rail ? name : undefined}
      >
        <Avatar name={name} size="sm" src={avatarUrl} />
        {!rail && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium">{name}</span>
              <span className="block truncate text-[11.5px] text-ink-500">{ROLE_LABEL[role]}</span>
            </span>
            <ChevronsUpDown size={15} className="text-ink-400" />
          </>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Account"
            className={cx('absolute bottom-[calc(100%+8px)] z-50 w-60 rounded-xl border border-[color:var(--line)] bg-surface p-1.5 shadow-depth', rail ? 'left-0' : 'inset-x-0 w-auto')}
            initial={{ opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
          >
            <div className="px-2.5 py-2">
              <div className="truncate text-[13px] font-medium">{name}</div>
              <div className="truncate text-[12px] text-ink-500">{email}</div>
            </div>
            <div className="my-1 h-px bg-[color:var(--line)]" />
            <Link href="/settings" role="menuitem" className={row}>
              <Settings2 size={15} className="text-ink-400" /> Settings
            </Link>
            <button role="menuitem" className={row} onClick={toggle}>
              {theme === 'dark' ? <Sun size={15} className="text-ink-400" /> : <Moon size={15} className="text-ink-400" />}
              {theme === 'dark' ? 'Light appearance' : 'Dark appearance'}
            </button>
            <div className="my-1 h-px bg-[color:var(--line)]" />
            <button role="menuitem" className={cx(row, 'text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400')} onClick={onSignOut}>
              <LogOut size={15} /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
