# Core HR and Workforce Management Involvement in Core Transaction 2

**Status:** Accepted system-boundary clarification  
**Last updated:** 2026-09-16  
**Applies to:** Core Transaction 2 (CT2) Identity Platform (`apps/operations/app/Platform/Identity`), Personnel Profiles, and Dispatch Operations

---

## Purpose

**Core HR** and **Workforce Management** are the upstream enterprise personnel, organizational, and scheduling systems for Alibaton. **Core Transaction 2 (Core 2)** is the downstream operational-control and field-execution system. 

Core 2 receives employee master profiles, employment lifecycle events, approved leaves, and shift schedules from Core HR and Workforce Management, using them to safely govern user accounts, operational roles, crane/driver assignment eligibility, and dispatch scheduling.

Core 2 must **not** be treated as the originating employee database, HRIS, corporate payroll engine, or employee leave management portal.

---

## Project Scope Clarification

Core HR and Workforce Management are **not part of this repository's implementation scope**. The Core 2 team will not build, replace, or maintain enterprise Core HR or Workforce Management software. Their modules are documented here to define the exact system boundaries and data exchange contracts.

Any future integration work in this repository is limited to the **Core 2 Ingestion & Synchronization Boundary**:
1. Authenticating upstream webhook events and scheduled sync requests,
2. Ingesting and deduplicating employee records by `employee_number`,
3. Provisioning Core-2 user accounts, passwords/MFA, and operational Spatie RBAC roles,
4. Setting real-time operational availability (`available` vs. `on_leave`), and
5. Enforcing an instantaneous session and token **kill-switch** when an employee is terminated in Core HR.

---

## Upstream Module Boundaries

```mermaid
flowchart TD
    subgraph CORE_HR["1. Core HR (Source of Truth for Identity & Lifecycle)"]
        H1["Core Human Capital Management (HCM)"]
        H2["Employee Self-Service (ESS)"]
        H3["Employee Records Management (added)"]
    end

    subgraph WFM["2. Workforce Management (Source of Truth for Availability & Shifts)"]
        W1["Time and Attendance System"]
        W2["Shift and Schedule Management"]
        W3["Timesheet Management"]
        W4["Leave Management"]
        W5["Workforce Analytics (added)"]
    end

    subgraph CORE_2["3. Core Transaction 2 (Operational Control Platform)"]
        C1["Identity, RBAC & Login Tokens (`apps/operations/app/Platform/Identity`)"]
        C2["PersonnelProfile: `employee_number`, `availability_status`"]
        C3["Credential & Eligibility Guard (`PersonnelCredential`)"]
        C4["Dispatch Scheduling & Field Execution (`apps/operations/app/Modules/Dispatch`)"]
    end

    CORE_HR -->|1. Employee Master (#, Name, Contact, Dept, Title, Active/Terminated)| CORE_2
    WFM -->|2. Approved Leave Periods & Shift Rosters| CORE_2
    CORE_2 -.->|3. Certified Field Hours & Job Completion Timestamps| WFM
```

---

## 1. Core HR Module Group

### Modules (as defined in Core HR):
- **Core Human Capital Management (HCM)**: Defines organizational structure: Official Department (*Heavy Lift Division, Transport, Field Maintenance*), Job Title (*Senior Heavy Equipment Operator, Transport Operator, Rigger*), and Official Employment Status (*Active, Probationary, Suspended, Resigned, Terminated*).
- **Employee Self-Service (ESS)**: Employee self-update portal for personal and contact info (synced down to Core 2).
- **Employee Records Management (added)**: The authoritative master data store for `employee_number`, legal names, official email, phone numbers, home address, emergency contacts, and statutory records.

### Core HR to Core 2 Ingestion:
1. **Account Auto-Provisioning & Employee Ingestion**: 
   - **Interactive Software Users**: Core 2 maps HR Job Titles for software roles (`Senior Heavy Equipment Operator` $\rightarrow$ `RoleName::CraneOperator` [canonical `Operator` role], `Transport Operator` $\rightarrow$ `RoleName::CraneOperator` [canonical `Operator` role], `Operations Coordinator` $\rightarrow$ `RoleName::OperationsManager`), provisions a [`User`](../../apps/operations/app/Platform/Identity/Models/User.php) login account, creates [`PersonnelProfile`](../../apps/operations/app/Platform/Identity/Models/PersonnelProfile.php) keyed by `employee_number`, and sends an activation email/SMS with a secure setup token.
   - **Non-Interactive Field Employees (Riggers)**: Field personnel whose duties do not require software operation (specifically **Riggers**) are ingested and maintained as operational employees ([`PersonnelProfile`](../../apps/operations/app/Platform/Identity/Models/PersonnelProfile.php) and [`PersonnelCredential`](../../apps/operations/app/Platform/Identity/Models/PersonnelCredential.php)) for crew dispatch assignment, TESDA/DOLE certification compliance, and critical lift planning, but are **not** provisioned with [`User`](../../apps/operations/app/Platform/Identity/Models/User.php) login credentials, web sessions, or mobile Sanctum API tokens.
2. **Instant Offboarding Kill-Switch**: When Core HR marks an employee as `Resigned` or `Terminated`, Core 2 immediately:
   - Sets `users.is_active = false` and `users.suspended_at = now()` (for provisioned users).
   - Sets `personnel_profiles.availability_status = 'unavailable'`.
   - Purges all active web sessions from the `sessions` table.
   - Revokes all mobile Sanctum bearer tokens (`personal_access_tokens` table).
   - Flags active dispatch assignments requiring immediate emergency reassignment.

---

## 2. Workforce Management Module Group

### Modules (as defined in Workforce Management):
- **Time and Attendance System**: Corporate biometric clock-in/out and depot attendance.
- **Shift and Schedule Management**: Manages weekly rosters, shift rotations (Day Shift 07:00–16:00, Night Shift 19:00–04:00), and rest days.
- **Timesheet Management**: Calculates payroll-ready hours, overtime, and night differentials.
- **Leave Management**: Approves and tracks Vacation Leave, Sick Leave, Emergency Leave, and Bereavement.
- **Workforce Analytics (added)**: Analyzes workforce productivity, overtime costs, and resource utilization.

### Workforce Management to Core 2 Interaction:
1. **Leave Availability Lockout**: Approved leaves automatically set [`PersonnelProfile::$availability_status`](../../apps/operations/app/Platform/Identity/Models/PersonnelProfile.php) to `'on_leave'`, preventing operations managers and AI schedulers from assigning them to jobs during their leave window.
2. **Shift Boundary Checking**: Operations managers cannot assign operators or crew members to jobs scheduled outside their active shift without supervisor exception approval.
3. **Field Hours Reconciliation**: Core 2 exports certified field work duration (Arrival on Site, Operation Duration, Job Completion Timestamps) back to Timesheet Management for field payroll processing.

---

## Core HR / WFM vs. Core 2 Responsibility Matrix

| Domain Responsibility | Core HR / WFM (Upstream Master) | Core 2 (Operational System) |
| :--- | :--- | :--- |
| **Employee Master Record** | **Authoritative Source** (`employee_number`, full legal name, contact details). | References `employee_number` via [`PersonnelProfile`](../../apps/operations/app/Platform/Identity/Models/PersonnelProfile.php) for all employees (including Riggers). |
| **Corporate Department & Title** | **Authoritative Source** (Official Title & Organizational Org Chart). | Maps Job Title to operational Spatie RBAC Role (`OperationsManager`, `Operator`) for software users; maps non-software titles (`Rigger`) to employee profiles without login credentials. |
| **Employment Status** | **Authoritative Source** (`Active`, `On Leave`, `Resigned`, `Terminated`). | Read-only mirror; triggers auto-suspension and assignment lockout upon termination. |
| **Shift Rosters & Approved Leave** | **Authoritative Source** (Leave approvals, Shift rosters). | Enforces `availability_status = on_leave` to prevent dispatch scheduling conflicts across all assigned personnel. |
| **System Access & Authentication** | Out of scope. | **Authoritative Source** for software users ([`User`](../../apps/operations/app/Platform/Identity/Models/User.php) login, password, 2FA, Sanctum mobile API tokens). Non-software field personnel (Riggers) receive no login credentials. |
| **Equipment & Crane Eligibility** | Stores baseline HR qualification files. | **Authoritative Source** for operational qualification matching (e.g. operator license vs machine tonnage/type, rigger TESDA NC II certification vs critical lift plan). |
| **Field Job Progression & Telemetry** | Out of scope. | **Authoritative Source** (Live GPS tracking, dispatch lifecycle progression, fuel requests) recorded via mobile/web by Operators and Field Foremen. |

---

## System Administrator Role in Core 2

Because Core HR and Workforce Management own employee creation and leave tracking, the **System Administrator in Core 2** focuses on:

1. **Integration Health & Ingestion Console**: Monitoring webhook delivery health, sync logs, and resolving failed ingestion errors via Dead-Letter Queue (DLQ).
2. **Role & Permission Mapping**: Configuring how upstream HR job titles translate into Core 2 operational roles and granular permissions, or designate employee-only roles without login accounts.
3. **Discrepancy Reconciliation**: Resolving data mismatches between Core HR staff and active Core 2 operational accounts.
4. **Emergency Domain Overrides**: Managing emergency personnel reassignments during field emergencies or unexpected operator incapacitation.

---

## Boundary Rules

1. **Core HR is the source of truth for employee identity and corporate employment status.**
2. **Workforce Management is the source of truth for shift rosters and approved leave.**
3. **Core 2 is the source of truth for operational availability, system login access, equipment eligibility, and field dispatch execution.**
4. **Core 2 never originates employee hiring or termination workflows; it ingests them.**
5. **A termination event in Core HR must atomically revoke all Core 2 sessions and mobile API tokens without delay.**
6. **Approved leaves in Workforce Management must immediately lock out operator and crew assignment in Core 2.**
7. **Non-software field employees (specifically Riggers) are tracked as employees with personnel profiles and certifications for dispatch scheduling, DOLE/TESDA compliance, and lift planning, but are not provisioned with web or mobile software accounts.**
