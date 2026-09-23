# Core Transaction 2 — Product Requirements Document

> **Capstone Project Title:**  
> **DESIGN AND IMPLEMENTATION OF A GPT MINI POWERED DISPATCH AND RESOURCE MANAGEMENT PLATFORM WITH MOBILE APPLICATION FOR REAL TIME TRACKING FOR FIELD SERVICE MONITORING**

**Document status:** Living product definition  
**Last updated:** 2026-09-16  
**Product stage:** Working vertical slices with remaining prototype-only surfaces

## 1. Product summary

Alibaton operates heavy-equipment rental, heavy-equipment sales, and related
heavy-equipment services. Core Transaction 1 (Core 1) owns the customer,
commercial, job-order, rental, and project context. Core Transaction 2 (CT2)
receives Core 1 handoffs for **service, rental, and sale** and turns the
operational portion into scheduled, staffed, equipped, tracked, and auditable
work. It brings dispatch, assignments, fleet and equipment readiness, fuel,
location sharing, maintenance, approvals, SOS emergency safety, and administration into one
role-aware workspace. The commercial boundary is documented in [Alibaton Business Context and CT2 Scope](./alibaton-business-scope.md). External **Core HR** (Core HCM, Employee Self-Service, Employee Records Management) owns master employee identity, while external **Workforce Management** (Time & Attendance, Shift & Schedule Management, Timesheets, Leave Management, Workforce Analytics) owns worker leave approvals and rosters. Core 2 receives upstream commercial handoffs from Core 1 and employee/availability sync from Core HR and Workforce Management. See [Core HR & Workforce Boundary](./core-hr-workforce-boundary.md) and [Core HR & Workforce Integration Architecture](../architecture/hr-workforce-integration.md).

The product now implements the service operational flow plus partial API-first
rental and sales operational slices. Core 1 remains the source of truth for
commercial contracts, deposits, customer-facing screens, payments, billing,
and invoicing. Core 1 itself is outside this project's implementation scope.
The Core 2 receiving boundary and complete dispatch/delivery integration remain
unfinished.

The product supports **3 canonical system users**:

- **System Administrator** (`system_administrator`) — Platform configuration, user lifecycle, role-based access control, master data management, and system auditing.
- **Operations Manager** (`operations_manager`) — Dispatch operations desk, resource assignment, schedule approvals, fleet/crane oversight, fuel logistics, and emergency SOS incident triage.
- **Operator** (`operator` / `crane_operator`) — Field mobile application user executing dispatch trips, heavy crane lift operations, equipment telemetry, DVIR pre/post-trip safety inspections, HoS status recording, and SOS emergency triggers.

*(Workforce field personnel such as Riggers are non-software workforce crew tracked via `PersonnelProfile` and credentials without direct system login accounts).*

Following role consolidation, supervisory safety oversight, incident response, and lift authorization are unified into `Operations Manager`, while field checklists, hazard reporting, DVIR inspections, and TBM submissions are performed by the `Operator`. Riggers are maintained as employee records (`PersonnelProfile` and `PersonnelCredential`) for dispatch scheduling, DOLE/TESDA certification compliance, and critical lift planning, but do not hold software user accounts.

The operational core is built upon **5 Main Operational Business Modules**:
1. **Dispatch Job and Scheduling (Real-Time Activation)** — Job intake, route planning, shift scheduling, real-time activation, and multi-phase project planning.
2. **Assign Driver/Operator and Equipment** — Crew qualification matching, heavy equipment reservation, operator assignment, and Hours of Service (HoS) compliance.
3. **Fleet Management** — Hauling trucks, service vehicles, real-time GPS telemetry, mobile tracking, and Driver Vehicle Inspection Reports (DVIR).
4. **Crane and Equipment Management** — Heavy cranes, boom extensions, rigging gear, load capacity verification, and crane safety compliance.
5. **Fuel Management** — On-site tank levels, mobile fuel bowser replenishment, fuel logs, and consumption analytics.

*(Note: DVIR inspections, Hours of Service compliance, Emergency SOS, and Statutory Safety Governance operate as sub-features and platform services embedded across these 5 modules and the mobile application).*

These 5 operational modules execute and govern the **three tri-modal business transaction flows** received from Core 1:
- **Field Service Flow**: Field service requests converted into scheduled, staffed, and executed dispatches and project plans.
- **Rental Flow**: Equipment rental reservations, pre-checkout condition inspections, operator assignments, active rental deployment, and return check-ins.
- **Sales Flow**: Sales order fulfillment, inventory reservations, delivery logistics, serial/VIN verification, and ownership transfer.

Identity & RBAC, live tracking & telemetry, statutory safety governance (DOLE OSHS Rule 1410 & DO 198-18), SOS emergency response, audit trail, notifications, reports & attachments, data exports, and GPT assistance serve as shared cross-cutting platform services. Real-time updates are broadcast across all active clients using Laravel Reverb WebSockets.

## 2. Problem

Dispatch decisions are difficult when job requirements, qualified personnel, asset readiness, approvals, fuel activity, and field progress live in separate channels. Based on empirical findings from operational personnel ([BSIT Capstone Requirements Questionnaire](../archive/consolidated/supplements/capstone-requirements-questionnaire.md)), current manual scheduling via OneDrive/Excel activity calendars leads to **frequent double bookings**, personnel qualification bottlenecks via physical HR/201 files, unmonitored equipment breakdowns (hydraulic/electrical leaks and wear), untracked heavy assets, excessive fuel consumption, and significant idle ("waiting") time.

CT2 must give office users a fast, information-dense decision surface and field users a safe, touch-first workflow that remains understandable under poor connectivity.

## 3. Product goals

1. Receive and validate a Core 1 service, rental, or sale handoff, then create
   the appropriate Core 2 operational record.
2. Prevent unavailable, unqualified, conflicted, or unsafe resources from being assigned (integrating real-time leave status from Workforce Management).
3. Require independent approval for priority and emergency dispatch decisions.
4. Give each role only the records and actions it is authorized to use.
5. Make operational state changes attributable and auditable.
6. Expose location freshness and synchronization state without hiding uncertainty.
7. Provide instant field emergency response through a reliable SOS distress system.
8. Track fuel consumption baselines and automatically detect burn rate anomalies.
9. Keep AI advisory: GPT recommendations must be explainable and human-confirmed.

## 4. Non-goals for the current release

- Building, replacing, or maintaining Core 1 or any of its Sales, CRM, Client,
  Job Order, Rental, or Project Management interfaces
- Building or maintaining an enterprise Core HR / HCM system, corporate payroll, or employee leave management (sourced upstream from Core HR and Workforce Management)
- Public customer registration or a customer-facing portal
- Autonomous dispatch or automatic application of GPT output
- Core 1 commercial quotation, contract, pricing, payment, billing, payroll,
  invoicing, procurement, tax, or enterprise-accounting workflows
- Direct browser access to Supabase tables
- Hard deletion of operational history through normal product workflows
- A native duplicate of the complete office/management workspace; the mandatory
  React Native scope is a focused field application for Operators
- iOS or tablet field applications; the active native release targets Android
  phones running Android 11 or later only

## 5. Primary System Users (3 Users)

### 1. System Administrator (`system_administrator`)

Governs the platform configuration, Core HR / Workforce Management sync pipeline, provisions internal user accounts and operational roles (`system_administrator`, `operations_manager`, `crane_operator` [Operator]) for newly onboarded personnel, manages account status and session termination upon HR offboarding, triggers break-glass emergency aborts or asset safety lockdowns, and reviews system audit activity. The last active System Administrator must not be suspended or demoted.

### 2. Operations Manager (`operations_manager`)

Central operational, safety governance, and dispatch authority for Alibaton. Reviews work received from Core 1, schedules dispatches and structured project plans, verifies multi-crane resource allocations, assigns qualified personnel and safe assets, activates routine work, independently decides exceptional approvals, oversees live operations, manages SOS incidents, approves/rejects fuel requests, reviews DVIR defects and links work orders, authorizes Critical Lift Plans, countersigns Toolbox Meetings (TBM), and oversees Work Stoppage Order (WSO) investigations and resolutions.

### 3. Operator (`operator` / `crane_operator`)

Field personnel operating heavy equipment and transport assets. Operates via the native field mobile app (Tactical Cockpit HUD with day/night modes, turn-by-turn in-cab navigation, monotonic job milestone progression, 4-angle walkaround DVIR pre/post-trip photo tagging, Hours of Service [HoS] duty status logging and fatigue tracking, DOLE TBM submission, safety hazard reporting, 1-tap floating SOS distress jewel, and fuel request logging). Operators see only their assigned work and cannot discover other workers' assignments.

Heavy equipment and crane journeys show approved access routes, site staging details, and turn-by-turn guidance. The app enforces an explicit Drive mode versus Crane setup/operation mode to ensure safe field execution.

*(Note: Workforce field personnel such as Riggers are non-software workforce crew tracked via [`PersonnelProfile`](../../apps/operations/app/Platform/Identity/Models/PersonnelProfile.php) and statutory credentials [e.g. TESDA Crane Rigging NC II] for crew eligibility and lift plan assignment, but do not possess software login accounts).*

## 6. Core product experience

The main flow is:

1. Receive a Core 1 service, rental, or sale handoff.
2. Validate it and create the matching Core 2 operational record.
3. Create a dispatch job and schedule window when field execution, delivery,
   or collection is required.
4. Assign personnel and assets.
5. Route exceptional work for independent approval.
6. Activate service or delivery dispatch when operational execution is needed.
7. Let assigned field staff progress the job or complete the equipment
   fulfillment action.
8. Track fuel, location, inspection, maintenance, rental, and ownership events.
9. Preserve final reports, attachments, notifications, and audit history linked
   to the Core 1 source reference.

The web and mandatory React Native field application are parallel capstone
workstreams. The richer role-adaptive web prototype is progressively connected
to live Laravel data on the existing Inertia route; it is not a second
production frontend. Both clients share Laravel authorization, domain actions,
canonical states, concurrency rules, and audit behavior.

See [userflow.md](./userflow.md) and [business_rules.md](./business_rules.md) for detailed flows and invariants.

## 7. Success criteria

- An Operations Manager can create, staff, equip, and activate a routine job.
- A priority or emergency job cannot activate without an approved request.
- Unsafe assets and unqualified or unavailable personnel cannot be assigned.
- Assigned-only roles cannot view or mutate other workers' records.
- Fuel requests cannot skip stages or be self-approved.
- Maintenance-blocking assets cannot return to service without a post-repair passing inspection.
- State-changing workflows create audit events with actor and request context.
- Server-provided role and capabilities, not client-selected roles, control access.

## 8. Product principles

- Put the next operational decision in view.
- Explain conflicts before confirmation.
- Show freshness, ownership, and consequences for state changes.
- Adapt navigation and density by capability.
- Use explicit human confirmation for GPT-assisted decisions.
- Meet WCAG 2.2 AA, including keyboard access, visible focus, reduced motion, color-independent status, 200% zoom, and 44px field targets.

## 9. Current implementation boundary

The Laravel backend currently implements authentication, RBAC, scoped queries,
transitional local client/service-request intake, atomic one-to-many request conversion, dispatch
assignment and activation, field status transitions, approval decisions, fuel
workflow stages, location updates, asset registration/status, inspections,
maintenance release safety, user administration, audit recording, reports,
private attachments, notifications, daily summaries, and asynchronous GPT
recommendations. The canonical live workspace exposes active-client selection,
intake, linked draft creation, resource assignment/conflict review, activation,
exceptional approval decision, assigned field progression with optimistic
conflict recovery, and a live tracking map/list with browser outbox behavior.

Some richer React surfaces still use prototype fixtures and local reducer
behavior. Durable native offline/device work, complete routed UI for
reports/attachments/notifications/GPT, export workflows, an archived-record
management surface, and production operational proof remain roadmap work.
Final fuel logging, including cost/meter details and receipt persistence, is
implemented and covered by the fuel workflow tests.

Phase 0 baselines are accepted in
[phase-0-baseline.md](../archive/phase-0-baseline.md). The current palette is
gold `#FFBF00` across web and mobile, as defined in
[Design.md](../design/Design.md); browser mutations use Inertia redirects, validation errors, and typed flash;
mobile uses a separate future `/api/v1` JSON boundary; production is a managed
single-region Laravel/Supabase topology; and the reliability, location,
offline, attachment, and GPT limits in that record are active requirements.

The approved GPT target is OpenAI `gpt-5-mini`; the application integration and
guarded lifecycle are implemented, while credentials, queue operations, and
production cost/retention proof still require product-owner configuration and
authorization.

The operational capability set follows the **5 Main Operational Business Modules** in
[modules.md](../architecture/modules.md): Dispatch Job and Scheduling (Real-Time Activation, including Project Planning), Assign Driver/Operator and Equipment (incorporating Hours of Service [HoS] compliance), Fleet Management (incorporating Driver Vehicle Inspection Reports [DVIR]), Crane and Equipment Management, and Fuel Management.
Core 1 is the upstream commercial source that feeds three business transaction flows into Core 2:
Service, Rental, and Sale transactions. Rental and sales operations are supported via backend
operational flow handlers in `apps/operations/app/Modules/Rental` and `apps/operations/app/Modules/Sales` to coordinate availability
and prevent resource collisions with the 5 main operational modules. Statutory safety governance
(DOLE OSHS Rule 1410 & DO 198-18) and SOS emergency response operate as cross-cutting platform foundations.
Building Core 1 commercial interfaces is not a Core 2 roadmap item. See [Core 1 involvement in
Core 2](../README.md) and [Alibaton Business Context and CT2 Scope](./alibaton-business-scope.md).

## 10. Related documents

- [requirements.md](./requirements.md)
- [features.md](./features.md)
- [database.md](../architecture/database.md)
- [API.md](../architecture/API.md)
- [Architecture.md](../architecture/Architecture.md)
- [Design.md](../design/Design.md)
- [Roadmap.md](../plans/Roadmap.md)
- [BSIT Capstone Requirements Questionnaire](../archive/consolidated/supplements/capstone-requirements-questionnaire.md)
