# Alibaton Business Context and CT2 Scope

**Status:** Stakeholder-provided business context and active scope decision  
**Last updated:** 2026-09-25

## Business context

Alibaton operates three related heavy-equipment business lines:

1. **Heavy-equipment rental** — making heavy equipment available for customer
   projects and coordinating its operational deployment.
2. **Heavy-equipment sales** — selling heavy equipment and handling the commercial
   activities that accompany a sale. Any sales activity is handled by Core 1
   and is outside Core 2; Core 2 does not receive or fulfill sale handoffs.
3. **Heavy-equipment services** — providing field work and service activities
   supported by qualified personnel, heavy equipment, maintenance, and logistics.

This business description was supplied by the project stakeholder for the
current capstone update. The historical requirements questionnaire remains an
empirical record of observed operations; it does not itself establish sales or
rental-commerce requirements.

## Core 1 and Core 2 boundary

Core 1 contains Sales Management, Customer Relationship Management (CRM),
Client Management, Job Order Management, Rental Management, and Project
Management. It is the upstream source for customer, commercial, rental, job,
and project transactions. 

Core 2 receives two actionable **business transaction flows** from Core 1:
1. **Heavy-Equipment Service Flow** (Service Requests → Dispatches)
2. **Heavy-Equipment Rental Flow** (Rental Contracts → Equipment Prep & Hire)

Authorized Core 2 users can also create a direct (manual) dispatch when no
Core 1 handoff exists. Core 2 formerly processed a third, sales flow; that
Sales module was removed on 2026-09-25 and existing sale-sourced dispatches
were converted to direct dispatches.

Within Core 2, these flows are scheduled, staffed, equipped, inspected, and governed by **5 core operational modules**:
1. **Dispatch Job and Scheduling**
2. **Driver/Operator and Equipment Assignment**
3. **Fleet Management**
4. **Crane and Equipment Management**
5. **Fuel Management**

Core 1 is an external dependency and is not an implementation deliverable of
this repository. Core 2 will not build or maintain Core 1. Work in this project
is limited to Core 2 operational processing and, if implemented, Core 2's
secured receiving boundary for upstream handoffs.

## Core HR and Workforce Management boundary

Core 2 does not serve as the enterprise Human Resources Information System (HRIS) or payroll engine:
- **Core HR (Core HCM, Employee Self-Service, Employee Records Management)**: External master of record for personnel identity, legal names, `employee_number`, emergency contacts, job titles, and employment status (Active, Resigned, Terminated). Core 2 ingests employee records to auto-provision user accounts for software users and maintain their personnel profiles, while enforcing automated session and token lockouts upon HR termination.
- **Workforce Management (Time & Attendance, Shift & Schedule Management, Timesheets, Leave Management, Workforce Analytics)**: External master of record for worker leave approvals (vacation, sick leave) and shift schedules. Core 2 ingests leave periods to set `availability_status = 'on_leave'`, preventing dispatch conflicts, and exports completed field work hours back to Timesheet Management.

See [Core HR & Workforce Management Integration Architecture](../architecture/hr-workforce-integration.md) and [Core HR & Workforce Boundary](./core-hr-workforce-boundary.md).

## Active capstone boundary

Core Transaction 2 (CT2) is the internal operational-control layer for service
and rental work received from Core 1, plus direct dispatch. The active release covers a
transitional local service-intake path, dispatch and scheduling, personnel and
asset assignment, equipment readiness, field execution, the rental
operational slice, fuel, location sharing, maintenance, approvals, records,
and auditability.

The current repository implements a partial, backend/API-first rental
slice: rental reservations with approval, availability checks, qualified
operator assignment, checkout, time-window operation authorization, returns,
and condition records. These current
routes are transitional Core 2 scaffolding; the Core 2 receiving adapter and
authenticated upstream handoff are not yet implemented. Core 2 will not provide
Core 1's commercial experience, contracts, deposits, customer-facing screens,
payments, billing, or invoicing. The Core 2 gaps are its receiving boundary and
complete service/rental dispatch or delivery handoffs.

| Alibaton business line | CT2 capstone posture | Current Core 2 evidence | Core 1 ownership / remaining Core 2 gap |
| --- | --- | --- | --- |
| Heavy-equipment rental | Partial backend/API operational slice | Transitional local reservation, availability conflicts, approval, qualified operator assignment, checkout, rental-window operation authorization, returns, condition records, and asset status updates | Core 1 owns rental transactions, contracts, deposits, payments, and billing; Core 2 still needs its receiving and dispatch handoffs |
| Heavy-equipment sales | Outside Core 2 (Sales module removed 2026-09-25) | None; Core 2 does not receive or fulfill sale handoffs | Handled by Core 1; no Core 2 gap |
| Heavy-equipment services | Active field-operations focus | Transitional local request-to-dispatch flow, field progression, tracking, inspections, maintenance, fuel, and audit | Core 1 owns client, job-order, project, and customer billing context; Core 2 still needs its receiving handoff |

## Documentation rule

Use “heavy-equipment service and rental operations received from Core 1”
when describing the Core 2 boundary. Do not describe Core 1 commercial sales
or rental functions as future Core 2 scope. Do not
describe the current asset register as sales inventory or the internal
maintenance workflow as a complete customer repair-service order system.

**Status clarification (2026-09-25):** Rental has a partial Core 2
backend/API operational implementation. Sales is no longer a Core 2 capability. Core 1 commercial functions are
outside this repository, not unfinished Core 2 features. Only the Core 2
receiving boundary and downstream operational handoffs remain Core 2 work.
