# P11 — Verified Alumni Mentorship Matching and Engagement Platform

> **Phase 1: Project Foundation, Architecture, Security and Development Environment**

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

### Upcoming in Phase 2:

- [ ] User and Auth modules (Mongoose user schema, bcrypt password hashing).
- [ ] Secure HTTP-only JWT cookie authentication and session lifecycle.
- [ ] Role-based authorization middleware.
