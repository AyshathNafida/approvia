# Small testable MVP proposal

Date: 2026-10-12. Status: **approved scope (D10); implementation and verification in progress**. The user explicitly selected the smaller flow and simple rules below. This expands the authentication-only increment D9; the larger institutional requirements remain future scope.

## Approved first complete flow

1. Existing test users sign in with email/password.
2. A student submits a General Request with title and description.
3. The backend resolves the class Tutor and creates one assigned approval step.
4. That Tutor approves or rejects with a required decision comment.
5. The student sees the status and preserved action history after refreshing or signing in again.

The approved route is Tutor only. Students do not select individual faculty. Account types remain separate from approval responsibilities. Class/Tutor configuration is prepared manually in Supabase for testing instead of adding Admin screens now.

## Approved simple rules

- Submission immediately enters In Review; Approved and Rejected are final.
- No request editing after submission in this increment.
- Missing/inactive class Tutor blocks submission.
- Resolve and retain the assigned Tutor at submission; class assignment changes affect future requests. Inactive users cannot act; a pending request assigned to an inactive Tutor waits for future reassignment support.
- Use protected account profiles and RLS: students see their own requests, faculty see current/completed assigned steps, and Admin receives no request-content/document access.

Drafts, supporting documents, correction/return/resubmission, cancellation, notifications, route customization, additional approval levels, reports, Admin screens, public signup, and recovery UI are deferred. Institutional production requirements remain future scope. D10 resolves the request type, selected route, statuses, mandatory decision comments, and assignment snapshots only for this narrow test increment; other Q2/Q7/Q8/Q9/Q10 behavior remains open for later expansion.

## Deployment and test approach

- Frontend: existing React/TypeScript/Vite project deployed from GitHub master to Vercel.
- Backend: Supabase approvia-dev, reference cypcgwcmavauezmxdbgb, matching the configured URL/key. The dashboard also contains a different project named approvia; it is not the configured test backend.
- Store schema, constraints, RLS, and transactional request operations in version-controlled migrations. Use persistent Supabase data rather than browser-only demo storage.
- Prepare a small set of test users and configurable institutional assignments without hard-coded faculty identities.
- Verify student submission → Tutor decision → student tracking, including denied unrelated-user access and duplicate decisions.
- Run existing authentication tests, appropriate new workflow/policy tests, lint, and production build; verify the resulting hosted deployment using the live Vercel URL.

## Read-only setup inspection

Before setup on 2026-10-12, inspected the approvia-dev dashboard and ran a read-only pg_catalog query. It returned no public application tables. The user provided https://approviaproject.vercel.app/ as the live Vercel URL, approved migration/profile setup (D11), and confirmed creating the two Auth users. See PROJECT_STATUS.md for actual application and verification results.
