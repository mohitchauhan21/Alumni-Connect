# P11 — Verified Alumni Mentorship Matching and Engagement Platform

## System Architecture and Engineering Documentation

---

## 1. Project Purpose and Vision

The **P11 Verified Alumni Mentorship Matching and Engagement Platform** is an institutional software solution created to bridge the gap between undergraduate students and verified university alumni. Unlike open commercial platforms or unstructured networking forums, P11 enforces institutional credential verification, transparent explainable mentor-mentee matching, structured engagement tracking (goals, action items, feedback), and strict privacy boundaries.

---

## 2. Technology Stack & Decision Rationale

| Layer                  | Technology                        | Selection Rationale                                                                       |
| :--------------------- | :-------------------------------- | :---------------------------------------------------------------------------------------- |
| **Monorepo Engine**    | npm workspaces                    | Native cross-platform workspace management without third-party monorepo lock-in.          |
| **Frontend Framework** | Next.js (App Router, React 19)    | Server-side rendering, SEO metadata, streaming UI, robust routing.                        |
| **Frontend Styling**   | Tailwind CSS v3 + CSS Variables   | High performance, zero runtime style injection, tokenized university theme.               |
| **UI Components**      | shadcn/ui design patterns         | Accessible, headless primitives styled with Tailwind, full ownership of code.             |
| **Backend Framework**  | Node.js + Express.js + TypeScript | High throughput, asynchronous I/O, clean middleware architecture.                         |
| **Database**           | MongoDB Atlas / MongoDB           | Document flexibility for alumni credentials, preference trees, and audit trails.          |
| **ODM**                | Mongoose                          | Strict schema validation, lifecycle middleware, strongly typed data models.               |
| **Validation**         | Zod                               | Single source of truth for runtime environment validation and request schema enforcement. |
| **Security Headers**   | Helmet                            | Enforces HTTP security headers (CSP, HSTS, X-Content-Type-Options, etc.).                 |
| **Logging**            | Pino + pino-http                  | High-performance structured JSON logging with automated PII redaction.                    |
| **Testing**            | Vitest + Supertest + RTL          | Fast native ESM test runner with jsdom and API integration capabilities.                  |

---

## 3. High-Level Architecture Diagram

```mermaid
graph TD
    subgraph Client ["Frontend: Next.js (Port 3000)"]
        UI[App Router & Tailwind UI]
        Forms[React Hook Form + Zod]
        State[Local / Auth State]
    end

    subgraph SecurityBoundary ["Security & Network Boundary"]
        CORS[CORS Policy & Helmet Headers]
        ReqId[X-Request-Id Correlation]
        Redact[Pino Redaction Filter]
    end

    subgraph Backend ["Backend: Express.js (Port 5000)"]
        App[Express Pipeline]
        Health[Health & Readiness Module]
        FutureAuth[Auth & RBAC Module (Phase 2)]
        FutureMatch[Explainable Matcher (Phase 4)]
        FutureModules[Alumni, Students, Scheduling Modules]
    end

    subgraph Storage ["Data Tier"]
        MongoAtlas[(MongoDB Atlas / Local DB)]
    end

    UI -->|HTTP / JSON / Credentials| CORS
    Forms -->|Validated Payloads| CORS
    CORS --> ReqId
    ReqId --> Redact
    Redact --> App
    App --> Health
    App --> FutureAuth
    App --> FutureMatch
    App --> FutureModules
    Health -->|State Probe| MongoAtlas
    FutureModules -->|Mongoose Queries| MongoAtlas
```

---

## 4. Monorepo Organization

```
p11-mentorship-platform/
├── client/                     # Next.js App Router frontend application
│   ├── public/                 # Static public assets
│   ├── src/
│   │   ├── app/                # Next.js pages & layouts (/, /login, /register)
│   │   ├── components/
│   │   │   ├── layout/         # Navbar, Footer, Container
│   │   │   └── ui/             # Button, Input, Label, Card, Badge, Alert, Spinner
│   │   ├── lib/                # Utility helpers (cn, formatters)
│   │   ├── test/               # Frontend smoke tests & setup
│   │   ├── hooks/              # Custom React hooks (future)
│   │   └── types/              # Client-side type definitions
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.ts
│
├── server/                     # Express.js REST API backend application
│   ├── src/
│   │   ├── config/             # Environment, Database, Logger configuration
│   │   ├── middleware/         # Error handler, 404 handler, Request ID
│   │   ├── modules/            # Encapsulated feature domains
│   │   │   ├── health/         # Liveness & Readiness checks
│   │   │   └── README.md       # Specification for Phase 2+ domain modules
│   │   ├── app.ts              # Express application assembly & middleware
│   │   └── server.ts           # Database connection & HTTP listener entrypoint
│   ├── tests/                  # Supertest integration tests & redaction tests
│   ├── package.json
│   └── tsconfig.json
│
├── docs/
│   └── ARCHITECTURE.md         # Complete system architecture documentation
├── .env.example                # Configuration template with placeholders
├── .gitignore                  # Git exclusion rules
├── .nvmrc                      # Node.js LTS version specification
├── .prettierrc.json            # Code formatting conventions
├── package.json                # Root workspaces and orchestration scripts
└── README.md                   # Getting started and setup guide
```

---

## 5. Frontend / Backend Communication Strategy

1. **API Endpoints**: All backend endpoints are exposed under `/api/v1/*`.
2. **Transport**: JSON payloads over HTTP/HTTPS with strict `Content-Type: application/json` headers.
3. **CORS Protocol**:
   - `Access-Control-Allow-Origin` is explicitly restricted to `CLIENT_URL` (e.g., `http://localhost:3000`).
   - Wildcards (`*`) are disallowed.
   - `credentials: true` is enabled to support HTTP-only session cookies.
4. **Correlation Tracing**:
   - `requestIdMiddleware` assigns a UUIDv4 to incoming requests.
   - Returned in the response header `X-Request-Id` for debugging.

---

## 6. Authentication, Authorization & Security Architecture

### Authentication Model

- **Token Delivery**: JSON Web Tokens (JWT) stored exclusively in **HTTP-only, SameSite=Lax, Secure** cookies.
- **Client Storage Policy**: Tokens are **never** stored in `localStorage`, `sessionStorage`, or JavaScript memory variables.
- **Password Protection**: Passwords hashed using `bcryptjs` with salt work factor $\ge 10$.

### Five-Tier Role-Based Access Control (RBAC)

The platform defines five distinct institutional roles:

1. **Student**: Public registration permitted. Can build career profiles, request mentorship, track sessions and milestones.
2. **Alumni / Mentor**: Public registration permitted. Requires institutional verification by an officer before becoming searchable or active.
3. **Alumni Relations Officer**: Internal administrative role. Reviews graduation proof, reconciles university ERP/CSV records, approves mentor verifications.
4. **Placement Officer**: Read-only reporting access. Reviews participation statistics and aggregate engagement without modifying mentor profiles.
5. **Platform Administrator**: System configuration, role elevation, and audit inspection.

> [!IMPORTANT]
> Public self-registration is strictly restricted to **Student** and **Alumni** roles. Administrative or Officer privileges can only be provisioned by existing Administrators.

### Sensitive Data Protection & DTO Projection

- Alumni personal phone numbers and direct email addresses are classified as **Restricted PII**.
- Student-facing endpoints will **never** return raw Mongoose documents.
- Explicit DTO whitelists project only approved fields (Full Name, Graduation Year, Degree, Industry, Current Role, Bio, Availability Slots).
- Privileged access to contact details requires an active, accepted mentorship agreement.

---

## 7. Structured Logging & Privacy Redaction

Pino is configured with high-performance serialization and automated field masking:

1. **Redacted Targets**:
   - `req.headers.authorization`
   - `req.headers.cookie`
   - `password`, `*.password`
   - `email`, `*.email`
   - `phone`, `*.phone`
   - Database connection URIs (credentials masked via `sanitizeMongoUri`).
2. **Payload Protection**:
   - Request bodies are not logged in bulk.
   - Query strings are stripped of raw sensitive tokens.
3. **Environments**:
   - In `development`: Human-friendly formatted output via `pino-pretty`.
   - In `production`: High-efficiency structured JSON streams suitable for cloud ingest.
   - In `test`: Silenced to prevent cluttering test output.

---

## 8. Database Architecture & MongoDB Strategy

- **Primary Storage**: MongoDB Atlas cloud cluster.
- **Local Alternative**: Local MongoDB instance (`mongodb://127.0.0.1:27017/p11_mentorship`) supported out-of-the-box.
- **Lifecycle Management**:
  - `connectDatabase()` handles initial handshake, connection pooling, and auto-reconnect listeners.
  - Initial connection failure enters a graceful degraded mode so readiness probes accurately report `503 Service Unavailable`.
  - Application shutdown safely terminates Mongoose connection pool.

---

## 9. Testing Strategy

| Suite                   | Scope                                           | Framework            | Execution Command                     |
| :---------------------- | :---------------------------------------------- | :------------------- | :------------------------------------ |
| **Backend Integration** | Health, readiness, 404, safe error handling     | Vitest + Supertest   | `npm run test:run --workspace=server` |
| **Backend Security**    | Log redaction, URI sanitization                 | Vitest               | `npm run test:run --workspace=server` |
| **Frontend Smoke**      | Landing page rendering, UI elements, navigation | Vitest + RTL + jsdom | `npm run test:run --workspace=client` |
| **Type Integrity**      | Strict TypeScript check across entire monorepo  | tsc --noEmit         | `npm run typecheck`                   |

---

## 10. Implementation Status & Phase Roadmap

|    Phase    | Milestone                         | Scope / Components                                                                                  |    Status    |
| :---------: | :-------------------------------- | :-------------------------------------------------------------------------------------------------- | :----------: |
| **Phase 1** | **Project Foundation**            | Monorepo structure, Express API, Next.js UI, security headers, health check, logging, documentation | **COMPLETE** |
| **Phase 2** | **Authentication & RBAC**         | User model, JWT cookie sessions, bcrypt hashing, role authorization middleware, AuthContext         | **COMPLETE** |
| **Phase 3** | **Alumni Verification (M1)**      | CSV/ERP graduate matching, manual review officer dashboard, verification status                     | **COMPLETE** |
| **Phase 4** | **Profiles & Capacity (M2, M3)**  | Student career profiles, alumni capacity quotas, availability scheduling slots                      |  _Planned_   |
| **Phase 5** | **Explainable Matching (M4)**     | Transparent rule-weighted scoring algorithm (no black-box AI), match explanations                   |  _Planned_   |
| **Phase 6** | **Mentorship Workflows (M5, M6)** | Requests, acceptance/rejection, `.ics` calendar generation, session tracking                        |  _Planned_   |
| **Phase 7** | **Goals & Analytics (M7, M10)**   | Milestones, action items, feedback rubrics, Placement Officer reporting                             |  _Planned_   |

---

## 11. Phase 3 Architecture: Institutional Verification & Officer Workflow

### 11.1 Verification Lifecycle & State Machine
Verification status is decoupled from the `User` account status (`active`, `disabled`, `suspended`):
- `not_submitted`: Initial default for registered alumni.
- `pending`: Submission received with deterministic matching executed; awaiting officer review.
- `verified`: Approved by officer; locks official record claim and activates verified alumni features.
- `rejected`: Rejected by officer with mandatory reason; alumnus may correct details and resubmit.

```mermaid
stateDiagram-v2
    [*] --> NotSubmitted
    NotSubmitted --> Pending: Alumni submits credentials
    Pending --> Verified: Officer approves match
    Pending --> Rejected: Officer rejects with reason
    Rejected --> Pending: Alumni resubmits corrected details
    Verified --> [*]
```

### 11.2 Deterministic Matching Engine
Zero black-box AI or LLM heuristics. Match evaluation is transparent and reproducible:
1. Exact match on normalized primary key: `alumni_id` (`UPPERCASE`, trimmed).
2. Primary identity consistency: normalized `institutional_email` (`lowercase`, trimmed).
3. Cross-field consistency checks: `graduation_year` (exact integer), `programme`, `department`.
4. Claim status check: prevents duplicate claims on the same institutional record.
5. Matching outcomes: `matched`, `unmatched`, `conflict`. All outcomes require explicit officer review.

### 11.3 Two-Stage CSV Import Pipeline
1. **Preview (`/records/import/preview`)**: In-memory parsing via streaming `csv-parse`, strict lowercase header validation (`alumni_id,full_name,institutional_email,programme,department,graduation_year`), row formatting check, in-file duplicate detection, and non-mutating claim conflict detection against existing records.
2. **Confirm (`/records/import`)**: Idempotent bulk upsert via `bulkWrite` using `$set` on details and `$setOnInsert` for claim state (`isClaimed: false`), preserving existing claimed associations.

### 11.4 Append-Only Audit Trail
Every verification lifecycle event (`VERIFICATION_SUBMITTED`, `VERIFICATION_RESUBMITTED`, `VERIFICATION_APPROVED`, `VERIFICATION_REJECTED`, `RECORDS_IMPORTED`) writes an unalterable log in `AuditLog` capturing actor ID, actor role, entity ID, request ID, timestamp, and metadata.
