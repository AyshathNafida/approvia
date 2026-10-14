# Approvia project status

Last updated: 2026-10-14 (Asia/Calcutta).

## Deployed MVP and Admin increment

The deployed small working MVP (D10/D11) supports email/password login, session restoration/logout, active-profile gating, Student General Request title/description submission, class-resolved Tutor approve/reject with mandatory comment, and Student status/action-history tracking. Filters, refresh, loading/error/empty states, and responsive layouts are included. On 2026-10-14 the user confirmed that it works at https://approviaproject.vercel.app/. This is user-reported live verification, not an independently repeated password-login test.

The new D14 increment is implemented, tested, and deployed: protected Admin workspace; departments; four-year class batches; existing confirmed Student/Faculty login provisioning; guarded placement/status changes; Tutor/HOD/Dean/Principal assignments; and atomic pending Tutor transfer with preserved reassignment history. The same login selects the Admin workspace from the protected profile. HOD/Dean/Principal assignments are configuration only, not multi-level processing. User confirmed Admin password login/dashboard access in Chrome on 2026-10-14; this is user-reported browser verification rather than agent-observed Chrome interaction.

The new migration is supabase/migrations/202610140001_admin_setup.sql. It preserves the initial migration, adds three tables and batch/request class-snapshot fields, and retains classes.tutor_id as the current Tutor source. New Admin RPCs recheck active ADMIN access; direct writes remain denied. Existing request RPC signatures remain stable through serialized wrappers. All guarded writes share a transaction advisory gate for this small test increment; production lock granularity/load remain future work.

Owner bootstrap and rollout instructions are in [ADMIN_SETUP.md](ADMIN_SETUP.md), with placeholder-only bootstrap and read-only preflight scripts. Admin still cannot read request contents, request action/decision comments, or request-reassignment rows. Configuration change history is separate. No service-role secrets are added to the frontend.

## Hosted backend state

The initial migration and the approved Admin migration are manually applied to **approvia-dev** (`cypcgwcmavauezmxdbgb`). The hosted backend now has eleven application tables, unchanged public submit/decision interfaces, and six protected Admin RPCs. The corrected dedicated confirmed first Admin login was owner-bootstrapped after explicit action-time approval. Main implementation commit **35b054e** was pushed to GitHub master; the live Vercel bundle was verified to contain the Admin client/UI and reassignment support. Subsequent handoff/history-order changes are tracked in Git as the release follow-up.

Read-only dashboard/SQL inspection on 2026-10-14 confirmed the configured project, eight public application tables with RLS enabled, and security-definer submit/decision functions. It showed two profiles, one class, two requests, and zero pending requests. The dashboard showed no tracked migrations or backups. A private pre-change application/schema snapshot was exported, saved under ignored artifacts/private-backups, and parsed successfully. Hosted columns, constraints, RLS policies, browser table grants, and all five baseline function bodies were compared with the original migration and matched (column nullability was compared independently of differing catalog NOT NULL constraint representation). This is an application/schema capture, not a full Auth/platform backup. Continue owner-controlled SQL deployment; never rerun the baseline or invent migration-history entries. Reconcile properly before adopting CLI automation.

The user corrected the intended dedicated Admin login. Its confirmed Auth identity and absence of an existing profile were verified, then the user approved granting the corrected account ADMIN access. The tested owner bootstrap returned success. An earlier attempt against the previous unconfirmed address safely refused to create a profile. Personal values remain outside version-controlled setup scripts; passwords were not requested/read/changed. Do not use the separate dashboard project named approvia.

Git origin is https://github.com/AyshathNafida/approvia.git on master. Existing environment variables and Vercel build settings remain unchanged.

## Approved behavior and deferred scope

D12: one Tutor follows each class cohort through its four-year course. D13: class events require Tutor/HOD; college events require Dean/Principal; configured routes may reach higher authorities while preserving required steps. Complete event routes, forms, and runtime referral remain undecided and unimplemented.

D14 supersedes D10 pending-Tutor retention for explicit guarded Admin replacement: atomically transfer pending class reviews, retain completed reviewers/decisions, record previous/new reviewer, actor, reason, and REASSIGNED action history. Missing/invalid replacement or unresolved legacy pending class mapping aborts the operation. Student moves/deactivation require pending work resolved; faculty deactivation requires assignments/pending reviews resolved. Admin creation/type switching/deletion are not dashboard actions.

The user confirmed no previous test student class changes. Migration backfill matches current class/department against stored submission names; unmatched pending mappings fail closed and require owner review. Legacy class batch years can be filled without changing its identity. Established department/batch identity cannot change after memberships/history exist.

Invitations, institutional-domain enforcement, recovery UI, annual progression/transfers/graduation lifecycle, multi-level approvals, documents, drafts, returns/resubmission, cancellation, notifications, reports, and production operations remain future work. This is a development-test increment, not institutional production readiness.

## Verification performed

- **44 Vitest tests passed:** seven authentication UI tests, six workspace UI tests, seven Admin UI tests, twenty-one actual PostgreSQL operation/RLS tests, and three migration/bootstrap/owner-smoke tests. PGlite uses a Supabase Auth identity stub; it does not prove hosted password login or multi-session concurrency. A new UI regression covers tied timestamps: submission precedes reassignment, which precedes the final decision.
- Database checks apply both migrations and cover submission/decisions, authorization/isolation, denied direct writes/self-promotion/private RPC calls, exact confirmed-login provisioning, scoped assignments, four-year batch identity, dependency guards, multiple pending transfers, repeated replacements, completed history, and old/new Tutor access.
- Failure tests verify whole-operation rollback, including a synthetic failure on a second transfer after the first write. Legacy tests verify name-matched backfill/unresolved records and initial Tutor history. Bootstrap tests reject placeholders, missing/unconfirmed identities, existing profiles, and repeat Admin bootstrap.
- Serialization entrypoint checks verify the shared write gate; sequential decision/replacement outcomes are tested. An actual two-session hosted check held the gate for 12 seconds while an authenticated Student submitted: the second transaction waited **11.70 seconds**, succeeded, then rolled back. Broader same-request concurrent decision/replacement replays, load, and complete production security checks remain pending.
- TypeScript/production build and lint passed without warnings. Tests used a workspace-local ignored temporary directory to avoid sandbox temp-file permission errors.
- Desktop and 390-pixel phone Admin layouts were inspected in a browser using the real component with local sample-data API fixtures. This is visual QA, not hosted Auth/RLS verification. Preview fixtures are ignored artifacts and do not enter the production app.
- Prior D10 hosted rolled-back SQL smoke verified request submission/decision/history under authenticated-role identities; it did not test real password login. Prior baseline dependency installation reported zero vulnerabilities; no new dependencies were added for D14.
- The tested hosted-admin-smoke.sql succeeded on actual approvia-dev PostgreSQL using authenticated-role identities. It exercised guarded provisioning/configuration, pending Tutor transfer, preserved completed history, old/new Tutor access, Student history, Admin request privacy, and direct self-promotion denial. Synthetic Auth identities had no passwords/tokens and all fixture data rolled back. Follow-up checks showed eleven application tables, the original two request records and one class retained, and zero synthetic Auth logins. This is hosted RPC/RLS verification, not browser password login or multi-session concurrency.
- The real first Admin was checked under authenticated-role identity: active ADMIN, successful setup-summary RPC, zero visible requests, and no unresolved pending class mappings. The user separately reported successful Chrome password login and Admin dashboard display. No password was shared with the agent.
- The public Vercel page/bundle was checked after the master push; it served the tested Admin release. Desktop/phone visual QA remains sample-data component inspection, not an independent Chrome session test.

## Outstanding work

1. Backend migration, private pre-change capture/baseline comparison, first Admin bootstrap, and hosted rolled-back RPC/RLS verification are complete. Do not rerun either migration or the first-Admin bootstrap.
2. First Admin role/privacy and frontend deployment are verified; Admin Chrome login/dashboard access is user-confirmed. Keep private credentials out of Git and agent messages.
3. Admin should populate the existing test class's actual batch details and configure institutional assignments; do not invent real academic-year values. Provision another confirmed Faculty test login for full browser replacement acceptance.
4. Complete browser Admin → Student → Tutor replacement → replacement decision → Student history acceptance, including old Tutor denial. Equivalent hosted RPC/RLS smoke passed; the full role-switching browser flow and broader concurrent decision/replacement/load checks remain pending.
5. Resolve complete event routes and remaining institutional identity/workflow/storage/lifecycle/reporting questions before dependent features.
6. Separate production environments/data, establish backups/monitoring and deployment operations, and perform production security/load verification before institutional use.

## Latest handoff: 2026-10-14

User explicitly requested implementation of the Admin plan (D14), including transfer of pending Tutor reviews, batch setup without yearly progression, dedicated first Admin, existing test-login provisioning, and guarded deactivation. Implementation, 44 local tests/build/lint, private state capture, baseline comparison, hosted migration, corrected confirmed Admin bootstrap, rolled-back hosted RPC/RLS smoke, a real two-session gate check, GitHub push, and live frontend verification are complete. User confirmed Chrome Admin login/dashboard access. Full role-switching browser acceptance and broader concurrency/load remain pending. Passwords were not requested, read, or changed. Preserve the original migration and private ignored backups; no real email values are in setup scripts. Do not silently infer deferred multi-level/event workflow rules.
