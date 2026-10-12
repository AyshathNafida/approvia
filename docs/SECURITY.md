# Approvia security and audit requirements

Status: required controls, not implemented security. Source: [requirements](PROJECT_REQUIREMENTS.md) sections 1, 6–8, 13–14, 18–20, and 23–25.

## Authentication and authorization

Use Supabase Auth with a single login interface. Read the authenticated user's account type to determine dashboard access; users do not select their own type at login.

Enforce access controls in the frontend and backend. Manually navigating to a restricted page or invoking a restricted operation must not bypass authorization. Database authorization is intended to use PostgreSQL Row Level Security. Detailed RLS policies are not yet designed.

| Actor | Required authorization boundary |
|---|---|
| Student | May use student request capabilities; cannot approve, use faculty/Admin functions, change account roles, assign responsibilities, or modify institutional assignments |
| Faculty | May process only requests assigned to them according to their responsibilities |
| Admin | Administrative functions restricted to authorized Admin accounts; no automatic approval authority |

A student must not access another student's private request without authorization. The source does not establish unrestricted faculty browsing or detailed Admin request/document read access. Those permissions must be designed explicitly.

Approval responsibility is separate from account type. Source section 7 limits assignments to eligible faculty, while section 6.3 suggests an Admin exception. Admin approval eligibility is an [open question](DECISIONS.md#open-questions), not an implemented permission.

## Workflow and data integrity

- Validate the selected route before submission against the hierarchy and request-type requirements.
- Prevent students from bypassing mandatory authorities or assigning approval responsibility themselves.
- Resolve faculty from configured institutional assignments rather than trusting a student's choice of individual approver.
- Preserve prior approval/action history when a request is returned, edited, and resubmitted; do not silently modify or overwrite it.
- Record each approval action's request, approver, responsibility, action, comment, date, and time.

Transaction boundaries, duplicate/concurrent action handling, history storage mechanics, and assignment-version behavior require later design. Recording history does not establish a chosen schema or immutable-storage implementation.

## Supporting documents

Students can upload supporting documents, and the intended storage platform is Supabase Storage. Secure document handling is a production requirement; file access must respect the applicable request and user authorization boundaries.

Bucket layout, access policies, file type/size limits, upload validation, download authorization details, replacement behavior, retention, and malware handling are not specified. Do not present any of these as selected controls. See [DECISIONS.md](DECISIONS.md) for the outstanding document-policy decision.

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
