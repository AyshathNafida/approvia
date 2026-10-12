# Approvia project status

Last updated: 2026-10-12 (Asia/Calcutta).

## Verified repository and backend state

The small working MVP (D10) is implemented: email/password login, session restoration/logout, active-profile gating, Student General Request title/description submission, class-resolved Tutor approve/reject with mandatory comment, and Student status/action-history tracking. Filters, refresh, loading/error/empty states, and responsive layouts are included.

The version-controlled migration supabase/migrations/202610120001_small_mvp.sql was applied manually through the approved SQL Editor flow to approvia-dev (cypcgwcmavauezmxdbgb). Eight tables, RLS, protected profile configuration, transactional submit/decision functions, approval-step snapshots, action history, and audit metadata exist. Direct browser writes are not granted; Admin has no request-content access. Private helper functions use an empty search path; only guarded public RPCs grant authenticated execution.

The user confirmed creating two existing Auth users. Approved setup created one Student profile, one Faculty/Tutor profile, one test department, and one test class. Passwords were not requested or changed. Setup scripts retain placeholder emails in Git.

Git origin is https://github.com/AyshathNafida/approvia.git on master. The supplied live URL is https://approviaproject.vercel.app/. Its existing email/password page was accessible and login configuration appeared available before this update. Deployment of the expanded MVP is still being verified.

## Approved scope

D10 expands authentication-only D9. General Request has one Tutor-only step, with the Tutor resolved/snapshotted at submission. Submission requires active student/class/department/faculty Tutor configuration and immediately enters In Review. Approved/Rejected are final with no edits after submission. Inactive users cannot act; pending requests assigned to inactive Tutors await future reassignment support.

D6–D8 remain institutional requirements. Public signup UI, automated invitations/provisioning, institutional-domain enforcement, recovery UI, documents, drafts, returns/resubmission, cancellation, notifications, additional approval levels, reports, and Admin screens are deferred. This is a development-test increment, not institutional production readiness.

## Verification performed

- 20 Vitest tests passed: seven mocked authentication tests, five mocked workspace tests, and eight actual PostgreSQL operation/RLS tests using isolated PGlite and a Supabase auth identity stub.
- Database tests cover submission/approval/rejection history and audits, Student/unrelated Faculty/Admin/unconfigured user isolation, denied direct writes/self-promotion, required comments, repeated decisions, assignment snapshots, inactive/missing/non-faculty Tutor configuration, inactive users, and anonymous access.
- TypeScript/production build and lint passed. Dependency installation reported zero vulnerabilities.
- Hosted database migration and test-profile setup returned success. The rolled-back hosted smoke transaction submitted as the Student identity, decided as the assigned Tutor identity, read Student history, and verified an unconfigured identity sees zero requests. Its synthetic request data was not retained. This exercises actual hosted RPC/RLS but does not test password login or browser session persistence.
- Earlier checks verified the captured original specification remains unchanged before appended approved amendments, and project documentation links/anchors/whitespace.

## Outstanding work

1. Verify that Vercel deploys this new commit, then complete Student → Tutor → Student testing with the user's privately held test credentials.
2. Extend meaningful tests when adding more workflows; real concurrency/load and comprehensive production security verification remain pending.
3. Before introducing Supabase CLI deployment automation, reconcile the manually applied baseline with migration history; do not rerun the initial migration on an existing schema.
4. Resolve remaining institutional workflow, identity, storage, retention, reporting, and first-Admin rules before dependent features.
5. Separate production data/environments and establish backups, monitoring, account lifecycle controls, and deployment operations before institutional use.

## Latest handoff: 2026-10-12

The user approved a small working MVP and simple workflow rules, provided the Vercel URL, supplied Student/Tutor development emails in that order, confirmed creating the Auth users, and approved applying the tested migration/profiles at the browser permission step. D10/D11 and MVP_SCOPE.md record this scope. Backend schema and test configuration are applied; frontend deployment verification is in progress. Do not describe mocked UI checks or SQL identity smoke checks as successful end-to-end password login.
