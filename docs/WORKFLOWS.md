# Approvia workflows

Status: required behavior and illustrative flows; no approval engine or UI exists yet. Source: [requirements](PROJECT_REQUIREMENTS.md) sections 6, 8–14, 16–20, 22, and 26. Unsettled behavior is tracked in [DECISIONS.md](DECISIONS.md).

## Login and dashboard routing

```text
Single login → Authentication → Read account type
  STUDENT → Student dashboard
  FACULTY → Faculty dashboard
  ADMIN   → Admin dashboard
```

Users do not choose their login account type. Students cannot switch themselves to Faculty or Admin. Backend authorization must deny manually accessed restricted pages/actions, alongside frontend access controls.

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

Request types may define required approvers, optional approvers, minimum/maximum approval levels, and permission to customize the route. A valid hierarchy alone does not authorize a route that bypasses a request type's mandatory authorities.

The following are illustrative rules from source section 14, not a finalized request-type catalog:

| Example request category | Example rule |
|---|---|
| Simple Request | Tutor, or Tutor → HOD |
| Department-Level Request | Tutor → HOD required |
| Major Institutional Request | Tutor → HOD → Dean → Principal required |

Whether an ordered route may omit intermediate levels or start above Tutor remains unresolved. Do not infer that arbitrary checkbox combinations are permitted.

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

Approvers can Approve, Reject, Return for Correction, and Add Comment. Each action records the request, approver, approval responsibility, action, comment, date, and time. The source does not specify comment requirements for each action or whether a standalone comment changes status.

## Corrections and cancellation

A request can be returned to the student for missing or incorrect information. The student updates permitted fields and resubmits, while all prior approval/action history remains preserved.

The source does not decide which fields/documents/routes can change, where approval resumes, or whether previous approvals must be repeated. Cancellation is supported only where permitted; eligible statuses and effects on pending steps are also unresolved.

## Tracking, notifications, and assignment changes

Students can track status and view approval history and approver comments. Tracking should represent the selected route and its approval progress; source section 17 provides an illustrative view.

Notifications belong to the initial scope, but their channels and delivery rules are unspecified. Significant actions must be audited as described in [SECURITY.md](SECURITY.md).

Changing an assignment directs future requests to the newly assigned faculty without code changes. The handling of existing pending steps, unavailable/inactive approvers, and missing assignments needs an explicit decision before implementation.
