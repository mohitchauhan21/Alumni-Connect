import {
  BarChart3,
  Bell,
  BookUser,
  CalendarClock,
  ClipboardCheck,
  Compass,
  Database,
  Gauge,
  HeartPulse,
  Inbox,
  IndianRupee,
  LayoutDashboard,
  Lock,
  ScrollText,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from './types';

export type NavItem = { href: string; label: string; icon: LucideIcon; keywords?: string };
export type NavGroup = { label?: string; items: NavItem[] };

/**
 * The app's navigation, one place per kind of link (no duplicates on screen):
 * - NAV: each role's sections, shown in the glass sidebar (components/Shell.tsx).
 * - ACCOUNT_NAV: account pages. Notifications sits in the sidebar with its unread badge, Settings
 *   is the account row at the foot of the sidebar; all three are also in search (Ctrl/Cmd K).
 * - SITE_NAV: the public navbar (components/SiteHeader.tsx).
 */
export const NAV: Record<Role, NavGroup[]> = {
  student: [
    {
      items: [
        { href: '/student', label: 'Home', icon: LayoutDashboard },
        { href: '/mentors', label: 'Find a mentor', icon: Compass, keywords: 'search match discover alumni' },
        { href: '/mentorships', label: 'Mentorships', icon: CalendarClock, keywords: 'sessions goals messages' },
        { href: '/student/profile', label: 'Career profile', icon: UserRound, keywords: 'goals interests roles' },
        { href: '/payments', label: 'Payments', icon: Wallet, keywords: 'cards wallet receipts billing upi pay' },
      ],
    },
  ],
  alumnus: [
    {
      items: [
        { href: '/mentor', label: 'Requests', icon: Inbox, keywords: 'inbox accept decline dashboard' },
        { href: '/mentorships', label: 'Mentees', icon: Users, keywords: 'sessions goals messages' },
        { href: '/mentor/availability', label: 'Capacity', icon: Gauge, keywords: 'availability pause limit slots' },
        { href: '/mentor/profile', label: 'Profile', icon: ShieldCheck, keywords: 'verification expertise bio fee' },
        { href: '/payments', label: 'Earnings', icon: IndianRupee, keywords: 'payments fee payouts money' },
      ],
    },
  ],
  aro: [
    { items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboard }] },
    {
      label: 'Programme',
      items: [
        { href: '/admin/verification', label: 'Verification', icon: ClipboardCheck, keywords: 'queue approve alumni records' },
        { href: '/admin/capacity', label: 'Mentor capacity', icon: Gauge, keywords: 'overload utilisation' },
        { href: '/admin/engagement', label: 'Engagement', icon: HeartPulse, keywords: 'health lapsed nudge' },
        { href: '/admin/mentors', label: 'Effectiveness', icon: Trophy, keywords: 'ranking rating' },
        { href: '/payments', label: 'Payments', icon: Wallet, keywords: 'refunds receipts money' },
      ],
    },
    {
      label: 'Insights',
      items: [{ href: '/analytics', label: 'Programme report', icon: BarChart3, keywords: 'analytics placement csv' }],
    },
    {
      label: 'Data',
      items: [
        { href: '/admin/records', label: 'Institution records', icon: Database, keywords: 'erp csv import' },
        { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
      ],
    },
  ],
  admin: [
    { items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboard }] },
    {
      label: 'Programme',
      items: [
        { href: '/admin/verification', label: 'Verification', icon: ClipboardCheck, keywords: 'queue approve alumni' },
        { href: '/admin/capacity', label: 'Mentor capacity', icon: Gauge },
        { href: '/admin/engagement', label: 'Engagement', icon: HeartPulse, keywords: 'health lapsed nudge' },
        { href: '/admin/mentors', label: 'Effectiveness', icon: Trophy },
        { href: '/payments', label: 'Payments', icon: Wallet, keywords: 'refunds receipts money revenue' },
      ],
    },
    { label: 'Insights', items: [{ href: '/analytics', label: 'Programme report', icon: BarChart3 }] },
    {
      label: 'System',
      items: [
        { href: '/admin/settings', label: 'Programme settings', icon: SlidersHorizontal, keywords: 'weights throttle expiry' },
        { href: '/admin/users', label: 'Users', icon: BookUser },
        { href: '/admin/records', label: 'Institution records', icon: Database },
        { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
      ],
    },
  ],
  placement: [{ items: [{ href: '/analytics', label: 'Programme & placement', icon: BarChart3 }] }],
};

export const ACCOUNT_NAV: NavItem[] = [
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/settings', label: 'Settings', icon: Settings2, keywords: 'calendar google outlook notifications account' },
  { href: '/privacy', label: 'Privacy statement', icon: Lock },
];

export const ROLE_LABEL: Record<Role, string> = { student: 'Student', alumnus: 'Alumni mentor', aro: 'Alumni Relations', placement: 'Placement Office', admin: 'Administrator' };

export const flatNav = (role: Role) => NAV[role].flatMap((g) => g.items);

export type SiteLink = { href: string; label: string };
/** Public navbar links. Anchors point at the landing page sections, so they work from any page. */
export const SITE_NAV: SiteLink[] = [
  { href: '/#product', label: 'Product' },
  { href: '/#roles', label: 'Who it’s for' },
  { href: '/#how', label: 'How it works' },
];
