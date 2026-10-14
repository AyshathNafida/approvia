# Typed requests and sequential approval

Approved 2026-10-14 under D15. Implementation is local; consult PROJECT_STATUS.md for hosted rollout and verification. This supersedes the Tutor-only processing limit and adds scoped final-request archive access to the earlier D8 visibility rule.

## Catalogue and forms

Every form requires title and description/reason. All additional fields are required, limited to 200 characters, and validated server-side. Date ranges may include past dates; the end cannot precede the start. Event/facility times are entered as local wall time in Asia/Kolkata, preserved with that time-zone designation.

| Code / type | Additional fields | Approval route |
|---|---|---|
| general / General Request | None | Tutor |
| leave / Leave | From/to dates | Tutor → HOD |
| duty_leave / Duty Leave | Activity, organizer, from/to dates | Tutor → HOD → Dean |
| event / Event Permission | Class/college scope, event name, venue, start/end date-time | Class: Tutor → HOD; college: Dean → Principal |
| facility / Facility / Equipment | Department/college scope, requested room/equipment, start/end date-time | Department: Tutor → HOD; college: Dean → Principal |
| internship / Internship / Industrial Visit | Internship/visit selection, organization, location, from/to dates | Tutor → HOD → Dean → Principal |

This is a fixed approved catalogue, not an Admin workflow/form builder. Students choose scope rather than people or arbitrary approval levels. Each required role on a submitted route must resolve to a different active Faculty member. Multiple institutional assignments per person remain allowed when they do not overlap on that route.

## Submission and processing

The new guarded `submit_typed_request(title, description, type_id, fields)` RPC accepts a JSON object of whitelisted string fields. Unexpected fields, invalid dates/scopes, missing/inactive assignments, and repeated reviewers reject the whole transaction. `submit_request(title, description, type_id)` remains callable for General Request only. `decide_request` retains its public arguments.

Requests preserve type name/code, structured fields, complete form definition/version/time zone, route, submitted class/department, and reviewer names. Current configuration does not rewrite these snapshots. Faculty names are returned with authorized request steps rather than exposing a broader profile directory. Request history has a server-issued ordering key.

Only the active assigned reviewer at current_position can decide. Every decision needs a comment. Intermediate approval leaves the request In Review and advances to the next stage. Final approval completes it. Rejection immediately finalizes and marks remaining steps SKIPPED. A skipped step grants no request access. Student and Faculty screens show structured details, ordered steps, and action history; intermediate success messages do not imply final approval.

## Replacements and privacy

Admin replacement of Tutor/HOD/Dean/Principal transfers all unfinished steps for that responsibility and original scope, including future steps. History records the old/new reviewer, Admin actor, reason and step. Decisions already recorded remain unchanged. Removal is blocked while unfinished reviews depend on the assignment; deactivation guards include future steps. A collision with another reviewer on any affected route aborts every configuration/history/transfer write.

Students see their own requests. Faculty see current/completed assigned steps; future steps do not confer early access. The current holder additionally sees final requests with an actual APPROVED/REJECTED step under that responsibility in the saved class/department/institution scope. This archive permission applies to replacement and initial holders alike. Former reviewers retain their own processed-step access; unprocessed transferred access is revoked unless another authorized relationship applies. Never-reached or skipped responsibilities do not establish archive visibility. Admin remains excluded from bodies, fields, comments, steps and reassignment rows.

Legacy department scope is filled only if saved class/department names match the saved class identity. Unmatched records remain unresolved and grant no scoped archive access. Affected unresolved pending records block replacement for owner-reviewed mapping. Shared transactional write-gate locking is retained for this development workload.

## Rollout and verification

1. Capture [request-workflow-preflight.sql](../supabase/request-workflow-preflight.sql) privately. It contains application requests/schema but no Auth credentials; it is not a full platform backup. Compare the current two-migration baseline and inspect state before any write.
2. Apply [202610140002_request_workflows.sql](../supabase/migrations/202610140002_request_workflows.sql) once after the existing two migrations. Never rerun applied migrations. The five new types start inactive so the existing deployed form remains usable.
3. Deploy the compatible frontend from GitHub master; then run [activate-request-catalogue.sql](../supabase/activate-request-catalogue.sql) as owner. Activation does not provision reviewers. Admin must configure distinct active faculty for all required roles; missing assignments produce an actionable submission error.
4. Run [hosted-workflow-smoke.sql](../supabase/tests/hosted-workflow-smoke.sql) only in approvia-dev. It uses disposable synthetic Auth rows without passwords/tokens and actual authenticated-role RLS. The full flow and fixtures roll back. It tests multi-step approval, future access, HOD replacement, historical access, old-reviewer denial, Student history, rejection and Admin privacy. This is not a password-login test.
5. Run the owner-controlled two-session concurrency checks documented alongside the fixture scripts, clean only those fixtures, and record actual outcomes. Local PGlite tests cannot prove multi-session behavior.
6. Run tests, lint and production build. Inspect desktop/mobile real-component previews separately from hosted identity/RLS checks. Record any remaining browser password-login/role-switching acceptance limits explicitly.

Attachments, referrals, drafts, editing/resubmission, cancellation, group requests, custom routes/forms, and external notifications remain future increments.
