# Approvia decisions and open questions

This document distinguishes established source requirements, user-approved documentation choices, and unresolved questions. It does not choose answers to source ambiguities. The [captured specification](PROJECT_REQUIREMENTS.md) remains the requirements reference.

## Established requirements

| ID | Requirement | Status and source |
|---|---|---|
| R1 | Build a configurable approval system for institutional production deployment | Established; sections 1 and 25–26 |
| R2 | Configurable departments and separate classes/divisions; each student has one active class and each class one tutor | Established; sections 2–5 and 15 |
| R3 | Separate `STUDENT`/`FACULTY`/`ADMIN` account types from `TUTOR`/`HOD`/`DEAN`/`PRINCIPAL` responsibilities; faculty may hold multiple responsibilities | Established; sections 6–9; Admin eligibility exception is unresolved in Q1 |
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

## Open questions

Every question below is **unresolved**. Consult the user before implementing behavior that depends on it; none has a selected default.

| ID | Question | Source and reason it remains open |
|---|---|---|
| Q1 | Can an Admin account ever hold an approval responsibility, and how would eligibility work? | Section 6.3 allows an explicitly assigned eligible responsibility; section 7 says only eligible faculty accounts receive responsibilities. Preserve this conflict until clarified. |
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
| Q12 | How are accounts provisioned and institutional identities validated? | Sections 6 and 8 define administration/login but not signup, verification, or recovery policy. |
| Q13 | What document access, validation, replacement, and retention policies apply? | Sections 1, 6.1, 21, and 23–24 require supporting files and secure handling without detailed rules. |
| Q14 | How do academic years, batches, semesters, and changing student class membership relate? | Sections 5, 6.3, and 21 mention these concepts without lifecycle rules. |
| Q15 | What are the Admin/faculty read permissions for requests, documents, reports, and audit logs? | Sections 6.3 and 23 constrain access but do not provide a complete read-access matrix or audit-retention policy. |

## Recording future decisions

For each agreed decision, record the date, status, approving user instruction or source, chosen behavior, and concise rationale. Reference the relevant question ID and update the affected requirements/topic documents and [PROJECT_STATUS.md](PROJECT_STATUS.md).

If a decision changes, mark the previous decision superseded and retain its history. Proposals remain labeled proposed until agreed; unanswered questions must not silently become implementation defaults.
