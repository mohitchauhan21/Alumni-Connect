
import { SiteFooter } from '@/components/SiteFooter';

export const metadata = { title: 'Privacy statement', description: 'Exactly what other people can see about you on Mentor Bridge, and what they never can.' };

const STUDENT_VISIBLE = [
  ['Name', 'Full name as registered'],
  ['Verified badge', 'Whether the institution has verified the person is an alumnus'],
  ['Headline, current role, current company', 'As written by the alumnus'],
  ['Industry, years of experience, city', 'City only — no address'],
  ['Department, degree, graduation year', 'From the verified institutional record'],
  ['Bio', 'As written by the alumnus'],
  ['Expertise tags, mentoring areas, languages', 'Chosen by the alumnus'],
  ['Capacity', 'Number of mentee slots, how many are used, and whether they are paused'],
  ['Weekly availability windows', 'Day of week and time range only'],
  ['Match score and reasons', 'Computed by the platform from the fields above'],
  ['Messages, sessions, goals, action items, shared session notes', 'Only inside a mentorship the student is part of'],
  ['Video-call link', 'Generated per session; does not identify the alumnus'],
];

const NEVER = ['Email address', 'Phone number', 'LinkedIn or other social profile URL', 'Date of birth and roll number', 'Verification documents', 'Private session notes written by the mentor', 'Decline history with other students', 'Calendar account details'];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-20">
        <h1 className="text-[40px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[52px]">Privacy statement</h1>
        <p className="mt-3 text-ink-600">
          This page lists every piece of alumni information a student can see on the platform. It is written for the alumni relations office to check without reading code. The authoritative copy is <code>docs/PRIVACY.md</code> in the project repository, and it is enforced by automated tests that call every endpoint as a student.
        </p>

        <h2 className="mt-10 text-xl font-semibold">1. What students can see about an alumni mentor</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-ink-100">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left">
              <tr>
                <th className="px-4 py-2.5 font-medium">Field</th>
                <th className="px-4 py-2.5 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {STUDENT_VISIBLE.map(([f, n]) => (
                <tr key={f} className="border-t border-ink-100">
                  <td className="px-4 py-2.5 font-medium">{f}</td>
                  <td className="px-4 py-2.5 text-ink-600">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-xl font-semibold">2. What students can never see</h2>
        <ul className="mt-3 list-disc space-y-1 pl-6 text-ink-700">
          {NEVER.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="mt-3 text-ink-600">This applies everywhere: search and matching results, mentor profiles, requests, mentorships, notifications and real-time messages.</p>

        <h2 className="mt-10 text-xl font-semibold">3. Contact details typed into messages</h2>
        <p className="mt-2 text-ink-600">If anyone types an email address, phone number or social-media link into a message, request, agenda or feedback, it is replaced with “[contact hidden]” before it is saved. The original text is never stored.</p>

        <h2 className="mt-10 text-xl font-semibold">4. Calendar invitations</h2>
        <p className="mt-2 text-ink-600">When a session is added to a connected Google or Outlook calendar, it is created separately in each person&apos;s own calendar without an attendee list, so no email address is shared. Downloadable .ics files contain no email addresses.</p>

        <h2 className="mt-10 text-xl font-semibold">5. Symmetric protection</h2>
        <p className="mt-2 text-ink-600">Mentors likewise cannot see a student&apos;s email or phone number. All communication stays on the platform.</p>

        <h2 className="mt-10 text-xl font-semibold">6. Who can see contact details</h2>
        <p className="mt-2 text-ink-600">Only Alumni Relations Officers and Administrators, for verification and programme administration. Placement officers see aggregate analytics only. Every view of a verification document is recorded in the audit log. Documents are kept in private storage and are never publicly linked, and staff accounts sign in with two-factor authentication.</p>
      </div>
      <SiteFooter />
    </div>
  );
}
