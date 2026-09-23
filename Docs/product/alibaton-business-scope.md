# Alibaton Business Context and CT2 Scope

**Status:** Stakeholder-provided business context and active scope decision  
**Last updated:** 2026-08-13

## Business context

Alibaton operates three related heavy-equipment business lines:

1. **Heavy-equipment rental** — making heavy equipment available for customer
   projects and coordinating its operational deployment.
2. **Heavy-equipment sales** — selling heavy equipment and handling the commercial
   activities that accompany a sale.
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

Core 2 receives three actionable **business transaction flows** from Core 1:
1. **Heavy-Equipment Service Flow** (Service Requests → Dispatches)
2. **Heavy-Equipment Rental Flow** (Rental Contracts → Equipment Prep & Hire)
3. **Heavy-Equipment Sales Flow** (Sales Orders → Transport & Handover)

Within Core 2, these 3 flows are scheduled, staffed, equipped, inspected, and governed by **5 core operational modules**:
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
- **Core HR (Core HCM, Employee Self-Service, Employee Records Management)**: External master of record for personnel identity, legal names, `employee_number`, emergency contacts, job titles, and employment status (Active, Resigned, Terminated). Core 2 ingests employee records to auto-provision user accounts for software users and maintain personnel profiles for non-software employees (such as Riggers), while enforcing automated session and token lockouts upon HR termination.
- **Workforce Management (Time & Attendance, Shift & Schedule Management, Timesheets, Leave Management, Workforce Analytics)**: External master of record for worker leave approvals (vacation, sick leave) and shift schedules. Core 2 ingests leave periods to set `availability_status = 'on_leave'`, preventing dispatch conflicts, and exports completed field work hours back to Timesheet Management.

See [Core HR & Workforce Management Integration Architecture](../architecture/hr-workforce-integration.md) and [Core HR & Workforce Boundary](./core-hr-workforce-boundary.md).

## Active capstone boundary

Core Transaction 2 (CT2) is the internal operational-control layer for service,
rental, and sale work received from Core 1. The active release covers a
transitional local service-intake path, dispatch and scheduling, personnel and
asset assignment, equipment readiness, field execution, rental and sale
operational slices, fuel, location sharing, maintenance, approvals, records,
and auditability.

The current repository now implements a partial, backend/API-first rental and
sales slice: rental reservations with approval, availability checks, qualified
operator assignment, checkout, time-window operation authorization, returns,
and condition records; plus sales catalog items, quotes, orders, inventory
reservation, fulfillment, and ownership transfer. These current
routes are transitional Core 2 scaffolding; the Core 2 receiving adapter and
authenticated upstream handoff are not yet implemented. Core 2 will not provide
Core 1's commercial experience, contracts, deposits, customer-facing screens,
payments, billing, or invoicing. The Core 2 gaps are its receiving boundary and
complete service/rental/sale dispatch or delivery handoffs.

| Alibaton business line | CT2 capstone posture | Current Core 2 evidence | Core 1 ownership / remaining Core 2 gap |
| --- | --- | --- | --- |
| Heavy-equipment rental | Partial backend/API operational slice | Transitional local reservation, availability conflicts, approval, qualified operator assignment, checkout, rental-window operation authorization, returns, condition records, and asset status updates | Core 1 owns rental transactions, contracts, deposits, payments, and billing; Core 2 still needs its receiving and dispatch handoffs |
| Heavy-equipment sales | Partial backend/API operational slice | Transitional catalog/quote/order mirror, inventory reservation/ledger, fulfillment, and ownership transfer | Core 1 owns commercial sales and customer/order terms, payments, invoicing, taxes, and accounting; Core 2 still needs its receiving and delivery handoffs |
| Heavy-equipment services | Active field-operations focus | Transitional local request-to-dispatch flow, field progression, tracking, inspections, maintenance, fuel, and audit | Core 1 owns client, job-order, project, and customer billing context; Core 2 still needs its receiving handoff |

## Documentation rule

Use “heavy-equipment service, rental, and sale operations received from Core 1”
when describing the Core 2 boundary. Do not describe Core 1 commercial sales
or rental functions as future Core 2 scope. Do not
describe the current asset register as sales inventory or the internal
maintenance workflow as a complete customer repair-service order system.

**Status clarification (2026-08-13):** Rental and sales have partial Core 2
backend/API operational implementations. Core 1 commercial functions are
outside this repository, not unfinished Core 2 features. Only the Core 2
receiving boundary and downstream operational handoffs remain Core 2 work.
