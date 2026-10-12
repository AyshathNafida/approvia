# Approvia intended architecture

Status: architecture from [requirements](PROJECT_REQUIREMENTS.md) sections 1, 23–26. A minimal React/TypeScript/Vite starter page, Vercel build configuration, and environment-configured Supabase browser client now exist. A read-only Auth settings check verified the supplied project URL/key. Database, storage, functions, login/account workflows, and approval workflows remain planned. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for verification and deployment status.

## Technology responsibilities

| Component | Intended technology | Conceptual responsibility |
|---|---|---|
| Frontend | React, TypeScript, Vite | Single login interface, account-specific dashboards, request creation, route selection, documents, tracking, approval UI, administration |
| Backend platform | Supabase | Platform for authentication, PostgreSQL data, file storage, and server-side logic |
| Database | PostgreSQL | Persistent institutional configuration, users/profiles, requests, workflow records, history, notifications, and academic-year data |
| Authentication | Supabase Auth | Authenticate users; account-type lookup determines dashboard access |
| Database authorization | PostgreSQL Row Level Security | Enforce authorized database access in addition to frontend/backend controls |
| File storage | Supabase Storage | Store supporting request documents with secure access |
| Business logic | Supabase Edge Functions; PostgreSQL Functions where appropriate | Server-side enforcement of request, workflow, assignment, approval, and administrative operations |
| Version control | Git, GitHub | Track source and changes; origin is configured for AyshathNafida/approvia |

These responsibilities describe the intended system, not selected APIs, exact function placement, or an application directory structure.

## Conceptual data flow

```text
Student / Faculty / Admin
  → React frontend
  → Supabase Auth (authentication)
  → Authorized data access and server-side operations
      → PostgreSQL + Row Level Security
      → Supabase Storage (supporting documents)
      → Workflow records, approval history, audit logs, notifications
```

The frontend collects user intent and displays authorized data. Authentication identifies the user; account type and applicable approval assignments govern access. Server-side business logic validates permissions and workflow behavior. The database maintains persistent records, with RLS enforcing database access.

This diagram leaves open which operations use Edge Functions, PostgreSQL Functions, or direct authorized Supabase access. It does not specify a network protocol, transaction boundary, or notification mechanism.

## Design requirements

- Keep institutional departments/classes and faculty assignments configurable. Route by responsibility and scope, without fixed individual faculty identities.
- Preserve sequential approval, request-type route validation, corrections, and history as described in [WORKFLOWS.md](WORKFLOWS.md).
- Maintain authorization, privacy, secure documents, and audit trails as described in [SECURITY.md](SECURITY.md).
- Design for maintainability, scalability, data integrity, changing authorities, future college-system integration, and expansion without major redesign.

The source does not select multi-institution tenancy, integration protocols, workload targets, hosting regions, or deployment environments. Do not infer those designs from the production objective.

## Implementation design still required

The physical schema and relationships, RLS policies, storage access policies, server-side interfaces, transaction/concurrency behavior, full frontend structure, and testing approach remain to be designed. The starter's npm commands and Vercel build settings are documented in [README.md](../README.md). Supabase and production operational configuration remain pending.

Before designing behavior affected by open product rules, consult [DECISIONS.md](DECISIONS.md). Track actual implementation progress in [PROJECT_STATUS.md](PROJECT_STATUS.md).
