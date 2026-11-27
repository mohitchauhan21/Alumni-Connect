import Link from 'next/link';
import { LegalPage } from '@/components/LegalPage';
import { SITE } from '@/lib/site';

export const metadata = { title: 'Terms of service', description: 'The terms for using Mentor Bridge.' };

/*
 * DRAFT written from how the platform works. Have it reviewed (ideally by a lawyer) before launch,
 * and set NEXT_PUBLIC_LEGAL_NAME / NEXT_PUBLIC_JURISDICTION_CITY / NEXT_PUBLIC_CONTACT_EMAIL.
 */
export default function TermsPage() {
  const who = SITE.legalName;
  return (
    <LegalPage title="Terms of service" updated="24 November 2026" intro={<p>These terms govern your use of {SITE.name} (“the platform”), operated by {who}. By creating an account or using the platform, you agree to them.</p>}>
      <h2>1. What the platform is</h2>
      <p>The platform connects students of a participating institution with verified alumni who volunteer as mentors. It provides matching, messaging, session scheduling, goal tracking and, where enabled, payment of session fees. It does not employ mentors and does not guarantee any academic, career or employment outcome.</p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You must give accurate information and keep your password and two-factor codes secure. You are responsible for activity on your account.</li>
        <li>Alumni must complete verification against the institution’s records before students can find them. We may decline or withdraw verification if information doesn’t match.</li>
        <li>Staff accounts (Alumni Relations, Placement, administrators) are created by the institution and must use two-factor sign-in.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>harass, threaten, discriminate against or exploit anyone, or send unsolicited commercial messages;</li>
        <li>try to obtain or share another member’s contact details to move a mentorship off the platform against their wishes;</li>
        <li>impersonate anyone, misrepresent your affiliation, or create accounts for others;</li>
        <li>interfere with the platform’s security, scrape it, or use it for anything unlawful.</li>
      </ul>
      <p>We may suspend or close accounts that break these rules. Serious concerns can be reported to the institution’s Alumni Relations office or to us.</p>

      <h2>4. Mentors</h2>
      <p>Mentors decide how many mentees and open requests they take, may decline any request, and may pause at any time. Advice given by mentors is their own personal view, not professional advice from {who} or the institution.</p>

      <h2>5. Session fees and payments</h2>
      <ul>
        <li>Mentors may set a fee per session, within a maximum the programme sets. The fee is shown before you book.</li>
        <li>Payments are processed by our payment partner. We do not store full card numbers.</li>
        <li>A platform fee, shown to mentors before they set a price, is deducted from the amount paid to the mentor.</li>
        <li>Cancellations and refunds follow our <Link href="/refunds">Cancellations &amp; refunds policy</Link>.</li>
      </ul>

      <h2>6. Your content and your data</h2>
      <p>You keep ownership of what you write. You give us permission to store and display it to the people the platform shows it to, only to run the service. You can download your data or delete your account at any time from Settings.</p>

      <h2>7. Availability and changes</h2>
      <p>We work to keep the platform available and secure but can’t promise it will be uninterrupted or error-free. We may change features, and we’ll update these terms when needed — material changes will be announced on the platform before they take effect.</p>

      <h2>8. Liability</h2>
      <p>To the extent the law allows, {who} is not liable for indirect or consequential loss, or for the conduct of members on or off the platform. Nothing in these terms limits liability that cannot be limited by law.</p>

      <h2>9. Ending your use</h2>
      <p>You can delete your account at any time. We may suspend or close accounts that breach these terms. Sections that by their nature should continue (such as liability and payments owed) survive.</p>

      <h2>10. Law and disputes</h2>
      <p>These terms are governed by the laws of India{SITE.jurisdiction ? `, and the courts at ${SITE.jurisdiction} have jurisdiction` : ''}.</p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms: {SITE.email ? <a href={`mailto:${SITE.email}`}>{SITE.email}</a> : <Link href="/contact">contact us</Link>}.
      </p>
    </LegalPage>
  );
}
