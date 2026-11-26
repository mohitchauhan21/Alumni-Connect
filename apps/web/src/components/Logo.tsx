/**
 * Brand mark — the Mentor Bridge "bridge": an arc over three pillars on an orange tile.
 *
 * Drawn on a 32-unit grid. src/app/icon.svg (the favicon) and src/app/opengraph-image.tsx use the
 * same geometry; keep them in sync.
 */
export const MARK = {
  arc: 'M6 22c3-7 7-10 10-10s7 3 10 10',
  pillars: 'M10 22v-4M16 22v-7M22 22v-4',
  tile: '#F97316',
  ink: '#18181b',
} as const;

type MarkProps = {
  size?: number;
  className?: string;
  /** `tile`: the mark on the orange tile (default). `glyph`: the bridge alone in currentColor. */
  variant?: 'tile' | 'glyph';
  /** Strokes draw themselves in a loop; used by the loading indicator. */
  animated?: boolean;
  /** Accessible name; omit when a visible wordmark sits next to it. */
  title?: string;
};

export function LogoMark({ size = 32, className = '', variant = 'tile', animated = false, title }: MarkProps) {
  const tile = variant === 'tile';
  const draw = animated ? { pathLength: 1, className: 'logo-draw' } : {};
  const stroke = tile ? MARK.ink : 'currentColor';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={`shrink-0 ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {tile && <rect width="32" height="32" rx="9" fill={MARK.tile} />}
      <g fill="none" stroke={stroke} strokeLinecap="round">
        <path d={MARK.arc} strokeWidth="2.6" {...draw} />
        <path d={MARK.pillars} strokeWidth="2.2" {...draw} style={animated ? { animationDelay: '.18s' } : undefined} />
      </g>
    </svg>
  );
}

/**
 * Mark + wordmark lockup. The wordmark follows the light/dark theme. `compact` drops the wordmark
 * below 380px, where the lockup shares a row with buttons.
 */
export function Logo({ size = 30, compact = false, className = '' }: { size?: number; compact?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span className={`whitespace-nowrap text-[15px] font-semibold tracking-[-0.02em] text-ink-900 ${compact ? 'max-[380px]:hidden' : ''}`}>Mentor Bridge</span>
    </span>
  );
}
