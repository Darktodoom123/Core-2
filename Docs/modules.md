# Core Transaction 2 — Top-Level Modules

**Last updated:** 2026-08-01  
**Status:** Accepted product module boundary

Core Transaction 2 is a modular Laravel monolith organized around five
business modules. This document defines the product-level boundaries and the
implemented Laravel code now follows them under `app/Modules`, with shared
platform capabilities under `app/Platform` and the temporary shared asset
kernel under `app/Shared/Assets`.

For the visual module, dependency, and role-surface map, see
[Module and UI/UX map](./Diagrams/module-boundary.md). The diagram is a
communication aid; this document and the implementation status in
[features.md](./features.md) remain authoritative.

## Module overview

| Module | Purpose | Current status |
| --- | --- | --- |
| [Dispatch Job and Scheduling](#1-dispatch-job-and-scheduling) | Turn client demand into scheduled, approved, activated work | Live backend/UI, with some workflow gaps |
| [Driver/Operator and Equipment Assignment](#2-driveroperator-and-equipment-assignment) | Staff and equip a job using server-side eligibility and conflict checks | Live backend/UI |
| [Fleet Management](#3-fleet-management) | Manage fleet vehicles as operational assets | Live backend/UI, with richer management screens still evolving |
| [Crane and Equipment Management](#4-crane-and-equipment-management) | Manage cranes and non-fleet equipment as operational assets | Live backend/UI, with richer management screens still evolving |
| [Fuel Management](#5-fuel-management) | Request, review, approve, verify, and log fuel usage | Live backend/UI |

## 1. Dispatch Job and Scheduling

### Responsibilities

- Register active clients and capture service requests.
- Create dispatch jobs directly or convert one service request into multiple
  uniquely referenced drafts.
- Store the schedule window, work location, priority, requirements, and
  operational snapshot.
- Route priority and emergency work through an independent approval request.
- Activate only jobs that satisfy assignment, approval, asset-safety, and
  optimistic-version checks.
- Progress an active job through the canonical field sequence:
  `dispatched` → `accepted` → `en_route` → `arrived` → `working` → `completed`.

### Submodules

- Client and service-request intake
- Dispatch-job creation and scheduling
- Priority and emergency approval
- Dispatch activation
- Field status progression
- Cancellation and reopen/archive (live backend/UI, with restore management UI remaining); reassignment and assignment response (live)
- Schedule board (prototype); routed live tracking map/list (partial)

### Current code surfaces

- Controllers: `ClientController`, `ServiceRequestController`,
  `DispatchJobController`, `DispatchWorkflowController`, and
  `ApprovalRequestController`
- Actions: `ConvertServiceRequestToDispatch`, `ActivateDispatchJob`,
  `TransitionDispatchJob`, `DecideApprovalRequest`,
  `ReassignDispatchResources`, and the dispatch lifecycle actions
- Models: `Client`, `ServiceRequest`, `DispatchJob`, and `ApprovalRequest`
- Routes: `/operations/clients`, `/operations/service-requests`,
  `/operations/dispatch-jobs`, `/operations/approval-requests`, and the
  dispatch assignment/reassignment workflow routes

## 2. Driver/Operator and Equipment Assignment

### Responsibilities

- Assign qualified drivers, crane operators, and other personnel to a job.
- Assign vehicles, cranes, and equipment to a job.
- Validate role, account status, availability, credentials, duplicate
  assignments, schedule overlap, asset readiness, and blocking maintenance.
- Keep assignment decisions server-authoritative and auditable.

### Submodules

- Personnel eligibility and qualification checks
- Personnel assignment and response state
- Operational-asset eligibility checks
- Asset assignment and approval metadata
- Conflict review and reassignment (live backend/UI)

### Current code surfaces

- Controller: `DispatchWorkflowController`
- Actions: `AssignDispatchResources` and `ReassignDispatchResources`
- Service: `DispatchResourceEligibility`
- Models: `DispatchPersonnelAssignment` and `DispatchAssetAssignment`
- View models: `DispatchAssignmentWorkspaceViewModel`
- Routes: `/operations/dispatch-jobs/{dispatchJob}/assignments` and
  `/operations/dispatch-jobs/{dispatchJob}/reassign`

This module owns the assignment workflow. Fleet Management and Crane and
Equipment Management own the master data, status, inspection, and maintenance
state of the assets being assigned.

## 3. Fleet Management

### Responsibilities

- Register and maintain trucks and other fleet vehicles.
- Track asset identity, registration, specifications, capacity, meter, and
  location data.
- Control operational status and readiness for dispatch.
- Record inspections and maintenance that affect dispatch eligibility.

### Submodules

- Fleet-vehicle registry
- Vehicle status and readiness
- Vehicle inspections
- Vehicle maintenance and safe release
- Vehicle assignment and utilization history
- Vehicle location updates

### Current code surfaces

- Controllers: `OperationalAssetController`, `InspectionController`, and
  `MaintenanceWorkOrderController`
- Models: `OperationalAsset`, `Inspection`, and `MaintenanceWorkOrder`
- Routes: `/operations/assets`, `/operations/assets/{operationalAsset}/status`,
  `/operations/assets/{operationalAsset}/inspections`, and maintenance routes

Fleet and Crane/Equipment Management currently share the `operational_assets`
table and model. The product modules remain separate because their asset
policies, capabilities, and operational workflows can diverge.

## 4. Crane and Equipment Management

### Responsibilities

- Register cranes and non-fleet equipment.
- Store type, subtype, manufacturer, model, specifications, and capacity.
- Enforce certification, inspection, readiness, and maintenance requirements.
- Make safe, available equipment assignable to dispatch jobs.

### Submodules

- Crane registry and capacity
- Equipment registry and technical specifications
- Certification and qualification requirements
- Equipment status and readiness
- Inspections and maintenance
- Assignment and utilization history

### Current code surfaces

Crane and equipment records use the same asset implementation as Fleet
Management. Their type and subtype identify the operational category in
`OperationalAsset`; the shared asset controllers, model, policies, inspection
workflow, and maintenance workflow provide the current backend boundary.

## 5. Fuel Management

### Responsibilities

- Accept fuel requests from authorized field users.
- Link a request optionally to a dispatch job or operational asset.
- Move requests through the ordered workflow:
  `submitted` → `forwarded` → `approved`/`rejected` → `verified`.
- Prevent self-approval and enforce separate permissions for each decision.
- Preserve quantities, fuel type, purpose, meter readings, station, cost, and
  verification evidence where available.

### Submodules

- Fuel-request submission
- Forwarding and review
- Approval and rejection
- Verification
- Final fuel logging with cost, meter, station, and receipt evidence
- Fuel monitoring and reporting (planned)

### Current code surfaces

- Controller: `FuelRequestController`
- Action: `TransitionFuelRequest`
- Models: `FuelRequest` and `FuelLog`
- Routes: `/operations/fuel-requests` and
  `/operations/fuel-requests/{fuelRequest}/status`

## Shared platform services

The following capabilities support all five modules and are not counted as
additional top-level business modules:

- Authentication, email verification, password recovery, and account status
- Users, roles, permissions, personnel profiles, and credentials
- Policies, scoped visibility, validation, transactions, and optimistic
  concurrency
- Audit-event recording
- Inertia/React workspace delivery
- Notifications, reports, attachments, and GPT assistance (server-backed
  slices); exports and archived-record management remain partial

## UI/UX surface ownership

The five business modules are presented through capability-filtered surfaces,
not one separate frontend per module:

- Office users use the live Inertia/React workspace for dispatch, assignments,
  assets, fuel, approvals, tracking, users, and audit activity.
- Drivers, crane operators, and field technicians use assigned-work views with
  a single next safe action, location sharing, and visible synchronization
  state. The focused React Native field application is a partial parallel
  surface.
- `resources/js/pages/operations.tsx` and its role surfaces are fixture-based
  prototype references for the richer target experience; they are not evidence
  that every prototype interaction is live.
- Reports, attachments, notifications, GPT recommendation history, and
  archive/restore are shared service surfaces. Their backend capabilities are
  ahead of their complete routed UI coverage.

The UI must preserve the module dependencies and server authority: it may hide
unauthorized actions and explain readiness or conflicts, but it must not replace
Laravel authorization, validation, locking, state transitions, or audit rules.

## Module dependency rules

1. Dispatch creates the work context.
2. Assignment staffs and equips that work context.
3. Fleet and Crane/Equipment Management determine whether assets are safe and
   available to assign.
4. Fuel Management may reference the active dispatch job or assigned asset,
   but its state transitions remain independently authorized.
5. Every module uses the shared authorization, validation, transaction, and
   audit services; the client interface never replaces server-side rules.

## Related documentation

- [Feature catalog](./features.md) — implementation status by capability
- [Architecture](./Architecture.md) — current modular-monolith layers and
  request flow
- [Database](./database.md) — entities, relationships, and persistence rules
- [HTTP API](./API.md) — current session-authenticated routes and contracts
