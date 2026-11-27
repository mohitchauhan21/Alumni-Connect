<div align="center">

<img src="apps/web/src/app/icon.svg" width="72" height="72" alt="Mentor Bridge logo" />

# Mentor Bridge

**Verified alumni mentorship for institutions: mentoring that respects everyone's time.**

[**Live demo →**](https://mentorbridge.antideploy.app) &nbsp;·&nbsp; [Quick start](#quick-start) &nbsp;·&nbsp; [Demo accounts](#demo-accounts) &nbsp;·&nbsp; [Deployment](#deployment) &nbsp;·&nbsp; [API](docs/API.md)

Next.js 15 · React 19 · Express · MongoDB · Socket.IO · TypeScript

</div>

---

Mentor Bridge connects students with alumni of their own institution. Alumni are **verified against the institution's records** before students can see them, students get **ranked matches with the reasons spelled out**, and the whole relationship (request → sessions → goals → feedback) happens on the platform, while **mentors' time is protected** and **nobody's email or phone number ever changes hands**.

Built for P11, Track J (verified alumni mentorship matching and engagement).

## Contents

- [What it does](#what-it-does)
- [Live demo](#live-demo)
- [Quick start](#quick-start)
- [Demo accounts](#demo-accounts)
- [Configuration](#configuration)
- [Optional integrations](#optional-integrations)
- [Accounts and security](#accounts-and-security)
- [Architecture](#architecture)
- [Testing](#testing)
- [Deployment](#deployment)
- [Design](#design)
- [Scripts](#scripts)
- [Known limitations](#known-limitations)

## What it does

| For | What they get |
|---|---|
| **Students** | A career profile (goals, target roles, interests, help wanted), mentors ranked by fit with plain-language reasons, only mentors with open capacity, requests that are always answered (or expire after 7 days and point to other matches), sessions with a live countdown and a one-tap Join, goals, action items and feedback. |
| **Alumni mentors** | Verification against the alumni register, hard limits on mentees and open requests, a pause switch, a keyboard-driven inbox (accept or decline in one key), optional session fees, their own Google Meet room, and contact details that are never shown. |
| **Institutions** | A verification queue with field-by-field comparison and an audit trail, weekly engagement health checks with automatic nudges, mentor-load warnings, and programme and placement reports with no personal data. |

**The privacy rule that runs through everything:** alumni contact details (email, phone, LinkedIn) never reach a student, in any API response or socket message. Contact details typed into messages are hidden before they're saved. This is enforced in layers and proved by a test that calls every API route (see [Testing](#testing)). The field-by-field statement is in [`docs/PRIVACY.md`](docs/PRIVACY.md).

## Live demo

**https://mentorbridge.antideploy.app** is a hosted demo running on purpose-made demo data.

- Open **Sign in** and pick a role under **Try a demo account**, or use any account from the [table below](#demo-accounts) with the password `Demo@1234`.
- It's a showcase, so **email isn't sent** (messages go to a log), **payments are off**, and staff accounts don't need two-factor sign-in.
- Anyone can sign in as any demo account, including the administrator, so the data can change. It can be reset at any time (see [Scripts](#scripts)).
- After a quiet period the first page can take a few seconds while the app wakes up.

## Quick start

**You need:** [Node.js 20 or newer](https://nodejs.org) and Git. No database to install.

```bash
git clone https://github.com/mohitchauhan21/Alumni-Connect.git
cd Alumni-Connect
npm install
npm run dev
```

Open **http://localhost:3000**.

| Service | Address |
|---|---|
| Website | http://localhost:3000 |
| API | http://localhost:4000/api |
| Health check | http://localhost:4000/api/health |

**What happens on first start:** with no `MONGODB_URI` set, the API starts its own **embedded MongoDB** (7.0.24, downloaded once and cached in `~/.cache/mongodb-binaries`) and loads the demo data automatically. The data is kept in `%LOCALAPPDATA%\alumni-mentor-network\mongo-data` on Windows or `~/.local/share/alumni-mentor-network/mongo-data` elsewhere: deliberately outside the project folder, because OneDrive and Dropbox corrupt live database files.

To use MongoDB Atlas instead, see [Database](#database).

**Run one side only:** `npm run dev:api` or `npm run dev:web`, from the repository root (not from inside `apps/`).

## Demo accounts

Every demo account uses the password **`Demo@1234`** (set in `apps/api/src/seed/data.ts`). The sign-in page's **Try a demo account** panel fills them in for you. It shows in development, and in a production build only when `NEXT_PUBLIC_DEMO_LOGINS=true`.

| Email | Who | Try this |
|---|---|---|
| `student@demo.edu` | Student (Aarav Sharma) | **Find a mentor**: ranked matches with reasons, filters and capacity → open a mentor → **Request mentorship**. Your next session counts down on **Home**. In a mentorship's **Messages**, type an email address: it's hidden. |
| `mentor@demo.edu` | Verified mentor (Priya Nair) | **Home** has 3 pending requests and 1 open slot. **Accept** one and you're full. **Decline** with a reason, or **Decline all**. **Pause** new requests. **Profile → Video calls** sets your own Google Meet room. **Earnings** shows session fees. |
| `newalumni@demo.edu` | Registered, unverified alumna | **Profile & verification**: submit roll number `2018CS901`, name *Rhea Kapoor*, year 2018, B.Tech, Computer Science & Engineering, date of birth 1996-04-12 → an exact record match. |
| `aro@demo.edu` | Alumni Relations Officer | **Verification queue** (compare fields, open documents, approve), **Engagement health** (nudge), **Mentor capacity** (overload warnings), **Programme report**. |
| `placement@demo.edu` | Placement Officer | A read-only programme report, including mentoring ↔ placement correlation. |
| `admin@demo.edu` | Administrator | **Programme settings** (matching weights, throttle limits, request expiry, engagement thresholds, paid sessions), **Payments** with refunds, users, audit log. |

**The demo data:** 60 verified alumni (each matched to an institutional record with an approval trail), 6 pending verifications (some with mismatches), 46 students, 26 mentorships with about five months of sessions, goals, action items, messages, feedback and weekly engagement snapshots, 45 requests in every state, and placement outcomes.

## Configuration

Everything has a working default for local development. The full list, with comments, is in [`apps/api/.env.example`](apps/api/.env.example) and [`apps/web/.env.example`](apps/web/.env.example). Put API settings in `apps/api/.env` (Git ignores it).

| Thing | Needed locally? | Without it |
|---|---|---|
| Node.js 20+ | **Yes** | |
| MongoDB | No | Embedded MongoDB, started automatically |
| Email (SMTP) | No | Every email is written to `apps/api/outbox/*.json` so you can read it |
| SMS (Twilio) | No | Written to `apps/api/outbox/` |
| Google / Outlook calendar | No | Every session has an **.ics** download |
| Video calls | No | A unique Jitsi room per session, or the mentor's own Google Meet room |
| Docker | No | Only for the Docker setups under [Deployment](#deployment) |

**In production** (`NODE_ENV=production`) the API checks its settings at startup and refuses to run if anything required is missing or still a development value, listing exactly what to fix: `JWT_SECRET`, `MONGODB_URI`, `DATA_ENCRYPTION_KEY`, `COOKIE_SECURE=true`, `https://` values for `WEB_ORIGIN` and `PUBLIC_API_URL`, and email (`SMTP_URL`, `MAIL_FROM`) unless `HOSTED_DEMO=true`.

## Optional integrations

### Database

Set `MONGODB_URI` in `apps/api/.env` and restart the API. The embedded database is skipped whenever it's set.

- **MongoDB Atlas:** create a cluster and a database user, allow your IP address under **Network Access**, and use the `mongodb+srv://…` string with a database name, for example `…mongodb.net/amn`. An empty database is filled with demo data on the first start in development.
- **Local Docker:** `docker compose up -d mongo`, then `MONGODB_URI=mongodb://localhost:27017/amn`.

> **Careful:** `npm run seed` wipes and reloads **whichever database `MONGODB_URI` points at**, including Atlas.

### Email (SMTP)

1. Pick any SMTP provider. For Gmail, turn on 2-step verification and create an **App password** at https://myaccount.google.com/apppasswords.
2. Set `SMTP_URL=smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465` (`%40` stands for `@`) and `MAIL_FROM`.
3. Restart the API.

### SMS (Twilio)

Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`. People opt in under **Settings → SMS reminders**; only session reminders and confirmations go by SMS.

### Video calls

- **Default:** every confirmed session gets its own Jitsi Meet room. No account needed.
- **A mentor's own Google Meet room:** under **Profile → Video calls**, a mentor pastes a link like `meet.google.com/abc-defg-hij`. Sessions they confirm use it, and saving it updates their upcoming sessions; clearing it gives those sessions fresh Jitsi rooms. Only real Meet room codes are accepted, and the link stays private: students only receive it as the join link of their own confirmed sessions.
- **Generated Google Meet links:** with Google Calendar connected (below) and `VIDEO_PROVIDER=google_meet`, sessions get a Meet link created in the participant's calendar.

### Google sign-in and Google Calendar

One Google OAuth client powers both **Continue with Google** and calendar sync.

1. In https://console.cloud.google.com create a project and enable the **Google Calendar API**.
2. **OAuth consent screen:** External, with the scopes `openid`, `email`, `profile` and `.../auth/calendar.events`; add yourself as a test user.
3. **Credentials → OAuth client ID → Web application**, with two redirect URIs:
   - `http://localhost:4000/api/auth/google/callback` (sign-in)
   - `http://localhost:4000/api/calendar/google/callback` (calendar)

   In production use `{PUBLIC_API_URL}/api/auth/google/callback` and `{PUBLIC_API_URL}/api/calendar/google/callback`.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and restart the API.
5. Optional: `GOOGLE_STUDENT_DOMAINS=students.your-college.edu` makes new **student** Google accounts use an institution address. Alumni can use any Google account, because they're verified against records afterwards.

Only Google-verified addresses are accepted. An existing account with the same email is linked and keeps its role. The flow uses a signed state and a nonce cookie, and the ID token is checked for audience, issuer, expiry and nonce.

### Outlook / Microsoft 365 calendar

1. In https://entra.microsoft.com, **App registrations → New registration**, with the redirect URI (Web) `http://localhost:4000/api/calendar/outlook/callback`.
2. Create a client secret, and add the delegated Microsoft Graph permissions `Calendars.ReadWrite`, `OnlineMeetings.ReadWrite` and `offline_access`.
3. Set `MS_CLIENT_ID`, `MS_CLIENT_SECRET` and `MS_TENANT` (`common` or your tenant ID), and restart the API.

### Institutional records

Staff upload the alumni register under **Institution records → Import CSV**, with the columns `rollNumber,fullName,graduationYear,degree,department[,dateOfBirth]`. Existing roll numbers are updated. For a live sync from an ERP, call `POST /api/alumni/records/import` on a schedule with a staff token.

### Paid sessions (Razorpay)

Mentors can charge per session (**Profile → Session fee**; 0 is free). When a student picks a time for a paid session, the slot is held for 30 minutes while they pay; once paid, the session is confirmed with its video link.

- **Development** uses a built-in test gateway (`PAYMENT_GATEWAY=test`): no money moves. Card `4242 4242 4242 4242` pays and `4000 0000 0000 0002` is declined; UPI `success@razorpay` pays and `failure@razorpay` is declined.
- **Production with Razorpay:** set `PAYMENT_GATEWAY=razorpay`, `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, and add a webhook to `https://<your API>/api/payments/webhook/razorpay` for `payment.captured`, `order.paid`, `payment.failed` and `refund.processed`, with its secret in `RAZORPAY_WEBHOOK_SECRET`.
- **Card numbers never reach the platform.** Students pay in Razorpay Checkout; the API keeps only Razorpay's token, the card network, the last four digits and the expiry, and refuses any request containing a card number.
- **Refunds:** a mentor or staff cancelling refunds in full; a student cancelling is refunded up to a cutoff before the session (24 hours by default). Ending a mentorship cancels its upcoming sessions and refunds paid ones.
- **Mentor payouts aren't automated.** Each payment records the platform fee and the mentor's share; automatic payouts need Razorpay Route (linked accounts with KYC).
- `PAYMENT_GATEWAY=off`, the production default, makes every session free.

## Accounts and security

| Feature | How it works |
|---|---|
| **Password reset** | A one-time emailed link (30 minutes). The answer is the same whether or not the account exists, and at most 3 links go out per hour. Resetting signs the account out everywhere. |
| **Email confirmation** | New accounts get a confirmation link (48 hours). Sending requests and submitting alumni verification wait for it (`REQUIRE_EMAIL_VERIFICATION`). Google sign-ins count as confirmed. |
| **Two-factor sign-in** | **Settings → Security**: scan a QR code with any authenticator app and save 10 recovery codes. Codes can't be reused, and 5 wrong codes pause it for 15 minutes. Keys are encrypted at rest (AES-256-GCM with `DATA_ENCRYPTION_KEY`), and the QR code is drawn by our own server. |
| **Required for staff** | With `REQUIRE_STAFF_2FA` (on by default in production), admin, Alumni Relations and Placement accounts must set up two-factor sign-in before anything else. |
| **Your data** | **Settings → Your data**: download everything the platform holds about you, or delete your account. Deletion erases personal data, saved cards, documents and notifications, and keeps records others or the law need (payments, shared messages, feedback, the audit log) under "Deleted user". |
| **Sign out everywhere** | Resetting or changing a password, or turning two-factor sign-in on or off, ends every other session at once. |
| **Documents** | Verification uploads are identified by their content (real PDF, PNG, JPEG or WEBP only, 5 MB each) and stored privately on disk (`STORAGE_DRIVER=local`) or in an S3-compatible bucket (`STORAGE_DRIVER=s3`). Staff view them through the API, which checks the role and logs every view. |
| **First admin** | Production never loads demo data. `npm run bootstrap -w apps/api -- --admin-email you@college.edu --admin-name "Your Name"` creates the settings, the expertise tags and the first administrator, and emails them a link to choose a password. |

## Architecture

```
apps/
  api/   Express + TypeScript + Mongoose + Socket.IO                  (port 4000)
    src/
      config/        env.ts (all settings), validate.ts (production startup checks)
      models/        the spec's entities plus User, Notification, AuditLog, Settings, InstitutionRecord…
      serializers/   ★ the privacy layer: the only place documents become API output (allow-lists)
      middleware/    auth (JWT cookie), leakGuard (scans every response for contact data), errors
      services/      matching, requests, capacity, sessions, calendar, engagement, analytics,
                     verification, payments, notify, channels (email/SMS), storage
      routes/        REST endpoints (see docs/API.md)
      jobs/          background jobs: on timers, or on demand via POST /api/jobs/:group
      socket.ts      real-time messages and notifications (privacy-checked)
      seed/          demo data and first-run bootstrap
    tests/           vitest + supertest + in-memory MongoDB
  web/   Next.js 15 (App Router) + React 19 + Tailwind                (port 3000)
    src/app/         public pages, and (app)/ for the signed-in pages of each role
    src/components/  UI kit, app shell, landing-page pieces, session countdown
deploy/start.mjs     runs API + website in one container (root Dockerfile)
docs/                API.md, PRIVACY.md
```

| Concern | Decision |
|---|---|
| **Capacity under concurrency** | One `MentorCapacity` document per mentor, incremented with `findOneAndUpdate({ activeCount < maxMentees, not paused }, { $inc })`. MongoDB applies the check and the increment atomically, so any number of simultaneous accepts can never go over the limit. |
| **Throttling** | Students: max pending, max per rolling period, a cooldown after a decline, max active mentorships. Mentors: max open requests. All limits live in the database and admins edit them in the UI. |
| **Expiry** | Each request has an `expiresAt`. A background sweep expires overdue requests, and accepting re-checks it, so an expired request can never be accepted. |
| **Privacy** | `select: false` on contact fields → allow-list serializers → a `leakGuard` scan of every response and socket message → exhaustive tests. Free text is masked before it's stored. Calendar events carry no attendee list. |
| **Matching** | Computed on demand: a weighted score over expertise overlap, target-role similarity, industry, mentoring areas, department, availability and load balance (to spread students across mentors). Every result carries plain-language reasons, and admins tune the weights. |
| **Messaging** | Socket.IO with a room per mentorship, plus a polling fallback when WebSockets are blocked. |
| **Auth** | A JWT in an httpOnly, SameSite=Lax cookie. The website proxies `/api` and `/socket.io`, so the browser only talks to one origin. Passwords are hashed with bcrypt and the auth endpoints are rate-limited. |
| **Background jobs** | Six jobs (request expiry, session reminders, payment holds, action-item reminders, pause auto-resume, weekly engagement check). They run on in-process timers by default, or a host scheduler calls `POST /api/jobs/frequent | hourly | weekly`, protected by `CRON_SECRET`, on hosts that stop the app between requests. Every job is safe to run late or twice. |

**Where each module lives**

| Module | API | Website |
|---|---|---|
| M1 Verification & profile | `services/verification.ts`, `routes/alumni.ts` | `mentor/profile`, `admin/verification`, `admin/records` |
| M2 Capacity & availability | `services/capacity.ts`, `routes/mentors.ts` | `mentor/availability`, `admin/capacity` |
| M3 Student career profile | `routes/students.ts` | `student/profile` |
| M4 Matching | `services/matching.ts`, `GET /api/mentors/search` | `mentors` |
| M5 Requests | `services/requests.ts`, `routes/requests.ts` | `mentor` (Home), `student` |
| M6 Scheduling & sessions | `services/sessions.ts`, `services/calendar.ts` | `mentorships/[id]` → Sessions |
| M7 Goals, actions, feedback | `routes/mentorships.ts` | `mentorships/[id]` → Goals, Feedback |
| M8 Engagement | `services/engagement.ts`, weekly job | `admin/engagement` |
| M9 Messaging | `routes/messages.ts`, `socket.ts`, `lib/mask.ts` | `mentorships/[id]` → Messages |
| M10 Analytics | `services/analytics.ts`, `routes/analytics.ts` | `analytics`, `admin/mentors` |

## Testing

```bash
npm test
```

132 tests in 14 files, each file against its own throw-away in-memory MongoDB. [CI](.github/workflows/ci.yml) runs the type checks, the tests and the production build on every push and pull request.

| What's proved | File | How |
|---|---|---|
| Alumni contact data never reaches a student | `privacy.test.ts` | Loads the full demo data, **lists every route from the Express router**, and calls each one as a student with real ids. It also runs whole flows (request, withdraw, propose, book, complete, cancel, end), pages through matching for all 60 mentors, opens every profile and listens to Socket.IO, searching every payload for every alumni email, phone number and LinkedIn URL. A new route without coverage fails the test. |
| Capacity can't be exceeded under concurrency | `capacity.test.ts` | Rounds of simultaneous accepts, parallel HTTP accepts, one request accepted five times at once, pause, end-then-reaccept, lowering the limit. |
| Throttling is enforced and configurable | `throttle.test.ts` | Pending and period limits, admin-set limits, concurrent requests, duplicates, cooldown, the mentor inbox limit. |
| Expiry is correct | `expiry.test.ts` | The exact `expiresAt` boundary, only pending requests touched, idempotent and concurrent sweeps, accept-after-expiry refused. |
| Background jobs on demand | `jobs.test.ts` | The job address is off without `CRON_SECRET`, refuses a missing or wrong key even with the scheduler's header, and runs the right jobs with the right key. |
| Google sign-in | `google.test.ts` | New accounts, linking, unverified email, forged state or nonce, wrong audience, suspended accounts, open-redirect safety, two-factor after Google. |
| Password reset, email confirmation, two-factor, first admin | `account.test.ts` | RFC 6238 vectors, one-time and hashed reset links, sign-out everywhere, replay and lockout, the staff gate, a re-runnable bootstrap. |
| Documents and production settings | `storage.test.ts` | Content-based file checks, private storage, staff-only streaming, unsafe production settings refused, the hosted-demo rules. |
| Paid sessions | `payments.test.ts` | Holds, payment, refunds, card numbers refused, the fee cap, Razorpay signatures and webhooks against a stand-in Razorpay. |
| Download my data, delete my account | `dataRights.test.ts` | Exports hold only your own records; deletion erases what it should and keeps what others or the law need. |
| A mentor's own Meet room | `meetLink.test.ts` | Link shapes normalised, non-Meet links refused, private to the mentor, used for new sessions and applied to upcoming ones. |
| Next meeting | `sessionPass.test.ts` | Each participant gets their soonest meeting and its link; staff never get meeting links. |
| Matching, verification, engagement, sessions, analytics, audit fixes | `domain.test.ts`, `audit.test.ts` | Ranking and reasons, record matching with an audit trail, engagement nudges, booking rules, double-booking prevention, role access. |

## Deployment

### Antideploy (the live demo)

The demo at https://mentorbridge.antideploy.app runs on [Antideploy](https://antideploy.com). The app id is in [`.antideploy.json`](.antideploy.json), and [`AGENTS.md`](AGENTS.md) tells AI agents how to deploy updates.

- **One container.** The root [`Dockerfile`](Dockerfile) builds both apps, and [`deploy/start.mjs`](deploy/start.mjs) runs the API inside the container (port 4400) and the website on the platform's `PORT`. The website proxies `/api` and `/socket.io` to the API, so cookies stay first-party.
- **Hosted-demo mode.** The image sets `HOSTED_DEMO=true` (email is written to a log, not sent, because the demo accounts use made-up addresses), `PAYMENT_GATEWAY=off`, the demo sign-in panel, and no staff two-factor requirement.
- **Database:** MongoDB Atlas, through the app's private `MONGODB_URI` setting. Atlas **Network Access** must allow the host (`0.0.0.0/0`), because the host's IP addresses aren't fixed.
- **Documents:** Antideploy's private S3-compatible bucket. `deploy/start.mjs` maps the platform's `AWS_*` and `S3_*` variables onto the API's own.
- **Private settings on the app:** `MONGODB_URI`, `DATA_ENCRYPTION_KEY`, `WEB_ORIGIN`, `PUBLIC_API_URL`, `CRON_SECRET`. Antideploy generates `JWT_SECRET` itself.
- **Background jobs.** Antideploy stops the app between requests, so in-process timers are off (`JOBS_IN_PROCESS=false`). Three Antideploy scheduled jobs call `POST /api/jobs/frequent` every 10 minutes, `/hourly` at :15 past each hour and `/weekly` on Mondays at 06:00 UTC, each with the `CRON_SECRET` key.
- **Updating it:** Antideploy deploys what's uploaded to it, not what's on GitHub. Ask an agent to deploy (it follows `AGENTS.md`), or upload the project yourself as described at https://antideploy.com/agent.md. Never include `.env` files in the upload.

### Docker Compose (database + API + worker + website)

```bash
docker compose up --build
```

A production setup for your own server. Put the values it asks for (`JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `WEB_ORIGIN`, `PUBLIC_API_URL`, `SMTP_URL`, `MAIL_FROM`) in a `.env` next to `docker-compose.yml`, and serve it behind HTTPS. The worker container runs the background jobs. Then create the first admin: `docker compose exec api node apps/api/dist/seed/bootstrap.js --admin-email you@college.edu`.

### Any other host

- **API:** `npm run build -w apps/api`, then `node apps/api/dist/index.js`.
- **Worker:** `node apps/api/dist/worker.js` as a single instance with the same settings, and `JOBS_IN_PROCESS=false` on the API. On hosts that stop idle apps, use a scheduler and `POST /api/jobs/:group` with `CRON_SECRET` instead.
- **Website:** `npm run build -w apps/web`, then `npm run start -w apps/web`. `API_URL` (where the website proxies `/api`) and `NEXT_PUBLIC_SOCKET_URL` are baked in at **build** time; `NEXT_PUBLIC_SOCKET_URL=same-origin` sends live chat through the website's own proxy.
- Put the API and website behind one HTTPS domain so cookies stay first-party.

### Before real users

The demo is not a production deployment. For real students and alumni:

1. **Database:** a separate Atlas database (or cluster) with backups on, never the demo database.
2. **Secrets:** `JWT_SECRET` (`openssl rand -base64 48`) and `DATA_ENCRYPTION_KEY` (`openssl rand -base64 32`). Losing `DATA_ENCRYPTION_KEY` means everyone has to set up two-factor sign-in again.
3. **Email:** a transactional provider with SPF, DKIM and DMARC on your domain (`SMTP_URL`, `MAIL_FROM`), and `HOSTED_DEMO` off.
4. **Documents:** a private bucket (`STORAGE_DRIVER=s3`).
5. **Privacy notice:** the website doesn't currently include a privacy page. India's DPDP Act 2023 requires telling people what's collected and why; [`docs/PRIVACY.md`](docs/PRIVACY.md) is a starting point.
6. **Start it:** run the bootstrap command to create the first admin, sign in, turn on two-factor sign-in, and import the alumni register.
7. **Payments:** Razorpay live keys and the webhook, if mentors charge.
8. **Staging first:** a separate copy with its own database and bucket.

## Design

**Quiet and minimal.** Neutral greys carry the page, and one accent, **Mentor Bridge orange** (the logo's `#F97316`), marks what you can act on; buttons and small text use a deeper shade (`#cf4a06`) so they pass WCAG AA contrast. Green means success. Headings fade from orange to rose. Every screen has light and dark themes, chosen in **Settings → Appearance** or with the sun/moon toggle, and applied before the first paint so there's no flash.

**Colour tokens** live in [`tailwind.config.ts`](apps/web/tailwind.config.ts) (`brand` for the accent, `ok` for success) and [`globals.css`](apps/web/src/app/globals.css) (the `ink` greys, which flip between themes). Changing `brand` re-colours every link, button and highlight.

**Type.** San Francisco on Apple devices, Inter everywhere else.

**Logo.** A bridge arc over three pillars on an orange tile ([`Logo.tsx`](apps/web/src/components/Logo.tsx)), with the favicon and share image to match.

**Landing page.** Lenis smooth scrolling drives GSAP ScrollTrigger; headings rise in with GSAP SplitText; the hero sits on a React Bits **ShapeGrid** whose cells glow orange under the cursor; a scroll-speed text marquee, scroll-revealed statement, a story section where the product visual stays pinned beside four chapters, count-up figures and spotlight cards follow. Buttons stay still, and everything is still and fully readable when the device asks for reduced motion.

**In the app**
- **Student Home:** the next session's countdown (or, with none booked, the single most useful next step), mentorships and requests side by side, and top matches in a row.
- **Mentor Home:** a keyboard inbox (↑↓ to browse, **A** to accept, **D** to decline).
- **Session countdown:** days, hours, minutes and seconds to the next session, with Join switching on ten minutes before, Add to calendar, and a live state while it's on.
- **Profiles** are LinkedIn-style; both "your profile" pages preview exactly what others see, without contact details.
- **Alumni verification** is a four-step wizard; **Settings → Your data** is a glass folder you download parts of.
- **Navigation:** one public navbar (a gooey pill that follows the section in view) and one app sidebar with ⌘K search; all links come from [`lib/nav.ts`](apps/web/src/lib/nav.ts).

**Credits.** Components adapted from [React Bits](https://reactbits.dev) (MIT + Commons Clause, licence in `components/reactbits/`) and [21st.dev](https://21st.dev): ShapeGrid (landing hero), GooeyNav (navbar), AnimatedList (mentor inbox), Stepper (verification wizard), ClickSpark (accept confirmation), glass folder cards (Your data); the landing page's marquee, scroll reveal and spotlight cards are adapted from React Bits too. Smooth scrolling by [Lenis](https://github.com/darkroomengineering/lenis), animation by [GSAP](https://gsap.com) and [Framer Motion](https://motion.dev), icons by [Lucide](https://lucide.dev).

## Scripts

Run these from the repository root.

| Command | What it does |
|---|---|
| `npm run dev` | API and website with hot reload (embedded database and timers locally) |
| `npm run dev:api` / `npm run dev:web` | One side only |
| `npm run seed` | **Wipes** the database `MONGODB_URI` points at (or the embedded one) and loads the demo data. Development only. |
| `npm run bootstrap -w apps/api -- --admin-email …` | First-run setup for a real database: settings, tags and the first admin |
| `npm test` | API test suite |
| `npm run typecheck` | TypeScript checks for both apps |
| `npm run build` | Production builds of both apps |

## Known limitations

Stated plainly, so nothing is assumed to work that hasn't been exercised.

- **Not tried against the real services** (no credentials were available): Google Calendar, Outlook, Twilio, SMTP sending, Google sign-in and Razorpay. They're implemented and covered by tests with those services stood in, and the local fallbacks (.ics, Jitsi, outbox files, the test gateway) are tested end to end.
- **Tried for real:** MongoDB Atlas, an S3-compatible bucket (Antideploy's), the root Dockerfile (built and running on Antideploy), and scheduled jobs through `POST /api/jobs/:group`. `docker-compose.yml` has not been built.
- **Not implemented:** institution SSO beyond Google, LinkedIn profile prefill, a live connector to a specific ERP (there's CSV import and an import endpoint), and AI extensions such as semantic matching.
- **No privacy page on the website** (see [Before real users](#before-real-users)).
- **Scaling:** Socket.IO runs on one API instance; more need the Socket.IO Redis adapter.
- **Times in notifications** are formatted in UTC; the website shows local times.
- **Two-factor lockout:** someone who loses both their phone and their recovery codes can't get back in alone, and there's no admin "reset two-factor" button yet. An operator can switch it off in the database (`mfaEnabled: false`, and remove the `mfa*` fields).
