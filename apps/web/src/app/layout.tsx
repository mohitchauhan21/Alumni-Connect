import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';
import { CommandPalette } from '@/components/CommandPalette';
import { MotionProvider } from '@/components/MotionProvider';
import { THEME_SCRIPT } from '@/lib/headScripts';
import { SITE } from '@/lib/site';
import { ThemeProvider } from '@/lib/theme';
import './globals.css';

/** Fallback for devices without San Francisco (see tailwind.config.ts). */
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: 'Mentor Bridge — mentoring that respects everyone’s time', template: '%s · Mentor Bridge' },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: { type: 'website', siteName: SITE.name, title: 'Mentor Bridge', description: SITE.description, url: '/', locale: 'en_IN' },
  twitter: { card: 'summary_large_image', title: 'Mentor Bridge', description: SITE.description },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The head script sets the `dark` class before React hydrates, hence suppressHydrationWarning.
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>
          <MotionProvider>
            <AuthProvider>
              <ToastProvider>
                {children}
                <CommandPalette />
              </ToastProvider>
            </AuthProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
