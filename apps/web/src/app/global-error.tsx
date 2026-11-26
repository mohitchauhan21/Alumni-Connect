'use client';

/** Last-resort error screen when the root layout itself fails. Plain styles: the CSS may not have loaded. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background: '#f5f5f7', color: '#1d1d1f' }}>
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', margin: 0 }}>Something went wrong.</h1>
          <p style={{ color: '#6e6e73', marginTop: 12 }}>Please reload the page. If it keeps happening, let us know.</p>
          <button onClick={reset} style={{ marginTop: 24, background: '#cf4a06', color: '#fff', border: 0, borderRadius: 999, padding: '10px 22px', fontSize: 15, cursor: 'pointer' }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
