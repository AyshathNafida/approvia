# Approvia: agent context

Approvia is an institutional digital approval management system for educational institutions. Students submit requests through permitted approval routes; assigned faculty process them sequentially, with status tracking, supporting documents, notifications, and preserved history.

## Read at the start of a chat

1. Read [README.md](README.md) for the project introduction and documentation index.
2. Read [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for verified progress and the latest handoff.
3. Read the relevant topic documents below and their linked requirements before working on that area.
4. Check [DECISIONS.md](docs/DECISIONS.md) for unresolved questions and any subsequently agreed decisions.

| Work area | Context |
|---|---|
| Product scope and requirements | [PROJECT_REQUIREMENTS.md](docs/PROJECT_REQUIREMENTS.md) |
| Institutional structure, accounts, and entities | [DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) |
| Request lifecycle and approval routing | [WORKFLOWS.md](docs/WORKFLOWS.md) |
| Technology and component boundaries | [ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Permissions, documents, and audit history | [SECURITY.md](docs/SECURITY.md) |

## Requirements and constraints

- [PROJECT_REQUIREMENTS.md](docs/PROJECT_REQUIREMENTS.md) is the canonical captured specification. Other documents summarize it. Record later user-approved changes explicitly in [DECISIONS.md](docs/DECISIONS.md) and update affected requirements; do not silently rewrite project intent.
- Account types are `STUDENT`, `FACULTY`, and `ADMIN`. Approval responsibilities are `TUTOR`, `HOD`, `DEAN`, and `PRINCIPAL`; they are separate concepts.
- Faculty can hold one or more approval responsibilities. Only FACULTY accounts may approve; ADMIN accounts cannot hold approval responsibilities (user-approved Q1 resolution on 2026-10-12).
- Accounts use Admin invitations after institutional record checks, verified institutional email, email/password login, and email recovery; no public signup. Follow the approved read boundaries in docs/ACCOUNT_ACCESS_PLAN.md.
- The deployed test MVP (D10, expanding D9) has a General Request title/description form, fixed class-resolved Tutor step, approve/reject with mandatory comment, and status/history tracking. D14 adds locally implemented Admin setup, four-year class batches, existing confirmed test-login profile provisioning, guarded membership/status controls, scoped faculty assignments, and explicit audited transfer of pending Tutor reviews. Hosted D14 rollout status is in PROJECT_STATUS.md; do not assume it is applied. Profiles and RLS gate access; an Auth session alone grants no request access. Processing remains Tutor-only, In Review → Approved/Rejected, with no post-submission edits. Invitations/recovery UI, institutional-domain enforcement, yearly progression, multi-level approvals, documents, returns, cancellation, and notifications remain deferred.
- Departments and classes/divisions are configurable data. Each student belongs to one active class/division; each class batch keeps one Tutor through its four-year course (D12). D14 Admin replacement transfers pending class reviews with history; completed decisions/reviewers stay unchanged.
- Resolve Tutor from the student's class, HOD from the student's department, and Dean/Principal from institution-level assignments. Never hard-code faculty identities into workflows or require students to select individual approvers.
- Validate routes before submission against the institutional hierarchy and request-type rules; students cannot bypass mandatory authorities. D13 permits configured higher-level routes; class events require Tutor/HOD and college events require Dean/Principal. Complete routes and runtime referral remain unresolved and unimplemented.
- Preserve approval/action history, including after corrections and resubmission. Audit significant system actions.
- Enforce authorization in the frontend and backend, with PostgreSQL Row Level Security for database authorization. Faculty may process only requests assigned to them under their responsibilities.
- The intended stack is React, TypeScript, Vite, Supabase, PostgreSQL, Supabase Auth/Storage, and Supabase Edge Functions/PostgreSQL Functions where appropriate.
- This is intended for institutional production deployment. Do not describe planned capabilities as implemented or verified.

## Working with incomplete decisions

Read the relevant open question in [DECISIONS.md](docs/DECISIONS.md). Ask the user before implementing behavior that depends on an unresolved product rule. Continue independent work where possible. Do not turn examples into mandatory request types, schemas, identifiers, or configuration values.

These files establish the project context. The MVP and local Admin increment have concrete migrations, RPCs, React workspaces, Vercel settings, and Vitest/PGlite checks. Inspect actual repository state and README before choosing commands; do not invent setup/test commands or assume deferred schema/workflow designs are finalized. Read [ADMIN_SETUP.md](docs/ADMIN_SETUP.md) before Admin rollout; never rerun an applied migration.

## Keep the context current

- After material work, update [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) with what changed, what remains, verification performed, and a dated handoff.
- Update topic documents and requirements affected by approved changes. Record user-agreed decisions and their rationale in [DECISIONS.md](docs/DECISIONS.md).
- Keep requirements, examples, proposed designs, verified implementation, and unresolved questions clearly labeled. Include source section references when summarizing requirements.
- Validate links and consistency when changing documentation. Record checks actually performed; do not report future checks as completed.

## D15 workflow extension (2026-10-14)

D15 approves typed General/Leave/Duty Leave/Event/Facility/Internship requests, fixed scope-based multi-step routes, structured fields, distinct Faculty per required role, immediate rejection and skipped steps, full submission snapshots, scoped current/future step transfer for all responsibilities, and current-holder access to final predecessor-reviewed requests in the saved scope. Read docs/REQUEST_WORKFLOWS.md before changing this area and PROJECT_STATUS.md for actual hosted rollout. This supersedes earlier Tutor-only constraints and expands D8 archive visibility; Admin still cannot read private request content. Do not infer custom routes, referral, attachments, group requests or editable submissions.
