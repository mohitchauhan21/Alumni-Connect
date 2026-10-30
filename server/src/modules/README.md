# Backend Modules Architecture

This directory houses the domain modules for the P11 Verified Alumni Mentorship Matching and Engagement Platform.

Each module follows a modular, encapsulated structure with clear boundaries:

```
module-name/
├── [module].model.ts       # Mongoose schemas, indexes, and validation
├── [module].controller.ts  # HTTP request/response handlers
├── [module].service.ts     # Business logic and database operations
├── [module].validation.ts  # Zod validation schemas for requests
├── [module].router.ts      # Express route definitions
└── [module].types.ts       # TypeScript interfaces and DTOs
```

## Planned Modules

1. **`health`**: (Implemented) Service readiness, liveness, and connectivity monitoring.
2. **`auth`**: JWT cookie-based authentication, bcrypt hashing, password reset.
3. **`users`**: Core user accounts and roles (Student, Alumni, Officers, Admin).
4. **`alumni`**: Verified alumni profiles, professional backgrounds, industry tags.
5. **`students`**: Student career profiles, target domains, mentorship preferences.
6. **`verification`**: Institutional verification records, ERP/CSV matching, audit trails.
7. **`capacity`**: Alumni mentee capacity, availability calendar, concurrency-safe quotas.
8. **`matching`**: Transparent explainable rule-weighted matching engine (no black-box AI).
9. **`mentorship`**: Mentorship applications, request limits, acceptance/decline workflows.
10. **`scheduling`**: Session booking, `.ics` calendar generation, status tracking.
11. **`goals`**: Milestones, action items, progress updates.
12. **`feedback`**: Structured session feedback, rating rubrics, quality flags.
13. **`analytics`**: Program metrics, participation rates (read-only for Placement Officers).
14. **`audit`**: Security events, role changes, verification decisions logging.
15. **`notifications`**: In-app and email status notifications.

## Engineering Rules for Modules

- **Data Privacy & DTOs**: Never return raw Mongoose documents. Use explicit DTO projection to exclude sensitive alumni contact details (phone, personal email) from unauthorized student-facing endpoints.
- **Validation**: Every mutation endpoint MUST validate input via Zod schemas in middleware.
- **Role Authorization**: Authorization checks must be strictly enforced on the server-side via role-checking middleware.
