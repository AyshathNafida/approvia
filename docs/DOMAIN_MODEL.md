# Approvia domain model

Status: conceptual requirements summary; no physical database schema has been designed or implemented. The [complete requirements](PROJECT_REQUIREMENTS.md) are authoritative; see [decisions](DECISIONS.md) for unresolved rules.

## Institutional structure

Source: requirements sections 2–5, 10, 15, and 22.

```text
Institution
  ├── Departments
  │     ├── Department HOD assignment
  │     ├── Faculty members
  │     └── Classes / divisions
  │           ├── Tutor assignment
  │           └── Students
  ├── Dean assignment
  └── Principal assignment
```

Departments must be configurable: administrators can add, edit, activate, and deactivate them. Initial departments specified by the source are IT, CS, EEE, EC, MECH, AIDS, and CSBS; this initial list must not become hard-coded application logic.

Classes/divisions are distinct from departments. A department may have one or more classes; each student belongs to one active class/division, and each class has one assigned tutor. CS-A, CS-B, and CS-C are illustrative divisions, not a mandatory division list for every department.

| Responsibility | Assignment scope | Person resolved from |
|---|---|---|
| `TUTOR` | Class/division | Student's class tutor assignment |
| `HOD` | Department | Student's department HOD assignment |
| `DEAN` | Institution | Currently assigned active Dean |
| `PRINCIPAL` | Institution | Currently assigned active Principal |

Administrators maintain assignments. Assignment changes affect future requests without source-code changes; their effect on pending requests is unresolved.

## Users, profiles, and access concepts

Source: requirements sections 5–9, 21, and 23.

| Account type | Intended access |
|---|---|
| `STUDENT` | Create/draft/submit requests, select permitted routes, upload supporting documents, track progress/history/comments, correct returned requests, cancel where permitted |
| `FACULTY` | Faculty access; process assigned requests through eligible approval responsibilities |
| `ADMIN` | Manage institution configuration, accounts, assignments, request types, workflow rules, academic years, reports, and system settings |

Account types and approval responsibilities are separate. A faculty account may hold one or more responsibilities; changing a responsibility does not require changing its account type. The user resolved Q1 on 2026-10-12: only FACULTY accounts may hold approval responsibilities; ADMIN accounts cannot approve. This supersedes the original section 6.3 Admin exception; see [approved decisions](DECISIONS.md#approved-product-decisions-2026-10-12).

Approved provisioning uses Admin invitations after institutional record checks, verified institutional email, email/password login, and email recovery, with no public signup. Students see their own requests; faculty see current/completed assigned steps' requests; Admin sees configuration, summary reports, and audit metadata without request contents/documents. See [ACCOUNT_ACCESS_PLAN.md](ACCOUNT_ACCESS_PLAN.md) for approved boundaries and remaining setup proposals.

All students share the Student account type. Class Coordinator, Student Representative, and Class Leader classifications are outside the initial model unless introduced later.

A student profile should contain Student ID/Admission Number, full name, institutional email, department, class/division, current semester, batch, and account status. The source identifies Faculty Profiles but does not specify their field layout.

## Request and workflow concepts

Source: requirements sections 11–19 and 21.

| Concept | Requirement-level role |
|---|---|
| Request Types | Categorize requests and define applicable workflow rules |
| Requests | Student-created records that support drafts, submission, tracking, correction, and permitted cancellation |
| Request Fields | Represent request information; exact field definitions and validation remain undesigned |
| Request Documents | Supporting files associated with requests |
| Workflow Rules | Required/optional approvers, minimum/maximum approval levels, and whether route customization is allowed |
| Selected Approval Routes | Ordered responsibilities selected within permitted request-type rules |
| Approval Steps | Represent the resolved sequential approval process |
| Approval Actions | Record the request, approver, responsibility, action, comment, date, and time |

The hierarchy is Tutor → HOD → Dean → Principal. Students select responsibilities rather than people. A route must satisfy ordering and request-type rules before submission. Whether intermediate levels may be skipped is an open question.

Primary request statuses are Draft, Submitted, In Review, Returned, Rejected, Approved, and Cancelled. These are requirement labels, not a selected database enum or complete transition specification. See [WORKFLOWS.md](WORKFLOWS.md).

## History and supporting entities

Source: requirements sections 18–21 and 26.

- Approval history records decisions and comments without silent modification or overwriting; it remains intact after corrections and resubmission.
- Audit Logs capture significant request, account, assignment, document, workflow, and administrative events. They are distinct from the request's approval history.
- Notifications support the request lifecycle; channels, triggers, delivery behavior, and read state are not specified.
- Academic Years are a managed entity; their relationships to classes, batches, semesters, and requests need later design.

All 22 entity concepts listed in source section 21 are covered here. These concepts do not require 22 database tables; keys, cardinalities beyond stated requirements, constraints, versioning, and storage layout remain future design work.
