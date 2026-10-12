# APPROVIA

## Institutional Digital Approval Management System

## 1. Project Overview

Approvia is a centralized digital approval management system designed for educational institutions.

The system replaces paper-based and fragmented approval processes with a structured digital workflow through which students can submit requests, select an appropriate approval route, upload supporting documents, track progress, and receive decisions from authorized institutional authorities.

Approvia is intended for real deployment within a college environment. The system must therefore provide:

- Secure authentication
- Role-based authorization
- Structured approval routing
- Auditability
- Data integrity
- Maintainability
- Scalability
- Configurable institutional structure
- Secure document handling

---

# 2. Institutional Structure

The institution consists of multiple academic departments.

The initial departments are:

- Information Technology — IT
- Computer Science and Engineering — CS
- Electrical and Electronics Engineering — EEE
- Electronics and Communication Engineering — EC
- Mechanical Engineering — MECH
- Artificial Intelligence and Data Science — AIDS
- Computer Science and Business Systems — CSBS

Departments must not be hard-coded into the application.

An authorized administrator must be able to:

- Add departments
- Edit department information
- Activate departments
- Deactivate departments

This allows Approvia to adapt to future changes in the institution.

---

# 3. Class / Division Structure

A department may contain one or more classes or divisions.

For example:

## Computer Science and Engineering

- CS-A
- CS-B
- CS-C

Other departments may contain only one class or multiple divisions depending on the institution.

Therefore, classes must be stored separately from departments.

Conceptually:

```text
Department
    │
    └── Classes / Divisions
```

Example:

```text
CS
├── CS-A
├── CS-B
└── CS-C
```

Each student must belong to one active class or division.

---

# 4. Tutor Assignment

Each class or division has one assigned tutor.

Example:

```text
CS-A → Faculty A
CS-B → Faculty B
CS-C → Faculty C
IT   → Faculty D
```

Tutor assignments are maintained by the administrator.

Students must not manually search for or select their tutor.

Instead, Approvia automatically determines the correct tutor using the student's class.

Conceptually:

```text
Student
   ↓
Class
   ↓
Assigned Tutor
```

Example:

```text
Student → CS-B → CS-B Tutor
```

Therefore, whenever `Tutor` appears in an approval workflow, Approvia automatically resolves the correct faculty member.

---

# 5. Student Model

All students use the same Student account type.

Students do not need classifications such as:

- Class Coordinator
- Student Representative
- Class Leader

unless such features are introduced later.

Each student profile should contain:

- Student ID / Admission Number
- Full Name
- Institutional Email
- Department
- Class / Division
- Current Semester
- Batch
- Account Status

Example:

```text
Student ID: KSD23IT005
Name: Student Name
Department: IT
Class: IT
Semester: S7
Batch: 2023–2027
```

---

# 6. Account Types

Approvia initially supports three account types:

1. Student
2. Faculty
3. Admin

Account type determines the basic access permissions of a user.

---

## 6.1 Student Account

Students can:

- Create requests
- Save requests as drafts
- Select permitted approval routes
- Upload supporting documents
- Submit requests
- Track request status
- View approval history
- View approver comments
- Respond to returned requests
- Cancel requests where permitted

Students cannot:

- Access faculty approval functions
- Access administrative functions
- Change their own account type
- Assign approval responsibilities

---

## 6.2 Faculty Account

Faculty accounts are used by teaching staff and institutional authorities.

A faculty account may additionally hold one or more approval responsibilities.

Possible responsibilities include:

- Tutor
- HOD
- Dean
- Principal

Example:

```text
Account Type: FACULTY
Responsibility: TUTOR
Assigned Class: CS-B
```

Another faculty member may have:

```text
Account Type: FACULTY
Responsibility: HOD
Assigned Department: CS
```

---

## 6.3 Admin Account

The Admin manages institutional configuration and system data.

Admin responsibilities include:

- Managing departments
- Managing classes/divisions
- Managing student accounts
- Managing faculty accounts
- Assigning tutors
- Assigning HODs
- Assigning Dean
- Assigning Principal
- Managing request types
- Managing workflow rules
- Managing academic years
- Activating/deactivating accounts
- Viewing administrative reports
- Managing system configuration

The Admin does not automatically act as an approver unless explicitly assigned an eligible approval responsibility.

---

# 7. Account Type and Approval Responsibility

Account type and approval responsibility are separate concepts.

## Account Types

```text
STUDENT
FACULTY
ADMIN
```

These define what kind of user is accessing the system.

## Approval Responsibilities

```text
TUTOR
HOD
DEAN
PRINCIPAL
```

These define institutional approval authority.

Approval responsibilities are assigned only to eligible faculty accounts.

Example:

```text
Faculty X

Account Type:
FACULTY

Responsibility:
TUTOR

Assigned To:
CS-B
```

Another example:

```text
Faculty Y

Account Type:
FACULTY

Responsibility:
HOD

Assigned To:
CS Department
```

This separation allows institutional responsibilities to change without changing the user's main account.

---

# 8. Login and Access Control

Approvia uses a single login interface.

Users do not manually choose whether they are logging in as:

- Student
- Faculty
- Admin

Instead, after authentication, Approvia determines the user's account type automatically.

Conceptually:

```text
Login
  ↓
Authentication
  ↓
Read Account Type
  ↓
┌──────────┬──────────┬─────────┐
Student    Faculty     Admin
  ↓           ↓          ↓
Student     Faculty    Admin
Dashboard   Dashboard  Dashboard
```

A student cannot switch themselves to Faculty or Admin.

A user attempting to manually access a restricted page must also be denied by backend authorization policies.

---

# 9. Approver Types

The initial approval responsibilities supported by Approvia are:

1. Tutor
2. HOD
3. Dean
4. Principal

These represent institutional responsibilities rather than manually selected individual users.

Approvia resolves the correct person automatically.

---

# 10. Approver Resolution

## 10.1 Tutor

Tutor is resolved using:

```text
Student
   ↓
Student's Class
   ↓
Assigned Tutor
```

Example:

```text
Student Class: CS-B
CS-B Tutor: Faculty X
```

Therefore:

```text
Tutor → Faculty X
```

---

## 10.2 HOD

HOD is resolved using:

```text
Student
   ↓
Student's Department
   ↓
Assigned Department HOD
```

Example:

```text
Student Department: CS
CS HOD: Faculty Y
```

Therefore:

```text
HOD → Faculty Y
```

---

## 10.3 Dean

Dean is an institution-level approval responsibility.

The administrator assigns the currently active Dean.

Therefore:

```text
Dean → Currently Assigned Dean
```

---

## 10.4 Principal

Principal is an institution-level approval responsibility.

The administrator assigns the currently active Principal.

Therefore:

```text
Principal → Currently Assigned Principal
```

---

# 11. User-Selected Approval Workflow

Approvia allows the requester to select the required approval route while creating a request.

The requester selects approval responsibilities rather than individual people.

Example:

```text
Tutor → HOD
```

Approvia resolves this automatically into:

```text
Student's Tutor
       ↓
Student's Department HOD
```

Another request may require:

```text
Tutor → HOD → Dean → Principal
```

The corresponding faculty members are resolved automatically.

---

# 12. Workflow Selection Interface

During request submission, a student may select a permitted approval route.

Example interface:

```text
Approval Route

☑ Tutor
☑ HOD
☐ Dean
☐ Principal
```

Result:

```text
Tutor → HOD
```

Another possible interface is to provide predefined route options:

- Tutor only
- Tutor → HOD
- Tutor → HOD → Dean
- Tutor → HOD → Dean → Principal

The final interface should be selected based on usability and institutional requirements.

---

# 13. Workflow Validation

The student must not be able to create an invalid approval sequence.

The institutional hierarchy is:

```text
Tutor
  ↓
HOD
  ↓
Dean
  ↓
Principal
```

Invalid examples include:

```text
Principal → Tutor
```

```text
Dean → Tutor → HOD
```

```text
HOD → Tutor
```

Approvia must validate the route before the request is submitted.

---

# 14. Request-Type Workflow Rules

Different request types may require different approval levels.

For example:

## Simple Request

Allowed:

```text
Tutor
```

or

```text
Tutor → HOD
```

## Department-Level Request

Required:

```text
Tutor → HOD
```

## Major Institutional Request

Required:

```text
Tutor → HOD → Dean → Principal
```

Each request type may define:

- Required approvers
- Optional approvers
- Minimum approval level
- Maximum approval level
- Whether the requester can customize the route

This prevents users from bypassing mandatory authorities.

---

# 15. Department Structure Model

Conceptual institutional structure:

```text
Institution
│
├── IT
│   └── IT
│       └── Tutor
│
├── CS
│   ├── CS-A
│   │   └── Tutor
│   ├── CS-B
│   │   └── Tutor
│   └── CS-C
│       └── Tutor
│
├── EEE
│   └── Class / Division
│       └── Tutor
│
├── EC
│   └── Class / Division
│       └── Tutor
│
├── MECH
│   └── Class / Division
│       └── Tutor
│
├── AIDS
│   └── Class / Division
│       └── Tutor
│
└── CSBS
    └── Class / Division
        └── Tutor
```

Each department contains:

- Department information
- Department HOD
- Classes/divisions
- Students
- Faculty members

---

# 16. Request Processing Example

Consider the following student:

```text
Student: Student A
Department: CS
Class: CS-B
```

Institutional assignments:

```text
CS-B Tutor: Faculty X
CS HOD: Faculty Y
Dean: Faculty Z
Principal: Faculty P
```

The student submits an Event Permission request.

Selected approval route:

```text
Tutor → HOD → Dean
```

Approvia resolves the route as:

```text
Student A
   ↓
Faculty X
CS-B Tutor
   ↓
Faculty Y
CS HOD
   ↓
Faculty Z
Dean
```

When Faculty X approves, the request moves to Faculty Y.

When Faculty Y approves, it moves to Faculty Z.

When Faculty Z approves, the request becomes:

```text
APPROVED
```

---

# 17. Request Status

Primary request statuses are:

- Draft
- Submitted
- In Review
- Returned
- Rejected
- Approved
- Cancelled

Example tracking view:

```text
Event Permission

Request ID:
APR-2026-0041

Submitted
✓ Completed

Tutor
✓ Approved

HOD
✓ Approved

Dean
● Pending

Principal
Not Required
```

---

# 18. Approval Actions

An approver may perform the following actions:

- Approve
- Reject
- Return for Correction
- Add Comment

Every approval action must record:

- Request
- Approver
- Approval responsibility
- Action
- Comment
- Date
- Time

Approval history must not be silently modified or overwritten.

---

# 19. Returned Requests

If an approver finds missing or incorrect information, the request may be returned to the student.

Example:

```text
Student
   ↓
Tutor
   ↓
HOD
   ↓
Returned for Correction
```

The student can update the permitted fields and resubmit the request.

Approvia must preserve the previous approval and action history.

---

# 20. Audit Requirements

Approvia must maintain an audit trail for significant system actions.

Events to record include:

- Account creation
- Request creation
- Request submission
- Request modification
- Document upload
- Approval
- Rejection
- Return for correction
- Request cancellation
- Tutor assignment change
- HOD assignment change
- Dean assignment change
- Principal assignment change
- Workflow rule changes
- User activation/deactivation
- Administrative actions

The audit trail is essential because Approvia is intended for institutional deployment.

---

# 21. Core Data Entities

The initial system should contain entities representing:

- Users
- Student Profiles
- Faculty Profiles
- Departments
- Classes / Divisions
- Account Types
- Approval Responsibilities
- Tutor Assignments
- HOD Assignments
- Dean Assignment
- Principal Assignment
- Request Types
- Requests
- Request Fields
- Request Documents
- Workflow Rules
- Selected Approval Routes
- Approval Steps
- Approval Actions
- Notifications
- Audit Logs
- Academic Years

---

# 22. Core Design Principle

Approvia must not hard-code individual faculty members into approval workflows.

Incorrect approach:

```text
CS-B requests always go to Faculty X
```

Correct approach:

```text
CS-B request requires Tutor
        ↓
Find current CS-B Tutor
        ↓
Route request to that faculty member
```

If the tutor changes:

```text
CS-B Tutor

Faculty X
   ↓
Faculty Q
```

the administrator changes only the tutor assignment.

All future requests automatically go to Faculty Q.

No source-code modification is required.

The same principle applies to:

- HOD
- Dean
- Principal

---

# 23. Security Principles

Approvia must apply access control at both frontend and backend levels.

A student must not be able to:

- Access another student's private request without authorization
- Access faculty approval pages
- Approve requests
- Access the Admin dashboard
- Change account roles
- Modify institutional assignments

Faculty members must only be able to process requests assigned to them according to their responsibilities.

Admin access must be restricted to authorized administrative accounts.

Database-level authorization should be enforced using PostgreSQL Row Level Security.

---

# 24. Initial Technology Architecture

## Frontend

- React
- TypeScript
- Vite

## Backend Platform

- Supabase

## Database

- PostgreSQL

## Authentication

- Supabase Auth

## Authorization

- PostgreSQL Row Level Security

## File Storage

- Supabase Storage

## Server-Side Business Logic

- Supabase Edge Functions
- PostgreSQL Functions where appropriate

## Version Control

- Git
- GitHub

---

# 25. Production Objective

Approvia will be designed as an institutional system rather than only as an academic prototype.

The architecture should support:

- Security
- Scalability
- Maintainability
- Auditability
- Configurability
- Data integrity
- Role-based access control
- Multiple departments
- Multiple classes/divisions
- Changing tutor assignments
- Changing institutional authorities
- Configurable approval workflows
- Future integration with existing college systems
- Future expansion without major redesign

---

# 26. Initial Scope Summary

The first production version of Approvia will support:

```text
Student Login
       ↓
Request Creation
       ↓
Approval Route Selection
       ↓
Automatic Approver Resolution
       ↓
Tutor / HOD / Dean / Principal
       ↓
Approval Processing
       ↓
Status Tracking
       ↓
Notifications
       ↓
Audit History
```

The system will maintain separate account types for:

```text
STUDENT
FACULTY
ADMIN
```

Faculty members may additionally hold approval responsibilities:

```text
TUTOR
HOD
DEAN
PRINCIPAL
```

This model forms the foundation for the Approvia database, authentication system, approval engine, and user interface.