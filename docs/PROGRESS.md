# P11 — Verified Alumni Mentorship Platform: Progress Tracker

## Project

**P11 — Verified Alumni Mentorship Matching and Engagement Platform**

## Current Phase

**Phase 4 — Student & Alumni Profiles and Mentorship Offerings**

## Overall Phase Status

✅ **Phase 4 Completed & Verified (All 7 Tasks T1–T7 passing)**

---

## Phase 1 — Completed ✅

- Monorepo structure with native npm workspaces (`client`, `server`)
- Next.js 15 App Router, TypeScript, Tailwind CSS v3, shadcn/ui
- Node.js + Express.js + TypeScript backend with `app.ts` / `server.ts` separation
- MongoDB Atlas + Mongoose connection manager with degraded mode support
- Pino + pino-http structured logging with sensitive field redaction
- Centralized `AppError` and `errorHandler` middleware
- Request ID correlation (`X-Request-Id`)
- Health and readiness endpoints (`/api/v1/health`, `/api/v1/health/ready`)
- Vitest, Supertest, React Testing Library setup
- Landing page, accessible initial login & register forms
- Project documentation (`README.md`, `docs/ARCHITECTURE.md`)

---

## Phase 2 — Completed ✅

- `User` Mongoose model with email normalization, unique index, bcryptjs hashing ($12$ rounds), and safe projection DTOs.
- Public registration strictly restricted to `student` and `alumni` roles (`POST /api/v1/auth/register`).
- Login with generic invalid-credentials response and account status checking (`POST /api/v1/auth/login`).
- Logout with matched cookie invalidation (`POST /api/v1/auth/logout`).
- Current session identification endpoint (`GET /api/v1/auth/me`).
- JWT sessions with HTTP-only, SameSite=Lax, Secure cookies (`p11_auth_token`).
- Origin/Referer header validation middleware as a CSRF defence layer.
- `authenticate` and `requireRole` middleware attaching verified user to Express request.
- Frontend API client (`lib/api.ts`) with credential inclusion and typed error handling.
- React `AuthContext` provider handling session lifecycle and client-side auth state.
- Connected Login and Registration pages with live validation and error handling.
- Protected `/dashboard` placeholder with user identity and role-based badge.
- Authenticated state in responsive Navbar (Dashboard link, Logout action, immediate rendering).
- 44 server unit/integration tests and client component tests passing.

---

## Phase 3 — Completed ✅

- Authoritative institutional roster schema (`InstitutionalAlumniRecord`) with normalized primary keys and claiming locks.
- Alumni verification lifecycle model (`AlumniVerification`) tracking states (`pending`, `verified`, `rejected`), versions, and history.
- Append-only audit logger (`AuditLog` and `audit.service.ts`) tracking all submissions, reviews, approvals, rejections, and imports.
- In-memory streaming CSV parser (`csv.service.ts`) with mandatory header enforcement, row validation, and duplicate detection.
- Two-step CSV import: non-mutating preview (`/records/import/preview`) and idempotent bulk upsert (`/records/import`).
- Deterministic matching engine (`matching.service.ts`) performing exact primary key matching and cross-field consistency checks.
- Concurrency-safe officer approval claiming official graduation records with race condition defense.
- Mandatory audit reason validation on rejection, re-enabling alumnus resubmission.
- Alumni Verification Portal (`/verification`) supporting submission, live state badges, resubmission on rejection, and verified status.
- Officer Review Dashboard (`/officer/verifications`) with metric counters, filterable/searchable queue, and side-by-side evidence inspection modal.
- Authoritative Roster Import Page (`/officer/verifications/import`) with drag-and-drop, sample format, preview metrics, row errors, and confirm import.
- Role-aware navigation links in Navbar and quick action cards in Dashboard.
- 63 backend integration/unit tests and client smoke tests passing.

---

## Phase 4 — Completed ✅

| #   | Task                                | Status  | Details                                                                                        |
| --- | ----------------------------------- | :-----: | ---------------------------------------------------------------------------------------------- |
| T1  | Existing Codebase Review & Planning | ✅ Done | Inspected existing schemas, auth guards, verified data flows, planned models and APIs.         |
| T2  | Database Models & Backend Services  | ✅ Done | Created `StudentProfile`, `AlumniProfile`, and `MentorshipOffer` models, types, and services.  |
| T3  | Profile APIs                        | ✅ Done | `/api/v1/profiles/me` (GET/PATCH) and `/api/v1/profiles/alumni/:userId` (GET).                 |
| T4  | Mentorship Offering Management APIs | ✅ Done | `/api/v1/mentorship/offers` (POST), `/mine` (GET), `/:id` (GET/PATCH/DELETE).                  |
| T5  | Discovery APIs                      | ✅ Done | `/api/v1/mentorship/offers` (GET) with search, filter, and pagination.                         |
| T6  | Frontend Implementation             | ✅ Done | Student profile, alumni profile, offer management, discovery, and dashboard/navbar updates.    |
| T7  | Testing, Verification & Docs        | ✅ Done | Vitest (79 server tests, 3 client tests), TypeScript typecheck, ESLint, Prettier, Next.js build.|

---

## Important Architectural Decisions (Phase 4)

1. **Institutional Data Immutability**:
   - Institutional graduation credentials (`alumniId`, `institutionalEmail`, `programme`, `department`, `graduationYear`) remain solely sourced from the verified `AlumniVerification` record.
   - Profile endpoints never overwrite or duplicate verified institutional data.
2. **Server-Side Profile Completion Calculation**:
   - Profile completion percentage is calculated objectively on the backend across 4 categories: Academic (30%), Skills & Interests (30%), Career Goals & Bio (20%), and Mentorship Preferences (20%).
   - Frontend-submitted percentages are never trusted.
3. **Draft vs. Published Verification Guards**:
   - Alumni can save profiles as draft.
   - Publishing (`isPubliclyVisible: true`, `isDraft: false`) or creating an active `MentorshipOffer` strictly checks that `AlumniVerification.status === 'verified'` and `User.accountStatus === 'active'`.
4. **Soft Deletion for Offerings**:
   - Offerings use `isDeleted: true` to preserve historic integrity for future phase mentorship request records.
5. **Strict Discovery Filtering**:
   - Search and discovery queries only expose offerings where `status === 'active'`, `isDeleted === false`, and the offering's alumnus is actively verified and has a publicly visible profile.

---

## Last Completed Task

**T7 — Testing, Verification & Documentation**

## Next Phase

**Phase 5 — Explainable Matching Engine (Rule-weighted scoring without black-box AI)**
