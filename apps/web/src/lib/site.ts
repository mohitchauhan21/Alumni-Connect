/**
 * Site-wide facts for public pages, SEO and legal text. Set these in apps/web/.env.local (or your
 * host's environment) before launch — see apps/web/.env.example.
 */
export const SITE = {
  name: 'Mentor Bridge',
  description: 'The alumni mentorship platform for institutions. Students meet verified alumni with the right expertise and the capacity to help — privately.',
  /** Public URL of the site, no trailing slash. Used for canonical links, Open Graph and the sitemap. */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  /** Who runs the service, as it should appear in the terms. */
  legalName: process.env.NEXT_PUBLIC_LEGAL_NAME ?? 'Mentor Bridge',
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '',
  phone: process.env.NEXT_PUBLIC_CONTACT_PHONE ?? '',
  address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS ?? '',
  /** City whose courts the terms name. */
  jurisdiction: process.env.NEXT_PUBLIC_JURISDICTION_CITY ?? '',
};
