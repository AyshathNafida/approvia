# Approvia project status

Last updated: 2026-10-12 (user timezone: Asia/Calcutta).

## Verified repository state

The repository contains project context documentation and a React/TypeScript/Vite MVP email/password login at the repository root. It supports login for existing Supabase users, signed-in email confirmation, restored sessions, and logout on the current device. npm scripts provide development, TypeScript checking plus production build, linting with Oxlint, Vitest authentication tests, and build preview. A dependency lockfile and Vercel build configuration are included.

Git origin is configured as https://github.com/AyshathNafida/approvia.git. Initial commit `1b74e24` was pushed to `master` and its hash verified against the GitHub remote. Vercel hosting was selected by the user, who subsequently reported completing deployment; a successful hosted deployment has not been independently verified.

The Supabase JavaScript client is installed and initialized from public environment variables when available. The user's project `cypcgwcmavauezmxdbgb` accepted the provided publishable key through a read-only Auth settings request (HTTP 200). Actual URL/key values are stored in ignored `.env.local`, with blank placeholders in `.env.example`.

Authentication UI is implemented; institutional provisioning/invitations, recovery UI, email-domain/profile enforcement, role dashboards, physical database schema, migrations, RLS, approval engine, storage integration, and notifications remain unimplemented. The signed-in screen performs no application database queries and grants no institutional data access. Vercel environment configuration remains unverified.

## Completed work

- Preserved all 26 source requirement sections and created the project context foundation on 2026-10-09.
- Configured the GitHub remote and verified that the remote repository was empty.
- Added the official Vite React/TypeScript starter toolchain with an Approvia development notice.
- Added Vercel settings: framework Vite, root directory `.`, build command `npm run build`, output `dist`.
- Documented npm commands and deployment settings in README.md, and recorded the approved setup in DECISIONS.md.
- Ignored dependencies, build artifacts, local environment files, and Vercel metadata.
- Added the environment-configured Supabase browser client and a read-only local connection-check script; documented local and Vercel configuration.
- Implemented the user-requested authentication-only MVP (D9) and added seven mocked authentication tests.

## Outstanding work

1. Verify the updated Vercel deployment with both Supabase public variables. Prepare a development email/password user and verify live login, refresh, and logout; no real test credentials have been supplied.
2. Confirm accepted institutional email domains and first/additional Admin provisioning, then design Supabase account/login implementation against approved D6–D8; separate production data before institutional use.
3. Resolve dependent open questions before implementing workflow, identity, document, and access behavior.
4. Design the physical schema, migrations, RLS/storage policies, server operations, and application structure.
5. Implement and verify the student, faculty, and Admin capabilities, preserved history, and notifications.
6. Add meaningful database/policy/workflow tests as those features are implemented and select production operational configuration.

## Verification

Earlier documentation checks (2026-10-09): source copy matched the original doc.txt byte for byte; Markdown links/anchors and code fences were checked; requirement summaries were reviewed; whitespace checks passed.

Starter checks (2026-10-12): npm dependency installation reported zero vulnerabilities; `npm run build` passed TypeScript checking and the Vite production build; `npm run lint` passed. Relative Markdown file targets and staged Git whitespace checks passed. Database policies, application workflows, and a hosted Vercel deployment have not been tested.

## Latest handoff: 2026-10-12

MVP documentation links/anchors and Git whitespace checks passed after updating the scope and implemented-capability descriptions.

Latest increment: the user limited MVP work to easy email/password authentication. D9 records that scope. Login/logout, session restoration, clear error/loading states, password visibility, and a signed-in confirmation are implemented. Missing configuration disables login. Seven mocked Vitest tests passed, covering successful login, invalid credentials, network errors, restored sessions/logout, logout failure, a session-restoration race, and missing configuration. TypeScript/production build and lint passed. Desktop login layout was inspected in the local browser. No real-user login, reload persistence against Supabase, hosted deployment, or institutional permissions were verified. The test runner required sandbox escalation after a temporary-file permission failure; the rerun passed.

The user explicitly approved all three account/access choices on 2026-10-12: Admin invitations with verified institutional email and email/password/recovery; faculty-only approval authority; restricted student/faculty/Admin read permissions. D6–D8 record the decisions. ACCOUNT_ACCESS_PLAN.md now separates approved policies from additional setup proposals; requirements amendments preserve the original specification and explicitly supersede the section 6.3 Admin exception. AGENTS.md and account/security/workflow topic documents reflect the choices. Accepted email domains, first/additional Admin provisioning, report/audit fields and retention, and other workflow questions remain open. No login, schema, or authorization implementation was added in that earlier documentation pass.

Decision documentation verification: relative Markdown links/anchors and Git whitespace checks passed. Compared the captured specification to its previous Git version (normalizing line endings) and verified the original text remains unchanged before appended amendments. Checked affected documents for stale unresolved-Q1/proposal statements. No application tests were run for this documentation-only change.

Supabase setup checks (2026-10-12): read-only Auth settings request returned HTTP 200 with the supplied publishable key; dependency installation reported zero vulnerabilities; `npm run build`, `npm run lint`, and `git diff --check` passed after integration. `git check-ignore .env.local` confirmed that local project configuration is excluded from commits. No login, database, or hosted Vercel checks were performed.

The user agreed to create, build, commit, and push a React/TypeScript/Vite starter to resolve Vercel's empty repository error, then requested Supabase connection and supplied a publishable key. The project reference was taken from the open Supabase dashboard URL and URL/key compatibility verified. Keep the captured specification intact and all unresolved product rules open. The starter and client setup are a deployment foundation, not a completed institutional application.

For Vercel import, select `master`, framework Vite, root `.`, build `npm run build`, output `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel and redeploy. The connection-check script uses ignored local configuration and does not create accounts or modify remote data. Login, schema, RLS, and workflow implementation are next steps after the necessary decisions.
