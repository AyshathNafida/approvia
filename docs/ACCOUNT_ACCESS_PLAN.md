# Approvia account and access plan

Latest approved update: **D16 (2026-10-24)** replaces manual new-login provisioning with Admin invitations, exact verified `lbscek.ac.in` email, password onboarding/recovery, and owner-approved identity-preserving migration (Admin first). Local implementation is prepared; SMTP, private mappings and hosted rollout remain pending. Separate email and domain-cutover switches default off. See [ACCOUNT_INVITATIONS.md](ACCOUNT_INVITATIONS.md); earlier MVP/D14 descriptions below are historical boundaries, not the new account interface.

Date: 2026-10-12. Status: **core policies approved; small MVP Student/Tutor access implemented**. The user selected Admin invitations/email-password login, faculty-only approval authority, and restricted read permissions. [DECISIONS.md](DECISIONS.md) D6–D8 record approval and rationale. D10 expands authentication-only D9 with manually prepared protected profiles, Student/Tutor workspaces, RLS, and guarded request functions. Automated provisioning, recovery UI, institutional-domain enforcement, and Admin screens remain deferred. Additional technical proposals and remaining questions below are labeled separately. Requirements sections 5–10 and 23–24 supply the original context.

Current implementation update (D14, 2026-10-14): Admin configuration screens and guarded backend operations are implemented/deployed. The hosted migration and approved dedicated confirmed first Admin bootstrap are applied; the user confirmed Admin password login/dashboard access in Chrome. Owner bootstrap accepts one dedicated existing confirmed Auth login for the first Admin. The dashboard provisions only existing confirmed Student/Faculty test logins, cannot overwrite account type, and excludes Admin edits/additional-Admin creation. Student placement/status and faculty deactivation are dependency-guarded. No unrestricted Auth directory or credentials are exposed. Development setup does not replace production institutional-domain/invitation requirements. Automated invitations, recovery UI, and institutional identity enforcement remain pending. See [ADMIN_SETUP.md](ADMIN_SETUP.md).

## Approved account provisioning (D6/Q12)

- Admin creates or invites student and faculty accounts after checking institutional records. No public signup.
- Institutional email must be verified. Use email/password login and email-based password recovery; the accepted institutional domains still need the institution's input.

## Additional implementation proposals and open setup details

D14 approves the controlled first-Admin owner bootstrap and dependency-guarded deactivation screens. Backend controls and the first Admin profile are applied to approvia-dev, the frontend is deployed, and Admin login/dashboard access is user-confirmed. Additional Admin provisioning remains outside this increment.

- The deployment owner establishes the first Admin through a controlled server-side setup. Users cannot grant themselves Admin access. Additional Admin provisioning needs an explicit authorized process.
- The account record stores the assigned account type and active/inactive status. User-editable authentication metadata must not grant roles or approval responsibilities.
- Students receive their class/department membership from authorized administration. They cannot change these assignments or their account type themselves.
- Inactive accounts are denied application data access and actions even if an authentication session remains valid. Deactivation preserves history; handling pending approval steps remains Q7.

## Established login behavior and proposed enforcement

One login screen authenticates the user through Supabase Auth. The application checks the protected account record and active status before choosing the Student, Faculty, or Admin dashboard. Accounts without an authorized active profile receive no application access. Frontend navigation checks supplement server/database enforcement.

## Approved responsibility eligibility (D7/Q1)

Only FACULTY accounts hold TUTOR, HOD, DEAN, or PRINCIPAL responsibilities. ADMIN accounts manage configuration and do not approve requests. The user's explicit choice resolves the original section 6.3/7 conflict in favor of faculty-only eligibility. A faculty member may hold multiple responsibilities, with class, department, or institutional scope as established by the requirements.

## Approved read permissions (D8/Q15; access portion of Q13)

| Account | Approved visibility | Established action boundary |
|---|---|---|
| Student | Own requests, their documents, approval progress/history, and comments | Student request actions; exact correction and cancellation permissions remain unresolved |
| Faculty | Requests and supporting documents for a currently assigned review step or a step they previously processed; no future-step access before their turn | May process only the current assigned step under an eligible responsibility |
| Admin | Institutional configuration, user administration, summary reports, and audit metadata; no request contents or supporting document access by default | Administrative operations; no automatic approval authority |

Admin audit views must omit request/document contents and comment bodies to respect the approved visibility boundary. Students and faculty can view relevant approval history; system-wide audit log access is not granted to them. Exact report fields, audit retention, file validation/retention, replacement rules, and assignment changes remain unresolved. Historical faculty access for completed assigned steps is now approved.

## Proposed implementation sequence

1. Confirm accepted institutional email domains and the first/additional Admin provisioning process.
2. Design profile, institutional membership, and responsibility-assignment migrations with RLS policies.
3. Establish controlled first-Admin setup and account invitations, including email delivery and redirect configuration.
4. Extend the existing single login with recovery, protected dashboards, and active-profile checks.
5. Verify denied access across account types, self-promotion attempts, inactive accounts, and unrelated users' records.

The test MVP request schema, one-step state machine, and RLS are implemented. Storage policies and production account setup remain future work.

## Approved D15 request-workflow extension: 2026-10-14

User approved the typed-request/sequential-approval plan. General remains Tutor-only; Leave uses Tutor → HOD; Duty Leave uses Tutor → HOD → Dean; class events and department facilities use Tutor → HOD; college events and college facilities use Dean → Principal; internships/industrial visits use all four authorities. Required structured fields and Asia/Kolkata local date-time handling are specified in [REQUEST_WORKFLOWS.md](REQUEST_WORKFLOWS.md). Resolve all reviewers at submission, requiring distinct active Faculty for every role. Intermediate approval advances; rejection ends immediately and skips remaining steps. Scoped replacements transfer current/future unprocessed reviews and preserve completed decisions. Current responsibility holders gain access to final requests actually processed under that responsibility and saved scope, including predecessor history; skipped/unreached steps confer none. Admin request-content privacy remains. This explicitly supersedes the earlier Tutor-only limit, expands D14's transfer behavior and D8's archive visibility. Hosted status must be read from PROJECT_STATUS.md; approval alone is not deployment evidence. Attachments, referrals, editing, cancellation, group requests and external notifications remain deferred.
