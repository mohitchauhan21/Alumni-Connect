'use client';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/lib/theme';

type VantaEffect = { destroy: () => void };

/**
 * Vanta NET (github.com/tengbao/vanta): a slowly drifting web of connected nodes that leans toward
 * the pointer — mentors and students, linked. three.js and Vanta are only downloaded when this
 * scrolls into view, the WebGL scene is destroyed whenever it leaves the viewport (so it never
 * burns GPU off-screen), and it's rebuilt in the right colours when the theme changes.
 *
 * Reduced motion, or no WebGL: the element keeps its CSS gradient and nothing moves.
 */
export function VantaNet({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const dark = useTheme().theme === 'dark';

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let effect: VantaEffect | null = null;
    let loading = false;
    let visible = false;
    let cancelled = false;

    const start = async () => {
      if (effect || loading) return;
      loading = true;
      try {
        const [THREE, mod] = await Promise.all([import('three'), import('vanta/dist/vanta.net.min')]);
        if (cancelled || !visible) return;
        const NET = (mod as { default?: unknown }).default ?? mod;
        const small = window.innerWidth < 768;
        effect = (NET as (o: Record<string, unknown>) => VantaEffect)({
          el,
          THREE,
          mouseControls: true,
          touchControls: false,
          gyroControls: false,
          scale: 1,
          scaleMobile: 1,
          color: dark ? 0xfb923c : 0xcf4a06,
          backgroundColor: dark ? 0x000000 : 0xf5f5f7,
          points: small ? 7 : 11,
          maxDistance: small ? 18 : 21,
          spacing: small ? 19 : 17,
          showDots: true,
        });
      } catch {
        /* no WebGL: keep the static gradient */
      } finally {
        loading = false;
      }
    };
    const stop = () => {
      effect?.destroy();
      effect = null;
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) void start();
      else stop();
    });
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      stop();
    };
  }, [dark]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`bg-[radial-gradient(80%_60%_at_50%_30%,rgba(207,74,6,0.10),transparent_70%)] dark:bg-[radial-gradient(80%_60%_at_50%_30%,rgba(251,146,60,0.18),transparent_70%)] ${className}`}
    />
  );
}
