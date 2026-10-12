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
- Current MVP increment (D9) implements only email/password login, signed-in confirmation, session restoration, and logout for existing Supabase users. Invitations/recovery UI, domain/profile enforcement, and role access are deferred; an Auth session alone grants no institutional data access.
- Departments and classes/divisions are configurable data. Each student belongs to one active class/division; each class has one assigned tutor.
- Resolve Tutor from the student's class, HOD from the student's department, and Dean/Principal from institution-level assignments. Never hard-code faculty identities into workflows or require students to select individual approvers.
- Validate routes before submission against the institutional hierarchy and request-type rules; students cannot bypass mandatory authorities. Skipped-level policy remains unresolved.
- Preserve approval/action history, including after corrections and resubmission. Audit significant system actions.
- Enforce authorization in the frontend and backend, with PostgreSQL Row Level Security for database authorization. Faculty may process only requests assigned to them under their responsibilities.
- The intended stack is React, TypeScript, Vite, Supabase, PostgreSQL, Supabase Auth/Storage, and Supabase Edge Functions/PostgreSQL Functions where appropriate.
- This is intended for institutional production deployment. Do not describe planned capabilities as implemented or verified.

## Working with incomplete decisions

Read the relevant open question in [DECISIONS.md](docs/DECISIONS.md). Ask the user before implementing behavior that depends on an unresolved product rule. Continue independent work where possible. Do not turn examples into mandatory request types, schemas, identifiers, or configuration values.

These files establish a context foundation. No detailed schema, API contract, application layout, deployment setup, or testing toolchain has been selected. Inspect actual repository state before choosing commands; do not invent setup or test commands.

## Keep the context current

- After material work, update [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) with what changed, what remains, verification performed, and a dated handoff.
- Update topic documents and requirements affected by approved changes. Record user-agreed decisions and their rationale in [DECISIONS.md](docs/DECISIONS.md).
- Keep requirements, examples, proposed designs, verified implementation, and unresolved questions clearly labeled. Include source section references when summarizing requirements.
- Validate links and consistency when changing documentation. Record checks actually performed; do not report future checks as completed.
