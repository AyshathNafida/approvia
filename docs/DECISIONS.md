# Approvia decisions and open questions

This document distinguishes established source requirements, user-approved documentation choices, and unresolved questions. It does not choose answers to source ambiguities. The [captured specification](PROJECT_REQUIREMENTS.md) remains the requirements reference.

## Established requirements

| ID | Requirement | Status and source |
|---|---|---|
| R1 | Build a configurable approval system for institutional production deployment | Established; sections 1 and 25–26 |
| R2 | Configurable departments and separate classes/divisions; each student has one active class and each class one tutor | Established; sections 2–5 and 15 |
| R3 | Separate `STUDENT`/`FACULTY`/`ADMIN` account types from `TUTOR`/`HOD`/`DEAN`/`PRINCIPAL` responsibilities; faculty may hold multiple responsibilities; Admin accounts do not approve | Sections 6–9, with Admin conflict resolved by D7/Q1 on 2026-10-12 |
| R4 | Single login; determine account type after authentication | Established; section 8 |
| R5 | Select permitted responsibilities, resolve faculty through class/department/institution assignments, never hard-code individual approvers | Established; sections 4 and 9–12, 22 |
| R6 | Validate hierarchy order and request-type mandatory authorities before submission | Established; sections 13–14; skipped levels remain unresolved in Q3 |
| R7 | Sequential approvals; last required approval completes the request | Established; section 16 |
| R8 | Support Draft, Submitted, In Review, Returned, Rejected, Approved, and Cancelled; permit approval, rejection, correction returns, and comments | Established; sections 17–18; detailed transition rules remain open |
| R9 | Permit correction/resubmission and preserve prior approval/action history | Established; sections 18–19 |
| R10 | Audit significant actions; enforce frontend/backend authorization and PostgreSQL RLS | Established; sections 20 and 23–24 |
| R11 | Use React/TypeScript/Vite, Supabase/PostgreSQL/Auth/Storage, Edge Functions and PostgreSQL Functions where appropriate, Git/GitHub | Intended stack established; section 24; implementation pending |
| R12 | Support notifications, academic years, and the conceptual entities listed in the source | Established scope; sections 6.3, 21, and 26; detailed design pending |

## Documentation decisions

| ID | Decision | Status, source, and rationale |
|---|---|---|
| D1 | Create a context foundation rather than a detailed implementation blueprint | Approved by user on 2026-10-09; retain project intent without inventing schemas, APIs, or unresolved rules |
| D2 | Use root AGENTS.md and README.md plus seven focused topic documents | Approved by user on 2026-10-09; provide an entry point and task-specific context for future chats |
| D3 | Preserve the complete source in PROJECT_REQUIREMENTS.md and leave desktop doc.txt unchanged | Approved implementation plan on 2026-10-09; make project context available within the repository |
| D4 | Keep status/handoff and decisions current after material work | Approved implementation plan on 2026-10-09; distinguish verified progress from requirements and planned behavior |

## Implementation setup decisions

| ID | Decision | Status and rationale |
|---|---|---|
| D5 | Host the frontend on Vercel, with React/TypeScript/Vite at the repository root and npm dependency management | Approved by the user's Vercel connection request and agreement to create, verify, commit, and push the starter on 2026-10-12. Provide an initial deployable branch; Supabase remains the intended backend and is not configured. |

## Approved product decisions: 2026-10-12

The user explicitly selected all three recommended answers to the account/login, Admin eligibility, and read-permission questions in this chat. These are approved requirements, not verified runtime capabilities. See [ACCOUNT_ACCESS_PLAN.md](ACCOUNT_ACCESS_PLAN.md).

| ID | Question resolved | Approved behavior and rationale |
|---|---|---|
| D6 | Q12, provisioning and login policy | Admin invites students/faculty after checking institutional records; no public signup. Require verified institutional email; use email/password login and email password recovery. Keep identity and account-type assignment under institutional administration. Accepted domains and first/additional Admin provisioning remain to be specified. |
| D7 | Q1, Admin approval eligibility | Only FACULTY accounts may hold approval responsibilities. ADMIN accounts manage the system and cannot approve. This overrides the Admin exception in original section 6.3 and resolves the conflict with section 7. |
| D8 | Q15, request visibility; access portion of Q13 | Students see only their own requests. Faculty see requests/documents for current or completed approval steps, with no future-step access before their turn. Admin sees configuration, summary reports, and audit metadata without request contents or supporting documents. Preserve privacy while supporting assigned review and administration. Exact report/audit fields and retention remain open. |

## MVP scope decision: 2026-10-12

| ID | Decision | Approval and limits |
|---|---|---|
| D9 | Implement only Supabase email/password authentication for the current MVP increment | User instruction: "for mvp let's only make authentication email and password(easy to login)". Include login for existing Supabase Auth users, a signed-in confirmation, session restoration, and logout. Account provisioning/invitations, recovery UI, institutional domain enforcement, role dashboards, profile checks, and RLS are deferred. D6–D8 remain approved requirements for the institutional system; this scope does not permit public signup or grant application data access from an Auth session. |

## Small working MVP decision: 2026-10-12

| ID | Decision | Approval and limits |
|---|---|---|
| D10 | Expand the current MVP to one complete General Request workflow | User explicitly selected the small working MVP and the simple workflow rules. Email/password login; title/description form; fixed Tutor-only route resolved from the student's class; approve/reject with required comment; student status/history tracking. Submission enters In Review, requires an active class/department/faculty Tutor, and snapshots that Tutor. Approved/Rejected are final; no editing after submission. Inactive accounts cannot act; requests assigned to inactive Tutors wait for later reassignment support. Manual development accounts/profiles/class configuration; documents, drafts, returns, cancellation, notifications, route customization, additional approval levels, and Admin screens are deferred. This expands D9 for the current test increment; larger institutional requirements remain future scope. |
| D11 | Apply the tested MVP database and two test profiles to approvia-dev | User explicitly approved the migration and test-profile setup in the browser confirmation question. Provided two development emails in Student/Tutor order; confirmed creating the Auth users. No passwords were requested or changed. Personal email addresses are used for development testing; production institutional-domain/invitation requirements remain D6. |

## Institutional setup and routing decisions: 2026-10-14

| ID | Decision | Approval and limits |
|---|---|---|
| D12 | One Tutor follows a class cohort through its four-year course | User answer: "one tutor for 4 years for a class". Model the class as a specific batch/cohort, with a continuing Tutor assignment across annual progression. Academic-year rollover does not itself replace the Tutor. Exceptional replacement, transfer, graduation, and pending-request reassignment rules remain open under Q7/Q14. This is approved future behavior, not implemented cohort/year management. |
| D13 | Event/request type determines required workflow; configured routes may reach higher authorities directly | User confirmed direct higher-level routing is allowed, but each event has a workflow: class events require Tutor and HOD permission, and college events require Dean and Principal permission. Enforce configured mandatory authorities rather than unrestricted forwarding. These are required authority sets, not complete finalized routes: whether college events also need Tutor/HOD, and whether Dean/Principal are selectable for class events, remains to be agreed. The approved hierarchy order remains in force. Runtime faculty referral semantics and the route-selection interface remain open. |
| D14 | Implement the first Admin setup/assignment increment with audited pending Tutor transfer | User explicitly requested implementation of the complete Admin setup plan on 2026-10-14. Same login with protected active ADMIN profile; dedicated confirmed first Admin bootstrapped by owner; provision only existing confirmed test Student/Faculty logins with immutable account type. Manage departments, four-year class batches, placement, active status, and scoped faculty assignments. HOD/Dean/Principal remain configuration only; processing remains Tutor-only. Student moves/deactivation require no pending requests; faculty deactivation requires assignments/pending reviews resolved. Class department/established batch identity cannot change after memberships/history. Admin Tutor replacement atomically transfers that class's pending reviews with mandatory reason and old/new history; completed requests remain unchanged. This supersedes D10's pending-Tutor retention only for explicit Admin replacement operations. User confirmed no previous test student class moves, enabling name-matched legacy class backfill; unresolved pending mappings fail closed. Invitations/domain enforcement, yearly progression, additional Admin creation/type switching, destructive deletes, and multi-level approvals remain deferred. See ADMIN_SETUP.md for implemented interfaces and rollout limits. |

## Open questions

The table below tracks remaining institutional behavior. D10 selects narrow route/type/status/comment/assignment rules for the test MVP only; broader behavior remains unresolved. Consult the user before implementing an unresolved extension.

| ID | Question | Source and reason it remains open |
|---|---|---|
| Q2 | Should route selection use responsibility checkboxes or predefined routes? | Section 12 presents both alternatives and defers the final interface. |
| Q3 (remaining details) | Which event/request types permit skipped levels or starting above Tutor, and what are their exact routes? | D13 allows configured direct higher-authority routing while preserving event-specific mandatory approvals. Complete permitted routes remain to be agreed. |
| Q4 | After correction and resubmission, does review resume at the returning approver or repeat earlier steps? | Section 19 preserves history without specifying resumption or prior-approval validity. |
| Q5 | Which fields, documents, and route choices may change on a returned request? | Section 19 refers to permitted fields without listing them. |
| Q6 | At which stages may a student cancel, and what happens to pending approval steps? | Section 6.1 supports cancellation where permitted; conditions are unspecified. |
| Q7 (remaining details) | How do pending requests behave for future multi-level authority changes and deactivation? | D14 settles explicit Admin Tutor replacement: transfer pending class reviews atomically and retain completed decisions. Guard faculty deactivation until assignments/pending reviews are resolved. HOD/Dean/Principal pending-step behavior remains open because multi-level processing is deferred. |
| Q8 | What happens when a required assignment is missing or inactive, or one faculty member fills several selected responsibilities? | Sections 4 and 10 describe assignment resolution; failure and overlap behavior are unspecified. |
| Q9 (remaining details) | What are the complete initial request types, fields, documents, and permitted routes? | D13 establishes class events requiring Tutor/HOD and college events requiring Dean/Principal. Complete routes, forms, and supporting document requirements remain open. |
| Q10 | What are the complete status transitions, comment requirements, and post-decision modification rules? | Sections 17–19 list statuses/actions but do not define the full state machine. |
| Q11 | Which notification channels, events, and delivery rules are needed? | Sections 21 and 26 include notifications without detailed behavior. |
| Q12 (remaining details) | Which institutional email domains are accepted, and how are additional Admin accounts provisioned? | D14 settles a dedicated confirmed first Admin login through controlled owner bootstrap. Additional Admin creation remains outside this increment. D6 institutional identity/invitation rules remain future requirements; a supplied Admin email does not establish accepted domains for everyone. |
| Q13 (remaining details) | What document validation, replacement, and retention policies apply? | D8 settles the access boundary; file types/size, validation, replacement, retention, and malware handling remain undesigned. |
| Q14 (remaining details) | How do academic years, batches, semesters, transfers, and graduation relate? | D12 settles a continuing Tutor for a class cohort's four-year course. Other membership/progression lifecycle rules remain open. |
| Q15 (remaining details) | What exact summary report/audit fields, exports, and audit-retention policy are needed? | D8 settles request/document visibility; report and audit views must respect the prohibition on exposing request contents/documents to Admin. |

## Recording future decisions

For each agreed decision, record the date, status, approving user instruction or source, chosen behavior, and concise rationale. Reference the relevant question ID and update the affected requirements/topic documents and [PROJECT_STATUS.md](PROJECT_STATUS.md).

If a decision changes, mark the previous decision superseded and retain its history. Proposals remain labeled proposed until agreed; unanswered questions must not silently become implementation defaults.
