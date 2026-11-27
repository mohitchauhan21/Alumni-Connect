import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

/** The public pages search engines should know about. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { path: '', priority: 1, freq: 'weekly' as const },
    { path: '/register', priority: 0.8, freq: 'monthly' as const },
    { path: '/login', priority: 0.5, freq: 'monthly' as const },
    { path: '/contact', priority: 0.6, freq: 'monthly' as const },
    { path: '/terms', priority: 0.3, freq: 'yearly' as const },
    { path: '/refunds', priority: 0.3, freq: 'yearly' as const },
  ].map((p) => ({ url: `${SITE.url}${p.path}`, lastModified: now, changeFrequency: p.freq, priority: p.priority }));
}
