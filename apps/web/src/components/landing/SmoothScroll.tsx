'use client';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { useEffect } from 'react';

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth scrolling for the landing page (github.com/darkroomengineering/lenis), driven by
 * GSAP's ticker so ScrollTrigger animations stay in lockstep with the smoothed scroll position.
 * Mounted only on the landing page and torn down when you leave it. Skipped entirely for people
 * who ask for reduced motion, so their scrolling stays native.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // `anchors` makes "/#section" links glide there, clearing the 56px sticky header.
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.9, anchors: { offset: -56 }, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);
  return null;
}
