# Core Transaction 2 - Module and UI/UX Map

**Last updated:** 2026-07-31  
**Status:** Communication diagram for the accepted product boundary

This document visualizes the five business modules, their submodules, shared
platform services, role-based UI surfaces, and the main operational dependency
flow. It is a communication aid; [modules.md](../modules.md),
[features.md](../features.md), migrations, and application code remain
authoritative.

## Status legend

- **Live backend/UI** - server-backed behavior is exposed through the current
  routed workspace or a dedicated UI surface.
- **Partial** - the backend or a meaningful UI slice exists, but the complete
  experience is still being connected.
- **Prototype** - demonstrated by fixture/reducer UI and not evidence of live
  product behavior.
- **Planned** - accepted direction without a complete implementation.

## Business module boundary

```mermaid
flowchart LR
    subgraph CT2[Core Transaction 2 business boundary]
        D[Dispatch Job and Scheduling]
        A[Driver/Operator and Equipment Assignment]
        F[Fleet Management]
        C[Crane and Equipment Management]
        U[Fuel Management]

        D --> A
        F --> A
        C --> A
        A --> X[Activation readiness]
        D --> X
        X --> P[Field status progression]
        U -. references active job or asset .-> D
        U -. references assigned asset .-> F
        U -. independently authorized .-> P
    end

    S[Shared platform services]
    S --- D
    S --- A
    S --- F
    S --- C
    S --- U

    S1[Auth, RBAC, scoped visibility]
    S2[Audit, notifications, reports]
    S3[Tracking, attachments, GPT assistance]
    S --> S1
    S --> S2
    S --> S3
```

Dispatch creates the work context. Assignment staffs and equips it. Fleet and
Crane/Equipment Management determine whether resources are safe and available.
Fuel remains an independently authorized workflow even when it references a
dispatch or asset.

## Module and submodule map

```mermaid
flowchart TB
    D[1. Dispatch Job and Scheduling]
    D1[Client and service-request intake]
    D2[Job creation and scheduling]
    D3[Priority and emergency approval]
    D4[Dispatch activation]
    D5[Field status progression]
    D6[Cancellation, reopen, archive, reassignment]
    D7[Schedule board and live tracking]
    D --> D1
    D --> D2
    D --> D3
    D --> D4
    D --> D5
    D --> D6
    D --> D7

    A[2. Driver/Operator and Equipment Assignment]
    A1[Personnel eligibility and qualifications]
    A2[Personnel assignment and response]
    A3[Operational-asset eligibility]
    A4[Asset assignment and approval metadata]
    A5[Conflict review and reassignment]
    A --> A1
    A --> A2
    A --> A3
    A --> A4
    A --> A5

    F[3. Fleet Management]
    F1[Fleet-vehicle registry]
    F2[Vehicle status and readiness]
    F3[Vehicle inspections]
    F4[Maintenance and safe release]
    F5[Assignment and utilization history]
    F6[Vehicle location updates]
    F --> F1
    F --> F2
    F --> F3
    F --> F4
    F --> F5
    F --> F6

    C[4. Crane and Equipment Management]
    C1[Crane registry and capacity]
    C2[Equipment registry and specifications]
    C3[Certification and qualification]
    C4[Equipment status and readiness]
    C5[Inspections and maintenance]
    C6[Assignment and utilization history]
    C --> C1
    C --> C2
    C --> C3
    C --> C4
    C --> C5
    C --> C6

    U[5. Fuel Management]
    U1[Fuel-request submission]
    U2[Forwarding and review]
    U3[Approval and rejection]
    U4[Verification]
    U5[Final fuel logging]
    U6[Monitoring and reporting]
    U --> U1
    U --> U2
    U --> U3
    U --> U4
    U --> U5
    U --> U6
```

## Role-based UI/UX surfaces

```mermaid
flowchart LR
    subgraph Office[Office web workspace]
        W[Live role-filtered Inertia/React workspace]
        B[Dispatch board and decision workspace]
        R[Asset, fuel, approval, user, and audit surfaces]
        T[Tracking map and synchronized list]
        W --> B
        W --> R
        W --> T
    end

    subgraph Field[Field experience]
        M[Today's work]
        J[Job detail and next safe action]
        O[Offline, queued, syncing, and conflict states]
        M --> J --> O
    end

    SA[System Administrator] --> W
    DP[Dispatcher] --> W
    OM[Operations Manager] --> W
    DR[Driver] --> W
    CO[Crane Operator] --> W
    FT[Field Technician] --> W

    DR --> M
    CO --> M
    FT --> M

    W -. richer fixture-based prototype .-> P[operations.tsx role surfaces]
    M -. focused native implementation .-> RN[React Native field app]
```

The current production boundary is the routed web workspace and dispatch
detail page. The richer `operations.tsx` role surfaces are design/prototype
sources, while `packages/field-mobile` contains the partial native field
application. The native app is intentionally focused on field work and does
not reproduce the office administration workspace.

## Operational dependency flow

```mermaid
flowchart TD
    subgraph Intake["1. Service Request Intake & Schedule Board (Module 1)"]
        RQ["Client Service Request"] --> DRAFT["Create Draft Dispatch Job"]
        DRAFT --> SCHED["Set Schedule, Site & Requirements"]
        SCHED --> BOARD["Schedule Board & Conflict Review"]
    end

    subgraph Assignment["2. Resource Qualification & Assignment (Modules 2, 3, 4)"]
        BOARD --> CHECK_PERS["Check Personnel Availability & Qualifications (Module 2)"]
        BOARD --> CHECK_ASSETS["Check Unified Asset Register Readiness & Maintenance (Modules 3 & 4)"]
        
        CHECK_PERS --> LOCK_BATCH["Lock & Revalidate Resource Batch"]
        CHECK_ASSETS --> LOCK_BATCH
    end

    subgraph Approval["3. Priority / Emergency Gate (Module 1)"]
        LOCK_BATCH --> IS_EMERGENCY{"Priority or Emergency Job?"}
        IS_EMERGENCY -- "No (Routine)" --> ACTIVATION
        IS_EMERGENCY -- "Yes" --> PENDING["Pending Manager Approval"]
        PENDING --> MGR_DECISION{"Operations Manager Decision"}
        MGR_DECISION -- "Approved" --> ACTIVATION["Activate Dispatch"]
        MGR_DECISION -- "Rejected" --> REJECTED["Return for Revision / Reassignment"]
    end

    subgraph WorkerResponse["4. Worker Assignment Response (Module 2)"]
        ACTIVATION --> RESP{"Assigned Worker Response"}
        RESP -- "Accept" --> DISPATCHED["Status: Dispatched"]
        RESP -- "Reject (Reason Required)" --> REASSIGN["Close Interval & Flag for Reassignment"]
    end

    subgraph FieldExecution["5. Field Progression & Cancellation (Modules 1 & 2)"]
        DISPATCHED --> ACCEPTED["Status: Accepted"]
        ACCEPTED --> EN_ROUTE["Status: En Route"]
        EN_ROUTE --> ARRIVED["Status: Arrived"]
        ARRIVED --> WORKING["Status: Working"]
        WORKING --> COMPLETED["Status: Completed"]
        
        DISPATCHED -. "Authorized Override" .-> CANCEL["Cancel (Reason Required) / Reopen"]
        EN_ROUTE -. "Authorized Override" .-> CANCEL
        WORKING -. "Authorized Override" .-> CANCEL
    end

    subgraph FuelMgmt["6. Fuel Management Workflow (Module 5)"]
        WORKING -. "Initiates Request" .-> FUEL_SUB["Field User Submits Fuel Request"]
        FUEL_SUB --> FUEL_FWD["Dispatcher Forwards Request"]
        FUEL_FWD --> FUEL_DECISION{"Manager Decision"}
        FUEL_DECISION -- "Approve" --> FUEL_VERIFY["Technician Verifies"]
        FUEL_VERIFY --> FUEL_LOG["Log Fuel, Odometer, Cost & Receipt"]
        FUEL_DECISION -- "Reject" --> FUEL_REJ["Fuel Request Rejected"]
    end

    subgraph Maintenance["7. Unified Asset Maintenance & Safe Release (Modules 3 & 4)"]
        INSPECT["Asset Inspection"] --> COND{"Inspection Result"}
        COND -- "Pass" --> READY["Ready for Service"]
        COND -- "Fail / Defect" --> DEFECT["Declare Defect (Blocking / Non-Blocking)"]
        DEFECT --> MAINT["Move to Under Maintenance"]
        MAINT --> REPAIR["Record Repair & Parts"]
        REPAIR --> REINSPECT["Post-Repair Inspection"]
        REINSPECT -- "Pass" --> RELEASE["Safe Release to Ready for Service"]
    end

    subgraph SharedServices["Shared Platform Services"]
        AUTH["Auth, RBAC & Scoped Visibility"]
        AUDIT["Versioned Audit Trail & Notifications"]
        TRACK["Live OpenStreetMap Tracking & Outbox Replay"]
        GPT["GPT Dispatch Recommendation Engine"]
    end

    FieldExecution --> AUDIT
    FieldExecution --> TRACK
    FuelMgmt --> AUDIT
    Maintenance --> AUDIT
    GPT -. "Human Accept/Reject" .-> DRAFT
    SharedServices -. "Enforces System Invariants" .-> Intake
```

Every state-changing action remains subject to server-side authorization,
validation, optimistic-version checks where applicable, and audit recording.
The UI should explain the next decision, its consequence, and any stale,
blocked, offline, or conflicting state before the user confirms an action.

## Current implementation references

- Live web entry point: `resources/js/pages/workspace.tsx`
- Live dispatch detail: `resources/js/pages/dispatch-detail.tsx`
- Live workspace sections: `resources/js/components/workspace/`
- Prototype role surfaces: `resources/js/pages/operations.tsx` and
  `resources/js/components/surfaces/`
- Native field entry point: `packages/field-mobile/src/navigation/AppNavigator.tsx`
- Server-side role navigation and capabilities:
  `app/ViewModels/OperationsWorkspaceViewModel.php`
