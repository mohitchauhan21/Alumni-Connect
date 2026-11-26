'use client';
import { useGSAP } from '@gsap/react';
import { AnimatePresence, motion } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, Building2, Check, ChevronDown, ChevronRight, Clock, Download, EyeOff, GraduationCap, KeyRound, Lock, ShieldCheck, Sparkles, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { LogoMark } from '@/components/Logo';
import { Magnet, SpotlightCard, VelocityMarquee } from '@/components/landing/interactive';
import { SmoothScroll } from '@/components/landing/SmoothScroll';
import { ScrollRevealText, SplitReveal } from '@/components/landing/text';
import { VantaNet } from '@/components/landing/VantaNet';
import { CapacityVisual, MatchVisual, ProductPreview, ReportVisual } from '@/components/landing/visuals';
import { CountUp, Reveal } from '@/components/motion';
import { SiteFooter } from '@/components/SiteFooter';
import TearTicket from '@/components/ui/tear-ticket';
import { cx } from '@/components/ui';
import { useTheme } from '@/lib/theme';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/* Static marketing copy only — the public page never calls a data endpoint. Product visuals are
   illustrative (labelled as such) and every claim is a property of how the platform works.

   Motion: Lenis smooth scroll drives GSAP ScrollTrigger; the hero sits on a live Vanta NET; headings
   rise in with GSAP SplitText; React Bits–style marquee, scroll-reveal text, spotlight cards and
   magnetic buttons. Everything falls back to still, fully readable content under reduced motion. */

const EASE = [0.22, 1, 0.36, 1] as const;
const NO_REDUCE = '(prefers-reduced-motion: no-preference)';

const AUDIENCES = [
  {
    icon: GraduationCap,
    label: 'Students',
    title: 'A mentor who fits — and says yes.',
    points: ['Ranked matches, with the reasons spelled out', 'Only mentors with open capacity', 'Sessions, goals and action items in one place'],
    cta: { href: '/register?role=student', label: 'Join as a student' },
  },
  {
    icon: Users,
    label: 'Alumni',
    title: 'Give back on your terms.',
    points: ['Set how many mentees and requests you take', 'Decline in one click; the student is redirected kindly', 'Your email and phone are never shown'],
    cta: { href: '/register?role=alumnus', label: 'Join as a mentor' },
  },
  {
    icon: Building2,
    label: 'Institutions',
    title: 'Engagement you can see and report.',
    points: ['Verification against your alumni register, fully audited', 'Weekly health checks with automatic nudges', 'Participation and outcome reporting, no personal data'],
    cta: { href: '/contact', label: 'Talk to us' },
  },
];

const PRINCIPLES = [
  { icon: ShieldCheck, title: 'Verified against records', body: 'Every mentor is checked against the institution’s alumni register before students can see them.' },
  { icon: Clock, title: 'Seven days to reply', body: 'Requests that aren’t answered expire, and the student is pointed to other strong matches.' },
  { icon: Users, title: 'Capacity mentors set', body: 'Mentors choose how many mentees and open requests they take. Nobody gets buried.' },
  { icon: Lock, title: 'Contact details never shown', body: 'Email and phone stay private, and contact details typed into messages are hidden before they’re saved.' },
  { icon: Download, title: 'Your data, your rights', body: 'Download everything the platform holds about you, or delete your account, from Settings — in line with India’s DPDP Act.' },
  { icon: KeyRound, title: 'Secure by default', body: 'Two-factor sign-in for staff, encrypted keys at rest, and an audit trail for every verification decision.' },
];

const STATS: { value: number; suffix: string; label: string }[] = [
  { value: 100, suffix: '%', label: 'of mentors checked against the alumni register' },
  { value: 7, suffix: ' days', label: 'for a mentor to answer before a request moves on' },
  { value: 0, suffix: '', label: 'email addresses or phone numbers shown to either side' },
  { value: 1, suffix: ' click', label: 'to decline — and the student is redirected kindly' },
];

const STEPS = [
  { title: 'Get verified', body: 'Alumni confirm their identity against the institution’s records. Students describe their goals.' },
  { title: 'Get matched', body: 'Students see mentors ranked by fit — with reasons — and only those with open capacity.' },
  { title: 'Grow together', body: 'Book sessions, set goals, track actions and share feedback. Gentle nudges keep it alive.' },
];

const FAQ = [
  ['Is it free for students?', 'Requesting a mentor is free. Some mentors set a session fee; if they do, you see it on their profile before you book, and you’re refunded in full if they cancel.'],
  ['How are mentors verified?', 'Alumni confirm their identity against the institution’s records — roll number, programme and graduation year — and an Alumni Relations officer reviews anything that doesn’t match exactly. Every decision is logged.'],
  ['Can mentors see my phone number or email?', 'No. Neither side sees the other’s email or phone. You talk through the platform, and sessions get their own video link.'],
  ['What happens if a mentor doesn’t reply?', 'Mentors have seven days. After that the request expires, your slot is freed, and we suggest other mentors with open capacity.'],
  ['How does an institution get started?', 'Get in touch. We set up your programme, import your alumni register for verification, and give your Alumni Relations team their dashboard.'],
  ['Can I delete my account?', 'Yes, at any time, from Settings → Your data. You can download a copy of everything first. Records the law requires, like payment receipts, are kept without your name.'],
];

export default function Landing() {
  const page = useRef<HTMLDivElement>(null);

  // Scroll-linked motion that spans sections: hero parallax, the product preview standing up,
  // floating chips drifting at their own speeds, and the "how it works" line drawing itself.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(NO_REDUCE, () => {
        gsap.to('.hero-content', { yPercent: -18, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
        gsap.fromTo(
          '.preview-frame',
          { rotateX: 26, scale: 0.86, y: 40 },
          { rotateX: 0, scale: 1, y: 0, ease: 'none', scrollTrigger: { trigger: '.preview', start: 'top bottom', end: 'center 55%', scrub: 0.5 } },
        );
        gsap.utils.toArray<HTMLElement>('[data-speed]').forEach((el) => {
          gsap.to(el, { yPercent: -Number(el.dataset.speed) * 60, ease: 'none', scrollTrigger: { trigger: '.preview', start: 'top bottom', end: 'bottom top', scrub: true } });
        });
        gsap.fromTo('.steps-line', { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.steps', start: 'top 75%', end: 'bottom 60%', scrub: 0.6 } });
        gsap.utils.toArray<HTMLElement>('.step-dot').forEach((el, i) => {
          ScrollTrigger.create({ trigger: '.steps', start: `top+=${i * 18}% 72%`, onEnter: () => el.classList.add('is-on'), onLeaveBack: () => el.classList.remove('is-on') });
        });
        gsap.from('.stat', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.stats', start: 'top 80%', once: true } });
      });
      return () => mm.revert();
    },
    { scope: page },
  );

  return (
    <div ref={page} className="overflow-x-clip bg-canvas text-ink-900">
      <SmoothScroll />

      {/* ───────────────────────────── hero */}
      <section className="hero relative isolate overflow-hidden">
        <VantaNet className="absolute inset-0 -z-20" />
        {/* a soft pool of page colour behind the words keeps them readable over the net */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [background:radial-gradient(ellipse_62%_48%_at_50%_46%,rgb(var(--canvas)/0.88),rgb(var(--canvas)/0.35)_60%,transparent_80%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-b from-transparent to-canvas" />

        <div className="hero-content mx-auto flex min-h-[calc(100svh-56px)] max-w-6xl flex-col items-center justify-center px-5 pb-24 pt-16 text-center sm:px-6">
          <motion.div initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.8, ease: EASE }}>
            <Link href="/#product" className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line-strong)] bg-surface/70 py-1 pl-1 pr-3 text-[13px] text-ink-600 backdrop-blur-xl transition hover:border-brand-600/40">
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">New</span>
              Mentorship, verified by your institution <ChevronRight size={14} className="text-ink-400" />
            </Link>
          </motion.div>

          <h1 className="mx-auto mt-8 max-w-5xl text-[46px] font-semibold leading-[1.02] tracking-[-0.05em] sm:text-[84px]">
            <SplitReveal as="span" trigger="load" delay={0.15} text="Mentoring that respects" className="block" />
            <SplitReveal as="span" by="words" trigger="load" delay={0.6} text="everyone’s time." className="block" wordClassName="text-gradient" />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1, delay: 0.9, ease: EASE }}
            className="mx-auto mt-7 max-w-2xl text-[18px] leading-[1.5] text-ink-500 sm:text-[21px]"
          >
            The alumni mentorship platform for institutions. Students meet verified alumni with the right expertise and the capacity to help — and no one’s contact details ever change hands.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 1.1, ease: EASE }} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Magnet>
              <Link href="/register?role=student" className="btn-primary px-7 py-3.5 text-[15px] shadow-glow">
                Get started — it’s free <ArrowRight size={16} />
              </Link>
            </Magnet>
            <Magnet>
              <Link href="/contact" className="btn-secondary px-7 py-3.5 text-[15px] backdrop-blur-xl">
                For institutions
              </Link>
            </Magnet>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 1.3 }} className="mt-5 text-[13px] text-ink-400">
            Alumni? <Link href="/register?role=alumnus" className="link">Become a mentor</Link>
          </motion.p>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }} aria-hidden className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 sm:block">
            <div className="flex h-10 w-6 justify-center rounded-full border border-[color:var(--line-strong)] pt-2">
              <span className="scroll-cue h-2 w-1 rounded-full bg-ink-400" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ───────────────────────────── product preview: stands upright as it scrolls in */}
      <section className="preview relative mx-auto -mt-10 max-w-6xl px-5 sm:px-6">
        <div className="relative mx-auto max-w-5xl [perspective:1800px]">
          <div aria-hidden className="pointer-events-none absolute -inset-x-10 -top-10 bottom-10 -z-10 rounded-[48px] bg-[radial-gradient(50%_50%_at_50%_50%,rgba(207,74,6,0.18),transparent_70%)] blur-2xl dark:bg-[radial-gradient(50%_50%_at_50%_50%,rgba(251,146,60,0.22),transparent_70%)]" />
          <div className="preview-frame origin-top [transform-style:preserve-3d]">
            <ProductPreview />
          </div>
          <FloatingChip speed={1.4} className="left-2 top-[18%] lg:-left-10" icon={<ShieldCheck size={15} className="text-ok-600" />} text="Verified against records" />
          <FloatingChip speed={2.2} className="right-2 top-[44%] lg:-right-12" icon={<Sparkles size={15} className="text-brand-600" />} text="93 match · shares 4 interests" />
          <FloatingChip speed={0.8} className="bottom-[12%] left-[8%] hidden sm:flex" icon={<EyeOff size={15} className="text-iris-500" />} text="Contact details hidden" />
        </div>
        <p className="mt-5 text-center text-[11.5px] text-ink-400">Illustrative preview of the student app</p>
      </section>

      {/* ───────────────────────────── velocity marquee */}
      <section aria-label="What Mentor Bridge stands for" className="mt-24 space-y-2 py-6 text-[44px] font-semibold leading-none tracking-[-0.045em] sm:mt-32 sm:text-[80px]">
        <VelocityMarquee items={['Verified alumni', 'Explained matches', 'Protected time', 'Private by default']} />
        <VelocityMarquee reverse className="text-outline" items={['Real outcomes', 'Kind declines', 'Fair capacity', 'Every session counted']} />
      </section>

      {/* ───────────────────────────── statement */}
      <section className="mx-auto max-w-5xl px-5 py-28 sm:px-6 sm:py-40">
        <ScrollRevealText
          className="text-[30px] font-semibold leading-[1.18] tracking-[-0.035em] sm:text-[52px]"
          text="Every mentor is verified. Every match explains itself. Every request gets an answer. And nobody’s phone number ever changes hands."
        />
      </section>

      {/* ───────────────────────────── features: sticky story */}
      <section id="product" className="scroll-mt-14">
        <div className="mx-auto max-w-6xl px-5 text-center sm:px-6">
          <SectionTitle kicker="The platform" title="Everything a mentorship needs." muted="Nothing that burns mentors out." />
        </div>
        <FeatureStory />
      </section>

      {/* ───────────────────────────── numbers */}
      <section className="stats border-y border-[color:var(--line)] bg-surface">
        <div className="mx-auto grid max-w-6xl gap-px px-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="stat py-12 sm:px-6 sm:py-16">
              <div className="text-[56px] font-semibold leading-none tracking-[-0.05em] sm:text-[64px]">
                <CountUp value={s.value} />
                <span className="text-ink-400">{s.suffix}</span>
              </div>
              <p className="mt-3 max-w-[16rem] text-[15px] leading-snug text-ink-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────────────────── audiences */}
      <section id="roles" className="scroll-mt-14">
        <div className="mx-auto max-w-6xl px-5 py-28 sm:px-6 sm:py-36">
          <div className="text-center">
            <SectionTitle kicker="Who it’s for" title="One programme." muted="Three very different needs." />
          </div>
          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {AUDIENCES.map((a, i) => (
              <Reveal key={a.label} delay={0.1 * i} y={40} className="h-full">
                <SpotlightCard className="flex h-full flex-col p-8">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600/10 text-brand-600 transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110 dark:text-[#fb923c]">
                    <a.icon size={21} />
                  </span>
                  <p className="mt-7 text-[13px] font-semibold uppercase tracking-[0.08em] text-ink-400">{a.label}</p>
                  <h3 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.03em]">{a.title}</h3>
                  <ul className="mt-6 flex-1 space-y-3.5">
                    {a.points.map((p) => (
                      <li key={p} className="flex gap-2.5 text-[15px] leading-snug text-ink-600">
                        <Check size={17} className="mt-0.5 shrink-0 text-brand-600" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  <Link href={a.cta.href} className="link mt-8 inline-flex items-center gap-1 text-[15px]">
                    {a.cta.label} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────── principles */}
      <section className="relative overflow-hidden bg-surface">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-600/10 blur-3xl motion-safe:animate-aurora" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-40 h-[460px] w-[460px] rounded-full bg-iris-500/10 blur-3xl motion-safe:animate-aurora-slow" />
        <div className="relative mx-auto max-w-6xl px-5 py-28 sm:px-6 sm:py-36">
          <div className="max-w-2xl">
            <SectionTitle kicker="Trust" title="Built on principles," muted="not promises." align="left" />
            <Reveal delay={0.2}>
              <p className="mt-5 text-[17px] leading-relaxed text-ink-500">These aren’t settings someone can forget to switch on. They’re how the platform works.</p>
            </Reveal>
          </div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={0.06 * i} y={30} className="h-full">
                <SpotlightCard className="h-full bg-canvas/60 p-7 backdrop-blur">
                  <p.icon size={22} className="text-brand-600 transition-transform duration-500 group-hover:scale-110 dark:text-[#fb923c]" />
                  <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.015em]">{p.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-500">{p.body}</p>
                </SpotlightCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────── how it works */}
      <section id="how" className="scroll-mt-14">
        <div className="mx-auto max-w-6xl px-5 py-28 sm:px-6 sm:py-36">
          <div className="text-center">
            <SectionTitle kicker="How it works" title="From hello to hired." muted="In three steps." />
          </div>
          <div className="steps relative mt-20 grid gap-14 md:grid-cols-3 md:gap-8">
            <div aria-hidden className="absolute left-[16.5%] right-[16.5%] top-7 hidden h-px bg-[color:var(--line-strong)] md:block">
              <div className="steps-line h-full origin-left bg-gradient-to-r from-brand-600 to-iris-500" />
            </div>
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={0.12 * i} className="relative text-center">
                <div className="step-dot relative mx-auto grid h-14 w-14 place-items-center rounded-full border border-[color:var(--line-strong)] bg-canvas text-[18px] font-semibold transition-all duration-500 [&.is-on]:border-brand-600 [&.is-on]:bg-brand-600 [&.is-on]:text-white [&.is-on]:shadow-glow">
                  {i + 1}
                </div>
                <h3 className="mt-6 text-[22px] font-semibold tracking-[-0.025em]">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-[16px] leading-relaxed text-ink-500">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────────────── FAQ */}
      <section id="faq" className="scroll-mt-14 border-t border-[color:var(--line)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-28 sm:px-6 sm:py-36 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <SplitReveal as="h2" by="words" text="Questions, answered." className="text-[36px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[48px]" />
            <Reveal delay={0.2}>
              <p className="mt-4 text-[17px] text-ink-500">
                Something else? <Link href="/contact" className="link">Get in touch</Link>.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <div className="divide-y divide-[color:var(--line-strong)] border-y border-[color:var(--line-strong)]">
              {FAQ.map(([q, a]) => (
                <FaqItem key={q} q={q} a={a} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────────────────── CTA */}
      <section className="px-5 pb-28 sm:px-6 sm:pb-36">
        <Reveal y={50}>
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] bg-[#0b0b0d] px-6 py-24 text-center text-[#f5f5f7] sm:py-32">
            <div aria-hidden className="pointer-events-none absolute -left-20 -top-32 h-[420px] w-[420px] rounded-full bg-[#fb923c]/35 blur-[100px] motion-safe:animate-aurora" />
            <div aria-hidden className="pointer-events-none absolute -bottom-40 right-0 h-[440px] w-[440px] rounded-full bg-[#f43f5e]/35 blur-[110px] motion-safe:animate-aurora-slow" />
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#F97316]/15 blur-[90px]" />
            <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_75%)]" />
            <div className="relative">
              <LogoMark size={60} className="mx-auto motion-safe:animate-float" />
              <SplitReveal as="h2" text="Give an hour. Change a career." className="mx-auto mt-9 max-w-4xl text-[40px] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[68px]" />
              <p className="mx-auto mt-5 max-w-xl text-[18px] text-[#a1a1a6]">Join as a student to find guidance, or as an alumnus to give back — on your terms.</p>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Magnet>
                  <Link href="/register" className="btn bg-white px-7 py-3.5 text-[15px] text-[#1d1d1f] hover:bg-white/90">
                    Create your account <ArrowRight size={16} />
                  </Link>
                </Magnet>
                <Magnet>
                  <Link href="/contact" className="btn border border-white/20 px-7 py-3.5 text-[15px] text-white/85 hover:border-white/40 hover:text-white">
                    Talk to us
                  </Link>
                </Magnet>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── pieces */

function SectionTitle({ kicker, title, muted, align = 'center' }: { kicker: string; title: string; muted?: string; align?: 'center' | 'left' }) {
  return (
    <>
      <Reveal>
        <p className={cx('inline-flex items-center gap-2 text-[14px] font-semibold text-brand-700 dark:text-[#fb923c]', align === 'center' && 'justify-center')}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {kicker}
        </p>
      </Reveal>
      <h2 className={cx('mt-4 text-[38px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[60px]', align === 'center' && 'mx-auto max-w-4xl')}>
        <SplitReveal as="span" by="words" text={title} className="block" />
        {muted && <SplitReveal as="span" by="words" delay={0.15} text={muted} className="block text-ink-400" />}
      </h2>
    </>
  );
}

function FloatingChip({ speed, className, icon, text }: { speed: number; className: string; icon: React.ReactNode; text: string }) {
  return (
    <div data-speed={speed} aria-hidden className={cx('absolute z-10 flex items-center gap-2 rounded-2xl border border-[color:var(--line-strong)] bg-surface/80 px-3.5 py-2.5 text-[12.5px] font-medium shadow-depth backdrop-blur-xl sm:text-[13px]', className)}>
      {icon}
      {text}
    </div>
  );
}

const CHAPTERS = [
  {
    kicker: 'Matching',
    title: 'Matches that explain themselves.',
    body: 'Students see verified alumni ranked by fit — expertise, target role, industry and the help they need — and every suggestion says why. Only mentors with room to take someone on are shown, so requests get answered.',
  },
  {
    kicker: 'Capacity',
    title: 'Mentor time, protected by design.',
    body: 'Mentors set hard limits on mentees and open requests. Requests expire after seven days, and students are throttled so no one is flooded. Saying no takes one click — and the student is kindly redirected.',
  },
  {
    kicker: 'Sessions',
    title: 'Every session, one tap away.',
    body: 'Propose times, confirm, and join by video. Goals and action items live alongside the conversation, and both sides leave feedback after each session. Booked sessions come with a pass — try tearing it.',
  },
  {
    kicker: 'Reporting',
    title: 'Outcomes your institution can report.',
    body: 'Alumni Relations sees participation, session completion, mentor load and placement correlation at a glance, with weekly health checks that nudge stalled mentorships back to life. Reports never include anyone’s personal data.',
  },
];

/**
 * Four chapters told while you scroll: on wide screens the visual stays pinned beside the text and
 * cross-fades to whichever chapter is in the middle of the screen, with a progress rail. On phones
 * each chapter simply shows its own visual under the text.
 */
function FeatureStory() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  // The chapter crossing the middle of the screen is the active one. ScrollTrigger (rather than an
  // IntersectionObserver) so fast jumps and anchor links still land on the right chapter.
  useEffect(() => {
    const triggers = refs.current.map((el, i) =>
      ScrollTrigger.create({ trigger: el, start: 'top center', end: 'bottom center', onToggle: (self) => self.isActive && setActive(i) }),
    );
    return () => triggers.forEach((t) => t.kill());
  }, []);

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-24 pt-10 sm:px-6 lg:grid-cols-2 lg:gap-20 lg:pb-32">
      <div>
        {CHAPTERS.map((c, i) => (
          <div key={c.kicker} ref={(el) => void (refs.current[i] = el)} data-i={i} className="flex flex-col justify-center py-14 lg:min-h-[78vh] lg:py-0">
            <div className={cx('transition-opacity duration-500', active === i ? 'lg:opacity-100' : 'lg:opacity-30')}>
              <p className="flex items-center gap-3 text-[14px] font-semibold text-brand-700 dark:text-[#fb923c]">
                <span className="tabular-nums text-ink-400">0{i + 1}</span>
                <span className="h-px w-8 bg-current opacity-40" />
                {c.kicker}
              </p>
              <h3 className="mt-4 text-[32px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[44px]">{c.title}</h3>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-500">{c.body}</p>
            </div>
            <div className="mt-10 lg:hidden">
              <ChapterVisual i={i} />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-[calc(50vh-260px)] flex h-[520px] items-center">
          <div className="absolute -left-10 top-1/2 flex -translate-y-1/2 flex-col gap-2" aria-hidden>
            {CHAPTERS.map((c, i) => (
              <span key={c.kicker} className={cx('w-1 rounded-full transition-all duration-500', active === i ? 'h-10 bg-brand-600' : 'h-4 bg-ink-900/15')} />
            ))}
          </div>
          <div className="relative w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 30, scale: 0.96, filter: 'blur(8px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -30, scale: 0.98, filter: 'blur(8px)' }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <ChapterVisual i={active} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChapterVisual({ i }: { i: number }) {
  if (i === 0) return <MatchVisual />;
  if (i === 1) return <CapacityVisual />;
  if (i === 2) return <SessionPassVisual />;
  return <ReportVisual />;
}

function SessionPassVisual() {
  const dark = useTheme().theme === 'dark';
  const [torn, setTorn] = useState(false);
  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-[460px] drop-shadow-[0_30px_50px_rgba(0,0,0,0.14)] dark:drop-shadow-[0_30px_50px_rgba(0,0,0,0.6)]">
        <TearTicket
          width={460}
          height={224}
          stubSize={140}
          radius={20}
          rotate={-3}
          background={dark ? '#1c1c1e' : '#ffffff'}
          color={dark ? '#f5f5f7' : '#1d1d1f'}
          ariaLabel="Tear the stub to join the session"
          onTear={() => setTorn(true)}
          stub={
            <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-center">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] opacity-50">Admit one</span>
              <span className="text-[21px] font-semibold tracking-[-0.03em]">Join</span>
              <span className="mt-2 text-[11px] opacity-50">Pull to tear ›</span>
            </div>
          }
        >
          <div className="flex h-full flex-col justify-between p-6 text-left">
            <div>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand-600 dark:text-[#fb923c]">Session pass</span>
              <p className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.03em]">Mock interview</p>
              <p className="mt-1 text-[13px] opacity-60">with your mentor · 45 min</p>
            </div>
            <div className="flex gap-6 text-[12px]">
              <div>
                <div className="opacity-45">When</div>
                <div className="mt-0.5 font-semibold">Thu · 6:00 pm</div>
              </div>
              <div>
                <div className="opacity-45">Where</div>
                <div className="mt-0.5 font-semibold">Video call</div>
              </div>
            </div>
          </div>
        </TearTicket>
      </div>
      <p className="mt-5 h-5 text-[13px] text-ink-500" aria-live="polite">
        {torn ? 'That’s it — you’re in.' : 'Pull the stub to tear it.'}
      </p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="group flex w-full items-center justify-between gap-4 py-6 text-left text-[17px] font-medium tracking-[-0.015em] transition-colors hover:text-brand-700 dark:hover:text-[#fb923c]" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {q}
        <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink-900/[0.05] transition-all duration-300 group-hover:bg-ink-900/[0.09]', open && 'rotate-180')}>
          <ChevronDown size={16} className="text-ink-500" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease: EASE }} className="overflow-hidden">
            <p className="pb-6 pr-10 text-[15.5px] leading-relaxed text-ink-500">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
