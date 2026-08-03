# Core Transaction 2 — Product Requirements Document

**Document status:** Living product definition  
**Last updated:** 2026-07-31  
**Product stage:** Working vertical slices with remaining prototype-only surfaces

## 1. Product summary

Core Transaction 2 (CT2) is an internal operations platform that turns service requests into scheduled, staffed, equipped, tracked, and auditable field work. It brings dispatch, assignments, fleet and equipment readiness, fuel, location sharing, maintenance, approvals, and administration into one role-aware workspace.

The product supports six operational roles:

- System Administrator
- Dispatcher
- Operations Manager
- Driver
- Crane Operator
- Field Technician

The accepted product boundary has five top-level business modules: Dispatch Job
and Scheduling; Driver/Operator and Equipment Assignment; Fleet Management;
Crane and Equipment Management; and Fuel Management. Identity, tracking,
audit, records, notifications, reports, attachments, and GPT assistance are
shared platform services.

## 2. Problem

Dispatch decisions are difficult when job requirements, qualified personnel, asset readiness, approvals, fuel activity, and field progress live in separate channels. Based on empirical findings from operational personnel ([BSIT Capstone Requirements Questionnaire](./consolidated/supplements/capstone-requirements-questionnaire.md)), current manual scheduling via OneDrive/Excel activity calendars leads to **frequent double bookings**, personnel qualification bottlenecks via physical HR/201 files, unmonitored equipment breakdowns (hydraulic/electrical leaks and wear), untracked heavy assets, excessive fuel consumption, and significant idle ("waiting") time.

CT2 must give office users a fast, information-dense decision surface and field users a safe, touch-first workflow that remains understandable under poor connectivity.

## 3. Product goals

1. Convert a client service request into a complete dispatch job.
2. Prevent unavailable, unqualified, conflicted, or unsafe resources from being assigned.
3. Require independent approval for priority and emergency dispatch decisions.
4. Give each role only the records and actions it is authorized to use.
5. Make operational state changes attributable and auditable.
6. Expose location freshness and synchronization state without hiding uncertainty.
7. Keep AI advisory: GPT recommendations must be explainable and human-confirmed.

## 4. Non-goals for the current release

- Public customer registration or a customer-facing portal
- Autonomous dispatch or automatic application of GPT output
- Payroll, invoicing, procurement, or full enterprise asset accounting
- Direct browser access to Supabase tables
- Hard deletion of operational history through normal product workflows
- A native duplicate of the complete office/management workspace; the mandatory
  React Native scope is a focused field application for Driver, Crane Operator,
  and Field Technician
- iOS or tablet field applications; the active native release targets Android
  phones running Android 11 or later only

## 5. Primary users and needs

### System Administrator

Provisions internal users, assigns one canonical operational role, manages account status, and reviews audit activity. The last active System Administrator must not be suspended or demoted.

### Dispatcher

Creates clients and jobs, schedules work, assigns qualified personnel and safe assets, activates routine work, monitors the board, and forwards fuel requests.

### Operations Manager

Independently decides exceptional approvals, oversees live operations and resource conflicts, and approves or rejects fuel requests.

### Driver and Crane Operator

See assigned work, accept and advance their own job status, share location when enabled, and submit fuel requests. They must not discover another worker's assignments.

### Field Technician

Inspects assets, opens maintenance work, verifies fuel stages, and releases equipment only after the required safety evidence exists.

## 6. Core product experience

The main flow is:

1. Record a client and service request.
2. Create a dispatch job and schedule window.
3. Assign personnel and assets.
4. Route exceptional work for independent approval.
5. Activate the dispatch.
6. Let assigned field staff progress the job.
7. Track fuel, location, inspection, and maintenance events.
8. Preserve final reports, attachments, notifications, and audit history.

The web and mandatory React Native field application are parallel capstone
workstreams. The richer role-adaptive web prototype is progressively connected
to live Laravel data on the existing Inertia route; it is not a second
production frontend. Both clients share Laravel authorization, domain actions,
canonical states, concurrency rules, and audit behavior.

See [userflow.md](./userflow.md) and [business_rules.md](./business_rules.md) for detailed flows and invariants.

## 7. Success criteria

- A Dispatcher can create, staff, equip, and activate a routine job.
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
client/service-request intake, atomic one-to-many request conversion, dispatch
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
[phase-0-baseline.md](./phase-0-baseline.md): amber is the brand primary;
browser mutations use Inertia redirects, validation errors, and typed flash;
mobile uses a separate future `/api/v1` JSON boundary; production is a managed
single-region Laravel/Supabase topology; and the reliability, location,
offline, attachment, and GPT limits in that record are active requirements.

The approved GPT target is OpenAI `gpt-5-mini`; the application integration and
guarded lifecycle are implemented, while credentials, queue operations, and
production cost/retention proof still require product-owner configuration and
authorization.

The current capability set follows the five-module boundary in
[modules.md](./modules.md); shared Laravel services remain cross-cutting
support rather than additional business modules.

## 10. Related documents

- [requirements.md](./requirements.md)
- [features.md](./features.md)
- [database.md](./database.md)
- [API.md](./API.md)
- [Architecture.md](./Architecture.md)
- [Design.md](./Design.md)
- [Roadmap.md](./Roadmap.md)
- [BSIT Capstone Requirements Questionnaire](./consolidated/supplements/capstone-requirements-questionnaire.md)
