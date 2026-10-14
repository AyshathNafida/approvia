# Approvia workflows

Status: required institutional behavior and illustrative flows, with D10's General Request → Tutor → final decision/status/history flow implemented for testing. Login/session restoration/logout, active-profile gating, student submission, and Tutor review screens exist. Other workflows below remain planned unless explicitly identified as implemented. Source: [requirements](PROJECT_REQUIREMENTS.md) sections 6, 8–14, 16–20, 22, and 26. Unsettled extensions are tracked in [DECISIONS.md](DECISIONS.md).

## Login and dashboard routing

The current MVP expands D9 with D10. Login loads the protected active profile: Student opens request submission/tracking; Faculty opens assigned Tutor reviews. Missing profiles receive setup guidance, inactive profiles are blocked, and Admin receives a placeholder without request contents or approval functions. Full Admin account-management and invitation screens remain planned.

D14 replaces the Admin placeholder with a configuration workspace: departments, four-year class batches, existing confirmed-user profile setup, student placement/status, and faculty responsibilities. The hosted migration and owner-bootstrap are applied; the frontend is deployed and Admin login/dashboard access is user-confirmed in Chrome. Full browser role-switching/reassignment acceptance remains pending. Invitations and multi-level processing remain deferred. See [ADMIN_SETUP.md](ADMIN_SETUP.md).

```text
Single login → Authentication → Read account type
  STUDENT → Student dashboard
  FACULTY → Faculty dashboard
  ADMIN   → Admin dashboard
```

Users do not choose their login account type. Students cannot switch themselves to Faculty or Admin. Backend authorization must deny manually accessed restricted pages/actions, alongside frontend access controls.

Approved on 2026-10-12 (D6): students and faculty receive Admin invitations after institutional record checks, verify their institutional email, and use email/password login with email password recovery. Public signup is not permitted. Accepted domains and Admin provisioning remain open. ADMIN accounts cannot approve requests (D7). See [ACCOUNT_ACCESS_PLAN.md](ACCOUNT_ACCESS_PLAN.md).

## Request creation and submission

1. The student creates a request and can save a draft.
2. The student supplies request information and supporting documents.
3. The student selects a permitted route of approval responsibilities under the request type's rules.
4. Approvia validates hierarchy order and required approval levels before submission.
5. Approvia resolves the responsible faculty through institutional assignments and processes the submitted request sequentially.

The source establishes validation before submission and automatic resolution, but does not settle the exact resolution time, transactional design, or complete submission error behavior.

Students must not manually find/select individual tutors or other approvers. See [DOMAIN_MODEL.md](DOMAIN_MODEL.md) for class, department, and institution-level resolution.

## Route selection and validation

The institutional hierarchy is Tutor → HOD → Dean → Principal. Invalid ordering examples include Principal → Tutor, Dean → Tutor → HOD, and HOD → Tutor.

Source section 12 offers two interface alternatives: responsibility checkboxes or predefined route options. Neither has been selected.

D10 selects a fixed Tutor-only route for the General Request test MVP. The backend resolves the student's class Tutor; students cannot supply an approver ID. Broader route-selection UI remains open.

Request types may define required approvers, optional approvers, minimum/maximum approval levels, and permission to customize the route. A valid hierarchy alone does not authorize a route that bypasses a request type's mandatory authorities.

The following are illustrative rules from source section 14, not a finalized request-type catalog:

| Example request category | Example rule |
|---|---|
| Simple Request | Tutor, or Tutor → HOD |
| Department-Level Request | Tutor → HOD required |
| Major Institutional Request | Tutor → HOD → Dean → Principal required |

Approved on 2026-10-14 (D13): event/request types define their mandatory approvals; class events require Tutor/HOD and college events require Dean/Principal. Configured routes may reach higher authorities directly while preserving hierarchy order and mandatory authorities. Complete routes remain open, including whether college events also require Tutor/HOD. Arbitrary checkbox combinations and runtime faculty referral are not authorized by this decision.

## Sequential processing example

Source section 16 describes Student A in CS-B submitting Event Permission through Tutor → HOD → Dean.

```text
Student A (CS-B, CS)
  → Faculty X (CS-B Tutor)
  → Faculty Y (CS HOD)
  → Faculty Z (Dean)
  → Approved
```

Approval by Faculty X advances the request to Faculty Y; approval by Faculty Y advances it to Faculty Z. Approval by the last required approver makes the request Approved. Principal is not required in this example. Names and request type are illustrative.

## Status and actions

| Primary request status | Meaning in the source context |
|---|---|
| Draft | Saved request before submission |
| Submitted | Request submitted for processing |
| In Review | Request under approval review |
| Returned | Request sent back for correction |
| Rejected | Request rejected |
| Approved | Required approval route completed successfully |
| Cancelled | Request cancelled where permitted |

These labels are not a complete state machine. Exact Submitted/In Review timing, transition permissions, and reopening behavior need later design. Step indicators such as Pending or Not Required in tracking examples are not additional primary request statuses. The example ID `APR-2026-0041` does not establish an identifier-generation policy.

D10 implements only In Review → Approved or Rejected. Submission immediately enters In Review, and both decisions are final with a required comment. No edits after submission, drafts, return/resubmission, cancellation, or standalone comments are included in this increment. UUIDs are stored as request identifiers; the UI shows their first eight characters for convenience.

Approvers can Approve, Reject, Return for Correction, and Add Comment. Each action records the request, approver, approval responsibility, action, comment, date, and time. The source does not specify comment requirements for each action or whether a standalone comment changes status.

## Corrections and cancellation

A request can be returned to the student for missing or incorrect information. The student updates permitted fields and resubmits, while all prior approval/action history remains preserved.

The source does not decide which fields/documents/routes can change, where approval resumes, or whether previous approvals must be repeated. Cancellation is supported only where permitted; eligible statuses and effects on pending steps are also unresolved.

## Tracking, notifications, and assignment changes

Students can track status and view approval history and approver comments. Tracking should represent the selected route and its approval progress; source section 17 provides an illustrative view.

Notifications belong to the initial scope, but their channels and delivery rules are unspecified. Significant actions must be audited as described in [SECURITY.md](SECURITY.md).

Changing an assignment directs future requests to the newly assigned faculty without code changes. In the approved test MVP (D10), pending requests keep the Tutor resolved at submission. Missing/inactive class/department/Tutor configuration blocks submission; inactive users cannot act. Existing requests assigned to an inactive Tutor wait for later reassignment support. Other institutional assignment scenarios remain open.

D14 adds an explicit Admin Tutor replacement operation that supersedes D10 pending retention for this operation. It transfers pending class reviews, records a REASSIGNED history action and old/new reviewer details, and changes current faculty access atomically. Completed reviews retain the original Tutor. A decision completed before replacement stays final; a transferred request cannot subsequently be decided by the old Tutor. Missing/invalid replacement or unresolved legacy pending-class mapping aborts the whole operation. Student class moves/deactivation and faculty deactivation are blocked until relevant pending work/assignments are resolved. HOD/Dean/Principal are configurable but do not yet process requests.

## Approved D15 request-workflow extension: 2026-10-14

User approved the typed-request/sequential-approval plan. General remains Tutor-only; Leave uses Tutor → HOD; Duty Leave uses Tutor → HOD → Dean; class events and department facilities use Tutor → HOD; college events and college facilities use Dean → Principal; internships/industrial visits use all four authorities. Required structured fields and Asia/Kolkata local date-time handling are specified in [REQUEST_WORKFLOWS.md](REQUEST_WORKFLOWS.md). Resolve all reviewers at submission, requiring distinct active Faculty for every role. Intermediate approval advances; rejection ends immediately and skips remaining steps. Scoped replacements transfer current/future unprocessed reviews and preserve completed decisions. Current responsibility holders gain access to final requests actually processed under that responsibility and saved scope, including predecessor history; skipped/unreached steps confer none. Admin request-content privacy remains. This explicitly supersedes the earlier Tutor-only limit, expands D14's transfer behavior and D8's archive visibility. Hosted status must be read from PROJECT_STATUS.md; approval alone is not deployment evidence. Attachments, referrals, editing, cancellation, group requests and external notifications remain deferred.
