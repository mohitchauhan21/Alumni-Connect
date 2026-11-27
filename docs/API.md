# API reference

Base URL: `/api`. Auth: httpOnly cookie `amn_token` (set by login/register) or `Authorization: Bearer <token>`.
Errors: `{ "error": { "code": "...", "message": "...", "details"?: ... } }` with standard HTTP status codes (400 validation, 401, 403, 404, 409 conflict/state, 429 throttle).

Role legend: **S** student · **M** alumnus/mentor · **R** alumni relations officer · **P** placement officer · **A** admin

## Auth
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/auth/register` | public | `{name,email,password,role:'student'|'alumnus',phone?}` |
| POST | `/auth/login` | public | rate-limited |
| POST | `/auth/logout` | any | |
| GET | `/auth/me` | any | own user + profile summary |
| PATCH | `/auth/me` | any | name, phone, timezone, notificationPrefs |
| POST | `/auth/login/2fa` | public | second sign-in step: `{code, challenge?}`. `code` is a 6-digit authenticator code or a recovery code; the challenge comes from `/auth/login` (body or the `amn_mfa` cookie). 5 wrong codes lock it for 15 minutes (429 `mfa_locked`) |
| POST | `/auth/forgot-password` | public | `{email}`. Always `{ok:true}`, whether or not the account exists; at most 3 links per hour per account |
| POST | `/auth/reset-password` | public | `{token, password}`. One-time link, 30 minutes (72 hours for invites). Signs the account out everywhere |
| POST | `/auth/verify-email` | public | `{token}`. One-time, 48 hours |
| POST | `/auth/resend-verification` | any | new confirmation link (max 5 per hour) |
| POST | `/auth/change-password` | any | `{currentPassword?, newPassword}`. `currentPassword` is omitted only by Google-only accounts adding a password. Other sessions end |
| POST | `/auth/2fa/setup` | any | returns `{secret, otpauthUrl, qrSvg}` (QR drawn by the API) |
| POST | `/auth/2fa/enable` | any | `{code}` → `{recoveryCodes}` (10, shown once). Other sessions end |
| POST | `/auth/2fa/disable` | any | `{code}` (authenticator or recovery code). Refused for staff when `REQUIRE_STAFF_2FA` is on |
| POST | `/auth/2fa/recovery-codes` | any | `{code}` → a fresh set of 10 recovery codes |

`POST /auth/login` returns `{mfaRequired:true, challenge}` instead of a session when two-factor sign-in is on. `GET /auth/me` includes `security: {hasPassword, emailVerified, emailVerificationRequired, mfaEnabled, mfaRequired, mfaSetupRequired, recoveryCodesLeft}`.

Gates: `403 email_unverified` on `POST /requests` and `POST /alumni/verify` until the email is confirmed (when `REQUIRE_EMAIL_VERIFICATION` is on). `403 mfa_setup_required` on every non-`/auth` endpoint for staff without two-factor sign-in (when `REQUIRE_STAFF_2FA` is on).

## Reference data
| GET | `/meta` | public | mentoring areas, industries, departments, decline reasons |
|---|---|---|---|
| GET | `/tags` | any | expertise tags |
| POST | `/tags` | R A | create tag |

## M1 — Alumni verification & profile
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/alumni/me` | M | own profile, capacity, availability, latest verification |
| PUT | `/alumni/me` | M | professional profile (academic fields locked after verification); `meetLink` sets the mentor's own Google Meet room (`''` removes it; updates upcoming sessions) |
| POST | `/alumni/verify` | M | multipart: `fullName, rollNumber, graduationYear, degree, department, dateOfBirth?, documents[]` (≤3 × 5 MB PDF/JPG/PNG/WEBP) |
| GET | `/alumni/verify` | M | own verification history |
| GET | `/alumni/verify/queue?status=` | R A | queue with record comparison + contact details |
| GET | `/alumni/verify/:id` | R A | |
| POST | `/alumni/verify/:id/decision` | R A | `{decision:'approve'|'reject'|'needs_info', note?}` (note required unless approve) |
| GET | `/alumni/verify/:id/documents/:docId` | R A | streams file; audited |
| POST | `/alumni/records/import` | R A | `{csv}` |
| GET | `/alumni/records?q=` | R A | |

## M2 / M4 — Mentors, capacity, matching
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/mentors/search` | any | `q, industries, tags, areas, department, minYears, hasCapacity (default true), sort=relevance|experience|capacity, limit, offset`. Students get `match: {score, reasons[], breakdown}` per mentor; returns `facets`. |
| GET | `/mentors/:id` | any | profile + capacity + availability (+ match & request state for students) |
| GET/PUT | `/mentors/me/capacity` | M | `{maxMentees 0–10, maxPendingRequests 1–20}` |
| POST | `/mentors/me/pause` | M | `{until?, reason?}` |
| POST | `/mentors/me/resume` | M | |
| GET/PUT | `/mentors/me/availability` | M | `{windows:[{dayOfWeek,startMinute,endMinute,timezone}]}` |

## M3 — Student career profile
| GET/PUT | `/students/me` | S | profile + goals + throttle status |
|---|---|---|---|
| POST | `/students/me/goals` | S | |
| PUT/DELETE | `/students/me/goals/:id` | S | |

## M5 — Requests
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/requests?status=` | S M R A | own (student/mentor) or all (staff) |
| GET | `/requests/throttle` | S | current usage vs limits |
| POST | `/requests` | S | `{alumnusId, message (20–1200), goalIds?}` → 429 `throttle_pending` / `throttle_period` / `throttle_active`, 409 `duplicate_request` / `cooldown` / `mentor_unavailable` / `already_mentored` |
| POST | `/requests/:id/accept` | M | 409 `capacity_full` / `expired` / `not_pending` / `student_at_limit` |
| POST | `/requests/:id/decline` | M | `{reason?, note?}` — reason optional |
| POST | `/requests/decline-all` | M | `{reason?}` |
| POST | `/requests/:id/withdraw` | S | |

## M6 / M7 — Mentorships, sessions, goals, feedback
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/mentorships?status=&health=` | S M R A | |
| GET | `/mentorships/:id` | participants, R A | |
| POST | `/mentorships/:id/end` | participants | `{outcome:'completed'|'ended', reason?}` frees a capacity slot |
| POST | `/mentorships/:id/nudge` | R A | |
| GET | `/mentorships/:id/sessions` | participants, R A | mentor also sees own private notes |
| POST | `/mentorships/:id/sessions` | participants | propose `{slots:[{start,end}] (1–5), title?, agenda?}` |
| POST | `/mentorships/:id/sessions/:sid/book` | other participant | `{slotIndex}` → video link, calendar sync; 409 `slot_clash` |
| POST | `/mentorships/:id/sessions/:sid/cancel` | participants | |
| POST | `/mentorships/:id/sessions/:sid/complete` | participants | `{outcome:'completed'|'no_show', summary?, mentorPrivateNotes?}` |
| GET | `/mentorships/:id/sessions/:sid/ics` | participants | iCalendar file (no emails inside) |
| GET/POST | `/mentorships/:id/goals` | participants | GET returns goals + action items |
| PATCH | `/mentorships/:id/goals/:gid` | participants | |
| POST | `/mentorships/:id/actions` | participants | `{title, assignee, dueDate?, goalId?}` |
| PATCH | `/mentorships/:id/actions/:aid` | participants | |
| GET/POST | `/mentorships/:id/feedback` | participants | `{rating 1–5, comment?, sessionId?, kind?}` one per session per person |

## M9 — Messaging
| GET | `/messages?mentorshipId=&before=&limit=` | participants, R A | |
|---|---|---|---|
| POST | `/messages` | participants | `{mentorshipId, body}` — contact details masked before storage |
| POST | `/messages/read` | participants | |
| GET | `/messages/unread` | S M | counts per mentorship |

Socket.IO (`/socket.io`, cookie or `auth.token`): client → `join(mentorshipId)`, `leave`, `message({mentorshipId, body})`, `typing(mentorshipId)`; server → `message`, `notification`, `typing`.

## Notifications & calendar
| GET | `/notifications` | any | |
|---|---|---|---|
| POST | `/notifications/read` | any | `{ids?|all?}` |
| GET | `/calendar/status` | any | |
| GET | `/calendar/:provider/connect` | any | returns OAuth URL (501 if not configured) |
| GET | `/calendar/:provider/callback` | OAuth redirect | |
| DELETE | `/calendar/:provider` | any | |

## Admin
| GET | `/admin/overview` | R A | |
|---|---|---|---|
| GET | `/admin/settings` | R A | |
| PUT | `/admin/settings` | A | matching weights, throttle, expiry, engagement, verification |
| GET | `/admin/capacity` | R A | per-mentor capacity, overload warnings |
| GET | `/admin/engagement?health=` | R A | health board |
| POST | `/admin/jobs/:job/run` | R A | `expiry` or `engagement` |
| GET | `/admin/users?role=&q=` | A | |
| PATCH | `/admin/users/:id` | A | status / role |
| GET | `/admin/audit?action=&entityId=` | R A | |

## Background jobs
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/jobs/:group` | `?key=` or `x-cron-key` = `CRON_SECRET` | runs a job group for a host scheduler: `frequent` (request expiry, session reminders, payment holds), `hourly` (action-item reminders, pause auto-resume), `weekly` (engagement check). 404 unless `CRON_SECRET` is set; 401 on a wrong key. Answers `{group, ok, results[]}` |

## M10 — Analytics
| GET | `/analytics/programme?from=&to=` | R A P | participation, requests, sessions, goals, utilisation, engagement, satisfaction, trends |
|---|---|---|---|
| GET | `/analytics/programme.csv` | R A P | CSV export |
| GET | `/analytics/placement` | R A P | mentoring participation vs placement outcomes |
| GET | `/analytics/mentors` | R A | mentor effectiveness ranking |
