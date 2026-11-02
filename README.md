# P11 — Verified Alumni Mentorship Matching and Engagement Platform

> **Phase 3: Alumni Institutional Verification and Officer Workflow**

An institutional web platform connecting university students with verified alumni for structured career guidance, transparent mentorship matching, and professional development.

---

## 1. System Overview

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS v3, shadcn/ui design patterns, React Hook Form, Zod.
- **Backend**: Node.js, Express.js, TypeScript, Mongoose, Zod, Helmet, CORS, Pino structured logging.
- **Database**: MongoDB Atlas (primary cloud database) or local MongoDB instance.
- **Architecture**: Monorepo with `client/` and `server/` managed via native npm workspaces.
- **Docker**: **Not required**. Operates natively on Windows with Node.js and npm.

---

## 2. Prerequisites

Ensure the following tools are installed on your Windows development environment:

- **Node.js**: `v24.21.0` (or LTS `v20.x` / `v22.x`, engine requirement `>=20.0.0`).
- **npm**: `v11.x` (or `>=9.0.0`).
- **Git**: Installed and configured with `user.name` and `user.email`.
- **Database**:
  - A free [MongoDB Atlas](https://www.mongodb.com/atlas) account (Recommended), **OR**
  - A local MongoDB Community Edition instance installed on port 27017.

> [!NOTE]
> Docker and Docker Desktop are strictly **not required** for this project.

---

## 3. Quickstart & Installation (Windows PowerShell)

### Step 1: Open Terminal in Project Root

```powershell
cd "c:\Users\HP\Desktop\Alumni Mentorship and Career Network"
```

### Step 2: Install Monorepo Dependencies

```powershell
npm install
```

### Step 3: Configure Environment Variables

Copy the template `.env.example` into both workspace subdirectories:

```powershell
# Copy backend environment configuration
Copy-Item .env.example server\.env

# Copy frontend environment configuration
Copy-Item .env.example client\.env.local
```

Edit `server\.env` to supply your MongoDB URI:

```ini
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/p11_mentorship?retryWrites=true&w=majority
JWT_SECRET=super_secret_p11_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=7d
COOKIE_NAME=p11_auth_token
```

### Step 4: Run the Development Servers

Start both the Next.js frontend (port 3000) and Express backend (port 5000) concurrently:

```powershell
npm run dev
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API Health Probe**: [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)
- **Database Readiness Check**: [http://localhost:5000/api/v1/health/ready](http://localhost:5000/api/v1/health/ready)
- **Auth Endpoints**:
  - `POST /api/v1/auth/register` — Create student or alumni account
  - `POST /api/v1/auth/login` — Sign in and receive HTTP-only session cookie
  - `POST /api/v1/auth/logout` — Clear session cookie
  - `GET /api/v1/auth/me` — Identify currently authenticated user
- **Alumni Verification Endpoints**:
  - `GET /api/v1/verification/me` — Retrieve current alumnus verification status
  - `POST /api/v1/verification/submit` — Submit institutional credentials for matching
- **Officer & Admin Verification Endpoints**:
  - `GET /api/v1/verification/officer/metrics` — Aggregate counters (pending, verified, rejected)
  - `GET /api/v1/verification/officer/queue` — Filterable, paginated verification review queue
  - `GET /api/v1/verification/officer/:id` — Side-by-side evidence inspection
  - `POST /api/v1/verification/officer/:id/approve` — Approve verified status & claim record
  - `POST /api/v1/verification/officer/:id/reject` — Reject submission with mandatory audit reason
  - `POST /api/v1/verification/officer/records/import/preview` — Non-mutating CSV preview
  - `POST /api/v1/verification/officer/records/import` — Idempotent bulk upsert with audit log

---

## 4. Roles, Registration & Security Rules

| Role | Internal Value | Public Registration? | Responsibilities |
| :--- | :--- | :---: | :--- |
| Student | `student` | Yes | Discover mentors, apply for mentorship, track goals. |
| Alumni / Mentor | `alumni` | Yes | Manage alumni profile, mentor students (requires verification in Phase 3). |
| Alumni Relations Officer | `alumni_officer` | No (Admin only) | Verify alumni identities and match ERP records. |
| Placement Officer | `placement_officer` | No (Admin only) | Read-only program participation and outcomes analytics. |
| Administrator | `admin` | No (Internal) | User governance, platform configurations, security audits. |

> [!IMPORTANT]
> **Alumni Registration vs. Verification**: Self-registering as an `alumni` creates an account with status `active`, but **does NOT** grant verified mentor status. Verification is performed in Phase 3 by an Alumni Relations Officer.

### Session & Cookie Security
- Authentication tokens are signed with **HMAC-SHA256** and contain only the subject (`sub: userId`).
- Role and account status are resolved dynamically from the database on every authenticated request, preventing stale privilege retention.
- Session tokens are stored in an **HTTP-only**, **SameSite=Lax**, **Secure** (in production) cookie (`p11_auth_token`).
- State-changing authentication requests validate the `Origin` / `Referer` headers against `CLIENT_URL` as a defense-in-depth CSRF measure.

---

## 4. MongoDB Atlas Setup Guide

To configure MongoDB Atlas as your primary cloud database:

1. **Create an Account & Cluster**:
   - Navigate to [MongoDB Atlas](https://www.mongodb.com/atlas).
   - Sign in and click **Create a Deployment** (choose the **M0 Free Tier**).
   - Select your preferred cloud provider and region closest to your location.

2. **Configure Database User**:
   - In the left menu under **Security**, click **Database Access**.
   - Click **Add New Database User**.
   - Choose **Password** authentication.
   - Enter a username (e.g., `p11_admin`) and generate a secure password.
   - Assign the **Read and write to any database** role and save.

3. **Configure Network Access Safely**:
   - In the left menu under **Security**, click **Network Access**.
   - Click **Add IP Address**.
   - Click **Add Current IP Address** to whitelist your development machine's current public IP.
   - _Security Note_: Avoid using `0.0.0.0/0` (access from anywhere) permanently, as it exposes your database cluster to unauthorized intrusion attempts.

4. **Obtain Connection String**:
   - Under **Deployment**, click **Database**.
   - Click **Connect** next to your cluster.
   - Select **Drivers** (Node.js).
   - Copy the connection URI string. It has the format:
     ```
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your database user credentials.
   - Append the database name before the `?`, for example `/p11_mentorship?retryWrites=true&w=majority`.

5. **Update `server/.env`**:

   ```ini
   MONGODB_URI=mongodb+srv://p11_admin:YourSecurePassword123@cluster0.xxxxx.mongodb.net/p11_mentorship?retryWrites=true&w=majority
   ```

6. **Verify Database Connection**:
   - Start the backend: `npm run dev:server`
   - In your browser or curl, visit: `http://localhost:5000/api/v1/health/ready`
   - Expect response:
     ```json
     {
       "status": "ready",
       "database": "connected",
       "timestamp": "2026-10-31T04:15:00.000Z"
     }
     ```

---

## 5. Development & Quality Scripts

All scripts are cross-platform and work seamlessly in Windows PowerShell and Command Prompt:

| Command                | Purpose                                                                          |
| :--------------------- | :------------------------------------------------------------------------------- |
| `npm run dev`          | Runs frontend and backend concurrently with colored prefix logs                  |
| `npm run dev:client`   | Runs only the Next.js frontend dev server on port 3000                           |
| `npm run dev:server`   | Runs only the Express backend dev server with hot reload on port 5000            |
| `npm run build`        | Builds both the backend TypeScript bundle and Next.js frontend production bundle |
| `npm run test`         | Runs the full test suite across backend and frontend workspaces                  |
| `npm run typecheck`    | Executes strict TypeScript compilation checks without emitting files             |
| `npm run lint`         | Runs ESLint 9 checks across all source files                                     |
| `npm run format`       | Formats the codebase using Prettier                                              |
| `npm run format:check` | Verifies code conforms to Prettier guidelines without modifying files            |

---

## 6. Security & Data Protection Architecture

1. **Zero Raw Secrets in Source Control**:
   - All `.env` and `.env.*.local` files are ignored by git.
   - `.env.example` provides non-sensitive placeholders only.
2. **Safe Logging Redaction**:
   - Pino logs automatically redact passwords, tokens, cookie payloads, Authorization headers, and sensitive PII.
   - MongoDB credentials are automatically scrubbed from connection logs.
3. **HTTP Security**:
   - Helmet sets strict security headers (`X-Frame-Options`, `Content-Security-Policy`, etc.).
   - CORS is restricted to the specific frontend origin (`http://localhost:3000`).
   - JSON payload limits prevent Denial of Service (DoS) from oversized requests.
4. **Least Privilege Role Governance**:
   - Public registration is strictly restricted to `Student` and `Alumni` roles.
   - Administrative and Officer roles cannot be self-selected.

---

## 7. Troubleshooting Common Issues

### 1. MongoDB Readiness returns `503 unready`

- **Cause**: Backend cannot reach MongoDB or credentials are invalid.
- **Solution**:
  1. Check Atlas **Network Access** to confirm your current IP address is whitelisted.
  2. Verify database username and password in `server/.env`.
  3. If using local MongoDB, verify the service is running (`net start MongoDB` in an Administrator PowerShell).

### 2. Port 3000 or 5000 is Already in Use

- **Cause**: Another service or orphaned process is bound to the port.
- **Solution**:
  ```powershell
  # Check which process is using port 5000
  Get-NetTCPConnection -LocalPort 5000 | Select-Object OwningProcess
  # Terminate process if needed
  Stop-Process -Id <ProcessId>
  ```
  Alternatively, update `PORT` in `server/.env` and update `NEXT_PUBLIC_API_URL` accordingly.

### 3. Missing Dependencies or Workspace Resolution Errors

- **Cause**: Incomplete installation or node version mismatch.
- **Solution**:
  ```powershell
  # Remove node_modules and reinstall cleanly
  npm run clean # or remove-item -Recurse -Force node_modules
  npm install
  ```

---

## 8. Current Implementation Status

### Completed in Phase 1 (Foundation):

- [x] Monorepo workspace architecture with native npm workspaces.
- [x] Express API skeleton with `app.ts` / `server.ts` separation.
- [x] `/api/v1/health` and `/api/v1/health/ready` endpoints.
- [x] Mongoose connection manager with Atlas & local compatibility.
- [x] Helmet security headers, CORS origin enforcement, and request correlation IDs.
- [x] Pino structured logging with automated field redaction.
- [x] Next.js 15 App Router frontend with Tailwind CSS v3 and shadcn/ui.
- [x] Landing page with hero, workflow, benefits, and verification standards.
- [x] Accessible Login page with Zod schema validation.
- [x] Accessible Registration page with role restrictions (Student & Alumni only).
- [x] Vitest and Supertest testing suites for backend and frontend smoke test.
- [x] System Architecture (`docs/ARCHITECTURE.md`) and setup documentation.

### Completed in Phase 2 (Authentication & Authorization):

- [x] User Mongoose model with email normalization, unique index, bcryptjs hashing ($12$ rounds), and safe DTO projections.
- [x] Public registration strictly restricted to `student` and `alumni` roles (`POST /api/v1/auth/register`).
- [x] Login with generic invalid-credentials response and account status checking (`POST /api/v1/auth/login`).
- [x] Logout with matched cookie invalidation (`POST /api/v1/auth/logout`).
- [x] Current session identification endpoint (`GET /api/v1/auth/me`).
- [x] JWT sessions with HTTP-only, SameSite=Lax, Secure cookies (never stored in client storage).
- [x] Origin/Referer header validation middleware as a CSRF defence layer for state-changing auth.
- [x] `authenticate` and `requireRole` middleware attaching verified user to Express request.
- [x] Frontend API client (`lib/api.ts`) with credential inclusion and typed error handling.
- [x] React `AuthContext` provider handling session lifecycle and client-side auth state.
- [x] Connected Login and Registration pages with live validation and error handling.
- [x] Protected `/dashboard` placeholder with user identity and role-based badge.
- [x] Authenticated state in responsive Navbar (Dashboard link, Logout action).
- [x] Vitest test suites: 44 backend integration/unit tests + frontend component tests.

### Completed in Phase 3 (Institutional Verification & Officer Workflow):

- [x] Authoritative institutional roster schema (`InstitutionalAlumniRecord`) with normalized primary keys and claiming locks.
- [x] Alumni verification lifecycle model (`AlumniVerification`) tracking states (`pending`, `verified`, `rejected`), versions, and history.
- [x] Append-only audit logger (`AuditLog` and `audit.service.ts`) tracking all submissions, reviews, approvals, rejections, and imports.
- [x] In-memory streaming CSV parser (`csv.service.ts`) with mandatory header enforcement, row validation, and duplicate detection.
- [x] Two-step CSV import: non-mutating preview (`/records/import/preview`) and idempotent bulk upsert (`/records/import`).
- [x] Deterministic matching engine (`matching.service.ts`) performing exact primary key matching and cross-field consistency checks.
- [x] Concurrency-safe officer approval claiming official graduation records with race condition defense.
- [x] Mandatory audit reason validation on rejection, re-enabling alumnus resubmission.
- [x] Alumni Verification Portal (`/verification`) supporting submission, live state badges, resubmission on rejection, and verified status.
- [x] Officer Review Dashboard (`/officer/verifications`) with metric counters, filterable/searchable queue, and side-by-side evidence inspection modal.
- [x] Authoritative Roster Import Page (`/officer/verifications/import`) with drag-and-drop, sample format, preview metrics, row errors, and confirm import.
- [x] Role-aware navigation links in Navbar and quick action cards in Dashboard.
- [x] Comprehensive test suites: 63 backend integration/unit tests and client smoke tests passing.

### Upcoming in Phase 4:

- [ ] Student career profiles, target domains, and mentee preference collection.
- [ ] Alumni mentor profiles, capacity controls, and topic availability.
