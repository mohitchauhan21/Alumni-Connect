'use client';
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useRef } from 'react';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

/*
 * Text animations for the landing page, adapted from React Bits (github.com/DavidHDev/react-bits,
 * MIT — see components/reactbits/LICENSE.md): SplitText and ScrollReveal, rebuilt on GSAP's own
 * SplitText plugin and trimmed to what this page uses. Every effect sits inside a
 * `prefers-reduced-motion: no-preference` media query, so with reduced motion the text is simply there.
 */

const NO_REDUCE = '(prefers-reduced-motion: no-preference)';

type Tag = 'h1' | 'h2' | 'h3' | 'p' | 'span';

/**
 * Text that rises into place letter by letter (or word by word) from behind a mask — on load for
 * the hero, or when scrolled into view. It re-splits itself when line breaks change on resize.
 *
 * The element starts hidden (`.split-pending`) so the unsplit text never flashes; a CSS failsafe
 * shows it after 2.5 s regardless, so a script failure can never leave a heading invisible.
 */
export function SplitReveal({
  text,
  as: As = 'h2',
  by = 'chars',
  trigger = 'view',
  delay = 0,
  className = '',
  wordClassName,
}: {
  text: string;
  as?: Tag;
  by?: 'chars' | 'words';
  trigger?: 'view' | 'load';
  delay?: number;
  className?: string;
  /** Class put on every word, e.g. `text-gradient` (gradients can't span transformed children). */
  wordClassName?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      gsap.set(el, { visibility: 'visible' });
      const mm = gsap.matchMedia();
      mm.add(NO_REDUCE, () => {
        const split = SplitText.create(el, {
          type: by === 'chars' ? 'words,chars' : 'words',
          mask: 'words',
          wordsClass: wordClassName ? `split-word ${wordClassName}` : 'split-word',
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(by === 'chars' ? self.chars : self.words, {
              yPercent: 115,
              rotate: by === 'chars' ? 6 : 3,
              opacity: 0,
              duration: by === 'chars' ? 1.1 : 1.2,
              ease: 'expo.out',
              stagger: by === 'chars' ? 0.022 : 0.07,
              delay,
              scrollTrigger: trigger === 'view' ? { trigger: el, start: 'top 88%', once: true } : undefined,
            }),
        });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: ref, dependencies: [text] },
  );

  return (
    <As ref={ref as never} className={`split-pending ${className}`}>
      {text}
    </As>
  );
}

/**
 * A statement whose words light up one after another as you scroll through it — the reading pace
 * follows the scroll. Words start dim and slightly blurred and settle as they're "read".
 */
export function ScrollRevealText({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(NO_REDUCE, () => {
        gsap.fromTo(
          '.sr-word',
          { opacity: 0.14, filter: 'blur(6px)', y: 6 },
          {
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            ease: 'none',
            stagger: 0.05,
            scrollTrigger: { trigger: ref.current, start: 'top 82%', end: 'bottom 45%', scrub: 0.6 },
          },
        );
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <p ref={ref} className={className}>
      {text.split(' ').map((w, i) => (
        <span key={i} className="sr-word inline-block whitespace-pre">
          {w}{' '}
        </span>
      ))}
    </p>
  );
}
