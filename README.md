# Approvia

Approvia is a centralized digital approval management system for educational institutions. It replaces paper-based and fragmented approvals with requests, configurable routes, automatic authority resolution, supporting documents, sequential decisions, status tracking, notifications, and audit history.

The goal is real deployment in a college, with security, data integrity, maintainability, scalability, and configurable institutional structure.

## Current state

Approvia's deployed test MVP supports Supabase email/password login, student General Request submission, class-resolved Tutor approve/reject with comment, and student status/history tracking. Its Admin increment adds departments, four-year class batches, existing confirmed-user profiles, guarded placement/status controls, scoped faculty assignments, and audited pending Tutor reassignment. The hosted migration and first Admin bootstrap are applied, the frontend is live, and the user confirmed Admin login/dashboard access in Chrome. Local tests, hosted RPC/RLS smoke, and a two-session write-gate check passed. Full browser role-switching/reassignment acceptance and broader concurrency/load checks remain future verification. PostgreSQL profiles, RLS policies, and guarded transactional functions control access. Documents, notifications, returns, cancellation, and additional approval levels remain future work. See [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for verified progress and limits.

## Start here

For a new coding chat, use this repository as the workspace and have the agent read [AGENTS.md](AGENTS.md). It directs agents to this introduction, current status, decisions, and the documents relevant to their task. The same documents can be read directly in any chat that has access to these files.

| Document | Contents |
|---|---|
| [AGENTS.md](AGENTS.md) | Agent reading order, project constraints, and context maintenance |
| [PROJECT_REQUIREMENTS.md](docs/PROJECT_REQUIREMENTS.md) | Complete captured specification, all 26 source sections |
| [DOMAIN_MODEL.md](docs/DOMAIN_MODEL.md) | Conceptual institutional, user, request, and history entities |
| [WORKFLOWS.md](docs/WORKFLOWS.md) | Login, requests, routing, decisions, returns, and tracking |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Intended stack and conceptual component responsibilities |
| [SECURITY.md](docs/SECURITY.md) | Authorization, request privacy, document handling, and audits |
| [DECISIONS.md](docs/DECISIONS.md) | Established requirements, documentation choices, and open questions |
| [ACCOUNT_ACCESS_PLAN.md](docs/ACCOUNT_ACCESS_PLAN.md) | Approved provisioning, login, and visibility rules plus remaining setup proposals |
| [MVP_SCOPE.md](docs/MVP_SCOPE.md) | Approved smaller end-to-end approval MVP and testing scope |
| [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Verified progress, outstanding work, and latest handoff |
| [ADMIN_SETUP.md](docs/ADMIN_SETUP.md) | Admin increment, guarded assignments/reassignment, owner rollout, and acceptance checks |
| [INSTITUTIONAL_ROUTING_PLAN.md](docs/INSTITUTIONAL_ROUTING_PLAN.md) | Cohort/authority routing proposal and approved D12/D13 rules |

## Core model

Account types (`STUDENT`, `FACULTY`, `ADMIN`) determine basic access. Approval responsibilities (`TUTOR`, `HOD`, `DEAN`, `PRINCIPAL`) identify institutional authority separately from account type.

Students select permitted responsibilities rather than individual faculty. Approvia resolves Tutor through class assignment, HOD through department assignment, and Dean/Principal through institution-level assignments. Selected routes follow the hierarchy and request-type rules.

Departments, classes, faculty assignments, request types, and workflow rules are maintained through authorized administration. Approval and audit history must be preserved.

## Intended technology

| Area | Planned technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend platform and database | Supabase, PostgreSQL |
| Authentication | Supabase Auth |
| Database authorization | PostgreSQL Row Level Security |
| File storage | Supabase Storage |
| Server-side business logic | Supabase Edge Functions; PostgreSQL Functions where appropriate |
| Version control | Git, GitHub |

The frontend uses npm. After cloning, run `npm ci`, then `npm run dev` for development. Run `npm run build` for TypeScript checking and a production build, `npm run lint` for linting, `npm run test` for Vitest tests, and `npm run preview` to serve the build locally. Tests include mocked authentication/workspace UI checks and actual PostgreSQL operations/RLS checks in isolated PGlite with a Supabase auth identity stub. They do not replace real hosted login verification.

## Frontend deployment

Vercel is the selected frontend host. Import the GitHub repository and select the pushed branch. Use framework **Vite**, root directory **.**, build command **npm run build**, and output directory **dist**. The repository includes `vercel.json` with these build settings.

To enable login, copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using the project's Connect dialog. Restart the development server after changing these values. Without configuration, login is disabled with an availability message. Never expose server secrets in frontend variables. Local `.env` files and Vercel metadata are ignored by Git.

In Vercel, add the same two variables in Project Settings → Environment Variables for the environments intended to use this Supabase project, then redeploy. Vite embeds these public values during the build. Keep development and production data separate before institutional use.

Run `node scripts/check-supabase.mjs` to verify the configured local URL/key through a read-only Auth settings request. A successful response verifies reachability and key acceptance; it does not verify login, database permissions, or approval workflows.

## MVP setup and verification

The current development database is approvia-dev (`cypcgwcmavauezmxdbgb`). Its initial schema was applied manually through the approved SQL Editor flow. On a new empty test project, apply [202610120001_small_mvp.sql](supabase/migrations/202610120001_small_mvp.sql) once as the project owner. Prepare two existing, email-confirmed Auth users and use [setup-test-users.example.sql](supabase/setup-test-users.example.sql) with their emails to create the test profiles/class. Never rerun the initial migration over an existing schema. Before adopting automated Supabase CLI migrations, reconcile this manually applied baseline with migration history.

Use the Student account to submit a request; sign out, use the Tutor account to approve/reject with a comment, then sign back in as Student to view the decision/history. Refresh to verify persistence. Unprovisioned users receive setup guidance; inactive users are blocked; Admin accounts receive no request contents or approval UI. Credentials stay private. Public signup UI, invitation/account management, and recovery UI are not included. A safe owner-side hosted database check is provided in [hosted-smoke.sql](supabase/tests/hosted-smoke.sql); it uses authenticated-role identities and rolls back synthetic request data.

## Source and decision status

For the new Admin increment, follow [ADMIN_SETUP.md](docs/ADMIN_SETUP.md). Preserve a private pre-change snapshot, inspect the manual baseline, apply the new migration once as owner, bootstrap the first dedicated confirmed Admin login, and only then deploy the updated frontend. Never rerun the initial migration over the existing development database. Test-only existing login provisioning does not replace future institutional invitations/email-domain enforcement. HOD/Dean/Principal assignments do not yet enable multi-level approvals.

[PROJECT_REQUIREMENTS.md](docs/PROJECT_REQUIREMENTS.md) preserves the full contents of `C:/Users/mahmo/Desktop/approvia/doc/doc.txt`, captured on 2026-10-09. The original file was left unchanged. The repository copy makes future chats independent of that desktop path.

Topic documents summarize the source and label examples and planned architecture. [DECISIONS.md](docs/DECISIONS.md) records unresolved rules rather than choosing answers. Later user-approved changes must be recorded there and reflected in the affected documentation.
