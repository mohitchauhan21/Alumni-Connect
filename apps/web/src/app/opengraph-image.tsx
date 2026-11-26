import { ImageResponse } from 'next/og';

/** The preview image shown when the site is shared (Open Graph / Twitter). */
export const alt = 'Mentor Bridge — mentoring that respects everyone’s time';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 80, background: '#f5f5f7', color: '#1d1d1f', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: '#F97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="72" height="72" viewBox="0 0 32 32">
              <path d="M6 22c3-7 7-10 10-10s7 3 10 10" stroke="#18181b" strokeWidth="2.6" fill="none" strokeLinecap="round" />
              <path d="M10 22v-4M16 22v-7M22 22v-4" stroke="#18181b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ fontSize: 36, fontWeight: 600, letterSpacing: '-0.02em' }}>Mentor Bridge</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 1.02 }}>Mentoring that respects</div>
          <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: '-0.045em', lineHeight: 1.02, color: '#cf4a06' }}>everyone’s time.</div>
          <div style={{ marginTop: 28, fontSize: 30, color: '#6e6e73' }}>Verified alumni mentorship for institutions — privately.</div>
        </div>
      </div>
    ),
    size,
  );
}
