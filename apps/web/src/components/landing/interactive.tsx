'use client';
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, useVelocity } from 'framer-motion';
import { gsap } from 'gsap';
import { useEffect, useRef } from 'react';

/*
 * Pointer and scroll interactions for the landing page, adapted from React Bits
 * (github.com/DavidHDev/react-bits, MIT — see components/reactbits/LICENSE.md): ScrollVelocity,
 * SpotlightCard and Magnet, trimmed to what this page uses and fitted to the site's tokens.
 */

const wrap = (min: number, max: number, v: number) => {
  const range = max - min;
  return ((((v - min) % range) + range) % range) + min;
};

/**
 * A band of text that drifts sideways and speeds up (and flips direction) with your scroll.
 * Four copies wrap seamlessly: moving by 25% of the strip equals exactly one copy.
 */
export function VelocityMarquee({ items, speed = 2.2, reverse = false, className = '' }: { items: string[]; speed?: number; reverse?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  const base = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 });
  const boost = useTransform(velocity, [0, 1000], [0, 4], { clamp: false });
  const x = useTransform(base, (v) => `${wrap(-25, 0, v)}%`);
  const dir = useRef(reverse ? 1 : -1);

  useAnimationFrame((_, delta) => {
    if (reduce) return;
    const b = boost.get();
    if (b < 0) dir.current = reverse ? -1 : 1;
    else if (b > 0) dir.current = reverse ? 1 : -1;
    const step = dir.current * speed * (delta / 1000);
    base.set(base.get() + step + step * Math.abs(b));
  });

  const run = items.flatMap((t) => [t, '✦']);
  return (
    <div className={`overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)] ${className}`} aria-label={items.join(', ')} role="img">
      <motion.div className="flex w-max whitespace-nowrap" style={{ x }} aria-hidden>
        {[0, 1, 2, 3].map((copy) => (
          <span key={copy} className="flex shrink-0 items-center">
            {run.map((t, i) => (
              <span key={i} className={t === '✦' ? 'px-6 text-[0.5em] text-brand-600 dark:text-[#fb923c] sm:px-10' : ''}>
                {t}
              </span>
            ))}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/**
 * A card lit by a soft spotlight that follows the pointer, with a matching glow on its edge.
 * Pure CSS variables — no re-renders while the pointer moves.
 */
export function SpotlightCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--sx', `${e.clientX - r.left}px`);
    el.style.setProperty('--sy', `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onPointerMove={move} className={`spotlight-card group relative isolate overflow-hidden rounded-[28px] border border-[color:var(--line)] bg-surface shadow-card ${className}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 [background:radial-gradient(420px_circle_at_var(--sx,50%)_var(--sy,0%),rgba(207,74,6,0.10),transparent_65%)] group-hover:opacity-100 dark:[background:radial-gradient(420px_circle_at_var(--sx,50%)_var(--sy,0%),rgba(251,146,60,0.16),transparent_65%)]" />
      <div aria-hidden className="spotlight-edge pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      {children}
    </div>
  );
}

/**
 * Pulls its child gently toward the pointer when it comes within `padding` px, then springs back.
 * Fine pointers only — on touch screens it stays put.
 */
export function Magnet({ children, padding = 70, strength = 4, className = '' }: { children: React.ReactNode; padding?: number; strength?: number; className?: string }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    if (!window.matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return;
    const toX = gsap.quickTo(i, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    const toY = gsap.quickTo(i, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.45)' });
    const onMove = (e: PointerEvent) => {
      const r = o.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const near = Math.abs(e.clientX - cx) < r.width / 2 + padding && Math.abs(e.clientY - cy) < r.height / 2 + padding;
      toX(near ? (e.clientX - cx) / strength : 0);
      toY(near ? (e.clientY - cy) / strength : 0);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [padding, strength]);

  return (
    <div ref={outer} className={`inline-block ${className}`}>
      <div ref={inner} className="will-change-transform">
        {children}
      </div>
    </div>
  );
}
