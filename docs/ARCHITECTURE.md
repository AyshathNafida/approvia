# Approvia intended architecture

Status: architecture from [requirements](PROJECT_REQUIREMENTS.md) sections 1, 23–26, with approved small test MVP D10. React/TypeScript/Vite, Supabase Auth, protected account profiles, General Request submission, Tutor decisions, and status/history UI are implemented. Eight PostgreSQL tables, RLS, and transactional submit/decision functions were applied to approvia-dev. Storage, automated account provisioning, additional approval levels, and other institutional capabilities remain planned. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for verification and deployment status.

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

## Implemented small MVP boundaries

The frontend uses src/lib/requests.ts for permitted queries and RPC calls. public.submit_request validates student/class/department/type/Tutor configuration and snapshots the resolved approval step. public.decide_request checks active faculty assignment, locks the request/step, and atomically records the final status, comment history, and audit metadata. Clients have SELECT privileges only on application tables; all writes use the guarded functions. approvia_private helpers avoid recursive RLS and are not exposed as API RPCs.

The eight tables are profiles, departments, classes, request_types, requests, approval_steps, request_actions, and audit_logs. Backend identities are configured data, not hard-coded faculty IDs. Only the approved Tutor route is supported by this migration; additional routes require later migrations and workflow decisions. The baseline was applied manually through SQL Editor; reconcile migration history before introducing CLI deployment automation.

## Remaining design

Schema/RLS extensions for deferred entities, storage access policies, additional server interfaces, multi-level concurrency behavior, Admin UI, and broader testing remain to be designed. npm commands and Vercel build settings are documented in [README.md](../README.md). Production operational configuration remains pending.

Before designing behavior affected by open product rules, consult [DECISIONS.md](DECISIONS.md). Track actual implementation progress in [PROJECT_STATUS.md](PROJECT_STATUS.md).
