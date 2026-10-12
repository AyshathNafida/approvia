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

## Open questions

Every question below is **unresolved**. Consult the user before implementing behavior that depends on it; none has a selected default.

| ID | Question | Source and reason it remains open |
|---|---|---|
| Q2 | Should route selection use responsibility checkboxes or predefined routes? | Section 12 presents both alternatives and defers the final interface. |
| Q3 | May routes skip intermediate hierarchy levels or start above Tutor? | Sections 13–14 establish ordering and mandatory authorities but do not define skipped-level policy. |
| Q4 | After correction and resubmission, does review resume at the returning approver or repeat earlier steps? | Section 19 preserves history without specifying resumption or prior-approval validity. |
| Q5 | Which fields, documents, and route choices may change on a returned request? | Section 19 refers to permitted fields without listing them. |
| Q6 | At which stages may a student cancel, and what happens to pending approval steps? | Section 6.1 supports cancellation where permitted; conditions are unspecified. |
| Q7 | What happens to pending requests when an authority assignment changes or an approver is deactivated? | Section 22 specifies future requests only; in-flight reassignment, resolution timing, and assignment snapshots are unspecified. |
| Q8 | What happens when a required assignment is missing or inactive, or one faculty member fills several selected responsibilities? | Sections 4 and 10 describe assignment resolution; failure and overlap behavior are unspecified. |
| Q9 | What are the initial real request types, their fields, documents, and permitted routes? | Sections 14 and 16 use examples; section 21 identifies Request Fields without a complete catalog. |
| Q10 | What are the complete status transitions, comment requirements, and post-decision modification rules? | Sections 17–19 list statuses/actions but do not define the full state machine. |
| Q11 | Which notification channels, events, and delivery rules are needed? | Sections 21 and 26 include notifications without detailed behavior. |
| Q12 (remaining details) | Which institutional email domains are accepted, and how are the first and additional Admin accounts provisioned? | D6 settles student/faculty invitations and login/recovery policy, but these institutional/setup details remain open. |
| Q13 (remaining details) | What document validation, replacement, and retention policies apply? | D8 settles the access boundary; file types/size, validation, replacement, retention, and malware handling remain undesigned. |
| Q14 | How do academic years, batches, semesters, and changing student class membership relate? | Sections 5, 6.3, and 21 mention these concepts without lifecycle rules. |
| Q15 (remaining details) | What exact summary report/audit fields, exports, and audit-retention policy are needed? | D8 settles request/document visibility; report and audit views must respect the prohibition on exposing request contents/documents to Admin. |

## Recording future decisions

For each agreed decision, record the date, status, approving user instruction or source, chosen behavior, and concise rationale. Reference the relevant question ID and update the affected requirements/topic documents and [PROJECT_STATUS.md](PROJECT_STATUS.md).

If a decision changes, mark the previous decision superseded and retain its history. Proposals remain labeled proposed until agreed; unanswered questions must not silently become implementation defaults.
