import type { Config } from 'tailwindcss';

/** A colour backed by an "r g b" CSS variable, so opacity modifiers (`/60`) keep working. */
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

/**
 * San Francisco where the device has it (Apple platforms ship it as the system font), Inter
 * everywhere else. SF Pro itself can't be served as a web font: Apple's licence limits it to
 * Apple platforms. So Mac/iPhone/iPad visitors see SF Pro and everyone else sees Inter.
 */
const SANS = ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'var(--font-inter)', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'];

export default {
  content: ['./src/**/*.{ts,tsx}'],
  // `dark` class on <html>, set by lib/theme.tsx before first paint.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /**
         * Neutral scale (Apple greys). In light mode it runs light (50) → dark (950); in dark mode
         * the same names run dark → light (see globals.css). So `text-ink-900` is always
         * "primary text" and `bg-ink-50` always "page / subtle fill", whichever the theme.
         */
        ink: { 50: v('ink-50'), 100: v('ink-100'), 200: v('ink-200'), 300: v('ink-300'), 400: v('ink-400'), 500: v('ink-500'), 600: v('ink-600'), 700: v('ink-700'), 800: v('ink-800'), 900: v('ink-900'), 950: v('ink-950') },
        /** Cards, inputs, menus. */
        surface: v('surface'),
        /** App background behind cards. */
        canvas: v('canvas'),
        /** Always-dark backdrop for overlays (does not switch). */
        night: '#000000',
        /**
         * The accent: Mentor Bridge orange. 500 is the logo's orange; 600 (buttons, small text) is
         * deepened so white text on it, and it on white, both pass WCAG AA (4.5:1). This one scale is
         * the whole accent colour of the site; change it here to re-colour every link and button.
         */
        brand: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#cf4a06', 700: '#b23f08', 800: '#9a3412', 900: '#7c2d12' },
        /** Secondary accent for the odd gradient (rose, so orange → rose reads as one warm sweep). */
        iris: { 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48' },
        /** Success: accepted, paid, verified, open capacity. Kept apart from the accent on purpose. */
        ok: { 50: '#ecf9f0', 100: '#d3f2dd', 200: '#a8e3bb', 300: '#6fd08f', 400: '#34c759', 500: '#28b44c', 600: '#1f9a3f', 700: '#248a3d', 800: '#1d6e31', 900: '#175727' },
      },
      fontFamily: { sans: SANS, display: SANS, serif: SANS },
      letterSpacing: { tightest: '-0.045em' },
      boxShadow: {
        card: 'var(--shadow-card)',
        depth: 'var(--shadow-depth)',
        glow: '0 0 0 1px rgba(207,74,6,.25), 0 8px 28px -6px rgba(249,115,22,.35)',
        btn: '0 1px 2px rgba(0,0,0,.08)',
      },
      keyframes: {
        aurora: { '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' }, '33%': { transform: 'translate3d(6%,-8%,0) scale(1.12)' }, '66%': { transform: 'translate3d(-5%,6%,0) scale(.94)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulseRing: { '0%': { transform: 'scale(.9)', opacity: '.7' }, '100%': { transform: 'scale(1.9)', opacity: '0' } },
        gradientShift: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
      },
      animation: {
        aurora: 'aurora 18s ease-in-out infinite',
        'aurora-slow': 'aurora 26s ease-in-out infinite reverse',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        'pulse-ring': 'pulseRing 1.8s cubic-bezier(.2,.6,.4,1) infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
