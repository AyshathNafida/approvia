# Approvia

Approvia is a centralized digital approval management system for educational institutions. It replaces paper-based and fragmented approvals with requests, configurable routes, automatic authority resolution, supporting documents, sequential decisions, status tracking, notifications, and audit history.

The goal is real deployment in a college, with security, data integrity, maintainability, scalability, and configurable institutional structure.

## Current state

This repository contains the project context documentation and a minimal React/TypeScript/Vite starter page. Authentication, database, approval workflows, and supporting services are not implemented. See [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for verified progress.

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
| [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Verified progress, outstanding work, and latest handoff |

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

The frontend starter uses npm. After cloning, run `npm ci`, then `npm run dev` for development. Run `npm run build` for TypeScript checking and a production build, `npm run lint` for linting, and `npm run preview` to serve the build locally. No automated application test suite has been selected yet.

## Frontend deployment

Vercel is the selected frontend host. Import the GitHub repository and select the pushed branch. Use framework **Vite**, root directory **.**, build command **npm run build**, and output directory **dist**. The repository includes `vercel.json` with these build settings.

The starter remains available without environment variables. To enable the Supabase client, copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` using the project's Connect dialog. Restart the development server after changing these values. The client is `null` when configuration is missing; feature code must handle this before querying Supabase. Never expose server secrets in frontend variables. Local `.env` files and Vercel metadata are ignored by Git.

In Vercel, add the same two variables in Project Settings → Environment Variables for the environments intended to use this Supabase project, then redeploy. Vite embeds these public values during the build. Keep development and production data separate before institutional use.

Run `node scripts/check-supabase.mjs` to verify the configured local URL/key through a read-only Auth settings request. A successful response verifies reachability and key acceptance; it does not verify login, database permissions, or approval workflows.

## Source and decision status

[PROJECT_REQUIREMENTS.md](docs/PROJECT_REQUIREMENTS.md) preserves the full contents of `C:/Users/mahmo/Desktop/approvia/doc/doc.txt`, captured on 2026-10-09. The original file was left unchanged. The repository copy makes future chats independent of that desktop path.

Topic documents summarize the source and label examples and planned architecture. [DECISIONS.md](docs/DECISIONS.md) records unresolved rules rather than choosing answers. Later user-approved changes must be recorded there and reflected in the affected documentation.
