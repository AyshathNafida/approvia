# Institutional setup and approval routing plan

Date: 2026-10-14 (Asia/Calcutta).
Status: **routing proposal with approved D12/D13 rules; Admin portion implemented/deployed under D14**. HOD/Dean/Principal processing and runtime referral remain proposed/deferred. [ADMIN_SETUP.md](ADMIN_SETUP.md) records the implemented subset and verification limits.

The user requested a plan for assigning Tutors by class/year, assigning different responsibilities, and passing requests to higher authorities. This document proposes the next extension after the user-confirmed working test MVP. Canonical requirements remain [PROJECT_REQUIREMENTS.md](PROJECT_REQUIREMENTS.md); unresolved decisions remain in [DECISIONS.md](DECISIONS.md).

## Current implementation

The MVP stores departments, classes, one `classes.tutor_id`, and one current `profiles.class_id` for each student. Faculty eligibility is checked during submission. Requests snapshot the resolved Tutor; changing the class Tutor affects future requests. The request-type constraint allows only Tutor, and the decision function finalizes the request after that single step. Academic-year membership history, dated responsibility assignments, Admin configuration screens, multi-level routing, and referral are not implemented.

Inspect and extend the existing schema with a new migration; never rerun the manually applied initial migration. Reconcile its migration history before adopting automated deployment.

## 1. Organize classes, batches, and academic years

Source: requirements sections 2–5, 15, and 21; unresolved Q14.

Proposed concepts:

- Department: for example, Computer Science.
- Class/cohort: a specific student group, such as CS-A, batch 2026–2030. These labels are illustrative configurable data.
- Academic year: an institutional operating period, such as 2026–2027.
- Class-year record: connects the cohort to that academic year, with its current study year/semester and active status.
- Student membership: records the student's class-year placement and its effective period, preserving previous placements. Enforce one active membership per student.

An academic year is different from a student's first/second/third/final study year and from the batch. Avoid creating one shared CS-A identity for unrelated batches. Each active class-year resolves one effective continuing cohort Tutor before submissions can proceed.

Approved D12: one Tutor follows the specific class batch/cohort for its four-year course. Store the continuing assignment against the cohort, with academic-year records representing its progression. Annual rollover retains that Tutor. Exceptional replacement, transfers, promotion, semester progression, and graduation rules still need agreement under Q7/Q14.

## 2. Assign scoped faculty responsibilities

Source: requirements sections 6–10 and 22; approved D7.

Account type remains STUDENT, FACULTY, or ADMIN. Tutor, HOD, Dean, and Principal are scoped faculty responsibilities, rather than new account types. Only active FACULTY accounts may receive an assignment; Admin configures assignments and cannot approve.

| Responsibility | Proposed assignment scope | Resolution |
|---|---|---|
| Tutor | Class cohort/batch | Student's active class cohort Tutor, retained across its four years |
| HOD | Department | Student's department HOD |
| Dean | Institution | Effective institution-level Dean |
| Principal | Institution | Effective institution-level Principal |

Propose assignment records with responsibility, faculty, scope, effective dates, and who made the change. Enforce one effective holder for each responsibility/scope and prevent overlapping active assignments. One faculty member may hold multiple assignments, including Tutor for several classes, if the institution permits it.

Replacing an assignment closes the previous record and creates a new one, preserving its history. Existing MVP pending requests retain their Tutor snapshot. Broader snapshot timing and reassignment rules remain proposed under Q7/Q8.

## 3. Give Admin a practical setup workflow

Source: requirements sections 6.3 and 21; D6–D8.

1. Establish a protected first Admin through an agreed provisioning process (Q12).
2. Configure departments, academic years, and class/cohort records.
3. Provision/invite verified institutional Student and Faculty accounts.
4. Place students into active class-year records.
5. Assign each class-year Tutor, department HOD, and institution Dean/Principal.
6. Configure request types, required routes, and permitted referral rules.
7. Show setup gaps and block affected submissions until required assignments exist.

Proposed screens: Academic Years and Classes, Accounts and Memberships, Faculty Assignments, and Request Types and Routes. Setup gaps should identify missing configuration without exposing private request contents. Admin operations require server-side authorization and audit events; browser controls alone are insufficient.

## 4. Configure normal approval routes

Source: requirements sections 11–16; approved D13 and remaining Q2/Q3/Q9 details.

Approved required authorities: class events need Tutor and HOD; college events need Dean and Principal. Configured routes may reach higher authorities directly. Whether college events also need Tutor/HOD is still open; do not silently select a complete route. Every permitted route must retain its event type's mandatory authorities in hierarchy order.

Recommend predefined permitted routes per request type for the next increment. Example routes, not mandatory categories: Tutor; Tutor → HOD; Tutor → HOD → Dean → Principal. Students choose only among allowed routes, where choice is permitted, and never select faculty identities.

The server validates hierarchy order and mandatory authorities. Proposed initial implementation snapshots the entire resolved route and its rule version at submission. Required assignments must be present and eligible. Only the current reviewer can act or access request contents; future reviewers receive access when their turn starts. Previously processed reviewers retain access under D8.

Approval moves the request to the next step; only the last required approval completes it. Reject ends the request under an explicitly agreed multi-level rejection rule. Required decision comments and final-decision behavior can follow D10, subject to approval for the expanded workflow.

## 5. Handle exceptional referral to higher authority

New proposal: referral is distinct from the source's normal sequential approval. It requires explicit approval and a new decision entry before implementation.

Propose a Faculty action called **Refer to higher authority**, with a required reason. It means the reviewer is deferring the decision, not recording an approval. For example, a Tutor-only request may be referred to its department HOD if its request type permits that extension. The request remains In Review, Tutor history records the referral, and HOD becomes the current reviewer.

Referral destinations are responsibilities resolved by the server. The reviewer cannot choose arbitrary faculty or skip mandatory uncompleted authorities. Proposed restrictions:

- Only the active current assigned reviewer may refer an In Review request.
- The request type must explicitly allow that source/destination combination.
- Resolve and validate the target assignment before changing the route; otherwise leave the request at its current step and display a configuration error.
- Preserve original route/rule snapshots and append route-change history atomically.
- Reject duplicate referrals, backward moves, loops, and changes to final requests.
- Grant target access only after the referral takes effect; retain referring faculty history/access.

Where a higher authority is already the next required step, **Approve and send to HOD** records an approval and advances normally. Referral records a deferral. If intermediate required steps remain, a referral must not erase them. Decide the detailed effect before enabling referral on multi-step routes; initially restrict referral to the last current step of an otherwise permitted route extension.

D13 allows configured higher-authority routes, but does not settle runtime faculty referral. Agree allowed referral targets, whether referral satisfies a lower authority's requirement, whether the higher authority may send it back, and what happens if the same faculty member fills two responsibilities. College events cannot omit required Dean approval merely to reach Principal directly. Recommend retaining separate responsibility steps with explicit actions until a different policy is approved.

## 6. Deliver in increments

1. Use D12's continuing cohort Tutor and D13's event-specific mandatory authorities; agree remaining class/year lifecycle, scoped assignment rules, first-Admin setup, and complete routes/forms for the first real request types.
2. Add protected Admin setup and assignment history. Migrate existing test classes/memberships after agreeing their academic-year mapping; preserve existing requests and Tutor snapshots.
3. Add configurable multi-step routes and the Tutor → HOD flow, then Dean/Principal. Test current/future reviewer access, last-step completion, rejection, missing assignments, concurrent decisions, and existing MVP compatibility.
4. Agree and add restricted referral as a separate action. Test route changes, permissions, mandatory-step preservation, duplicate actions, and history.
5. Add academic-year rollover and audited pending-request reassignment under agreed rules. Preserve completed decisions and prevent inactive users from acting.

Verify each increment locally and on the development deployment. This plan does not make invitations, documents, corrections, notifications, reports, or production operations complete; the broader roadmap remains [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Decisions required before implementation

- Q14 remaining: promotion/transfer/graduation behavior; D12 settles the continuing four-year cohort Tutor.
- Q2/Q3/Q9: first request types, permitted route choices, mandatory levels, and skipped-level rules.
- New referral decision: allowed source/target responsibilities, effect on required approvals, and subsequent processing.
- Q7/Q8: pending-request reassignment, assignment resolution timing, and overlapping faculty responsibilities.
- Q12: first/additional Admin provisioning and institutional email domains before account administration.

D12/D13 establish cohort Tutor and event-specific required authorities. The later D14 implementation approval also settles owner first-Admin bootstrap, test-login provisioning, batch setup without annual progression, guarded deactivation, and explicit pending Tutor transfer. Remaining multi-level/referral questions are not resolved merely by inclusion in this proposal. Record further approved answers in DECISIONS.md and update affected requirements before implementation.
