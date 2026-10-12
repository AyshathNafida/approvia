# Approvia security and audit requirements

Status: required institutional controls, with small test MVP authentication, active profile checks, RLS, guarded submission/decision functions, preserved action history, and metadata audit events implemented under D10. Storage, invitation/account administration, full institutional identity validation, and broader workflows remain future work. Source: [requirements](PROJECT_REQUIREMENTS.md) sections 1, 6–8, 13–14, 18–20, and 23–25.

## Authentication and authorization

Use Supabase Auth with a single login interface. Read the authenticated user's account type to determine dashboard access; users do not select their own type at login.

Enforce access controls in the frontend and backend. Manually navigating to a restricted page or invoking a restricted operation must not bypass authorization. MVP PostgreSQL RLS allows students their own requests, assigned faculty current/completed requests, and Admin metadata/configuration only. Profiles are read-only from the browser. Both write RPCs recheck active account type and assignment; direct table writes are not granted. Remaining database/storage permissions need design when their features are added.

| Actor | Required authorization boundary |
|---|---|
| Student | May use student request capabilities; cannot approve, use faculty/Admin functions, change account roles, assign responsibilities, or modify institutional assignments |
| Faculty | May process only requests assigned to them according to their responsibilities |
| Admin | Administrative functions restricted to authorized Admin accounts; no automatic approval authority |

A student must not access another student's private request. Approved on 2026-10-12 (D8): faculty can read requests/documents for current or completed assigned approval steps, with no future-step access before their turn. Admin can read configuration, summary reports, and audit metadata, but not request contents or supporting documents. Audit/report fields must respect those content boundaries; exact fields and retention remain open. These are required policies, not implemented RLS.

Approval responsibility is separate from account type. The user resolved the section 6.3/7 conflict on 2026-10-12 (D7): only FACULTY accounts can hold approval responsibilities; ADMIN accounts cannot approve.

Approved provisioning/login policy (D6): Admin invites students/faculty after institutional record checks; no public signup. Require verified institutional email, email/password login, and email password recovery. Accepted email domains and first/additional Admin provisioning remain open. See [approved decisions](DECISIONS.md#approved-product-decisions-2026-10-12).

## Workflow and data integrity

- Validate the selected route before submission against the hierarchy and request-type requirements.
- Prevent students from bypassing mandatory authorities or assigning approval responsibility themselves.
- Resolve faculty from configured institutional assignments rather than trusting a student's choice of individual approver.
- Preserve prior approval/action history when a request is returned, edited, and resubmitted; do not silently modify or overwrite it.
- Record each approval action's request, approver, responsibility, action, comment, date, and time.

MVP request submission and Tutor decisions use database transactions. Decisions lock the request/step, require a pending assigned step and comment, and reject repeat final decisions. Approval actions cannot be edited/deleted by browser users. The submission-time Tutor is retained for pending requests under D10. Broader workflow versioning, document history, and concurrent multi-level operations remain future design work.

## Supporting documents

Students can upload supporting documents, and the intended storage platform is Supabase Storage. Secure document handling is a production requirement; file access must respect the applicable request and user authorization boundaries.

Document access follows the approved student/faculty/Admin visibility boundary above. Bucket layout, concrete storage policies, file type/size limits, upload validation, download implementation, replacement behavior, retention, and malware handling remain unspecified. See [DECISIONS.md](DECISIONS.md) for outstanding document-policy details.

## Audit coverage

The source requires an audit trail for significant system actions, including:

- Account creation and user activation/deactivation.
- Request creation, submission, modification, and cancellation.
- Document upload.
- Approval, rejection, and return for correction.
- Tutor, HOD, Dean, and Principal assignment changes.
- Workflow rule changes and administrative actions.

Approval history documents a request's approval actions; system audit logs cover broader institutional and administrative events. Preserve both concerns without assuming they share one storage model. The source does not define audit-log fields, retention, read permissions, or export behavior.

## Future verification targets

These are scenarios derived from the requirements, not tests already run:

- Student requests for faculty/Admin operations or another student's private request are denied.
- Faculty cannot process requests outside their authorized assignments/responsibilities.
- Account-role and institutional-assignment changes require authorized administration.
- Invalid hierarchy ordering and routes missing mandatory authorities cannot be submitted.
- Corrections and resubmission retain previous approval/action history.
- Required audit events are recorded and supporting document access follows designed permissions.

Select concrete testing tools and policy tests when the implementation exists. Consult [PROJECT_STATUS.md](PROJECT_STATUS.md) for verification actually completed.
