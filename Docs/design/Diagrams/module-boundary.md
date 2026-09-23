# Core Transaction 2 - Module and Flow Architecture Map

> **Capstone Project Title:**  
> **DESIGN AND IMPLEMENTATION OF A GPT MINI POWERED DISPATCH AND RESOURCE MANAGEMENT PLATFORM WITH MOBILE APPLICATION FOR REAL TIME TRACKING FOR FIELD SERVICE MONITORING**

**Last updated:** 2026-09-05  
**Status:** Canonical architecture and boundary diagram

This document visualizes the **5 Main Operational Business Modules** (1. Dispatch Job and Scheduling [Real-Time Activation], 2. Assign Driver/Operator and Equipment, 3. Fleet Management, 4. Crane and Equipment Management, 5. Fuel Management), the **3 Tri-Modal Inbound Business Flows**, shared
platform services, role-based UI surfaces, and the operational dependency
flow for the **3 System Users** (`System Administrator`, `Operations Manager`, `Operator`). [modules.md](../../architecture/modules.md),
[features.md](../../product/features.md), migrations, and application code remain
authoritative.

## Status legend

- **Live backend/UI** - server-backed behavior is exposed through the current
  routed workspace or a dedicated UI surface.
- **Partial** - the backend or a meaningful UI slice exists, but the complete
  experience is still being connected.
- **Prototype** - demonstrated by fixture/reducer UI and not evidence of live
  product behavior.
- **Planned** - accepted direction without a complete implementation.

## System & Flow Architecture

```mermaid
flowchart TD
    subgraph C1[External Core 1: Commercial Boundary]
        C1_SVC["Service Demand / Contract"]
        C1_RNT["Rental Reservation / Agreement"]
        C1_SAL["Sales Order / Purchase Agreement"]
    end

    subgraph FLOWS[Tri-Modal Inbound Business Flows]
        F_SVC["1. Field Service Flow\n(Intake -> Planning -> Multi-Draft Dispatch -> Field Lifts)"]
        F_RNT["2. Equipment Rental Flow\n(Hire Window -> Inspection -> Checkout -> Return Diff)"]
        F_SAL["3. Equipment Sales Flow\n(Order -> Transport Fulfillment -> VIN/Serial Handover)"]
    end

    C1_SVC --> F_SVC
    C1_RNT --> F_RNT
    C1_SAL --> F_SAL

    subgraph CORE_MODULES[Core 2: 5 Main Operational Business Modules]
        D["1. Dispatch Job and Scheduling\n(Real-Time Activation & Planning)"]
        A["2. Assign Driver/Operator & Equipment\n(with HoS Duty Compliance)"]
        F["3. Fleet Management\n(with DVIR Inspections & GPS Tracking)"]
        C["4. Crane and Equipment Management\n(Load Charts & Safety Certifications)"]
        U["5. Fuel Management\n(Bowsers, Logs & Anomaly Detection)"]

        D --> A
        F --> A
        C --> A
        A --> X[Activation & Batch Row Lock]
        D --> X
        X --> P[Field Status Progression]
        U -. references active job or asset .-> D
        U -. references assigned asset .-> F
        U -. independently authorized .-> P
    end

    F_SVC ==> D
    F_RNT ==> D
    F_RNT ==> C
    F_SAL ==> F
    F_SAL ==> D

    subgraph SHARED[Shared Platform Services & Safety Foundations]
        S1[Auth, Spatie RBAC 3 System Users, Scoped Visibility]
        S2[Immutable Audit, Notifications, Job Reports]
        S3[MapLibre GL Live Tracking, Outbox Replay, GPT-5-mini]
        S4[Statutory Safety Governance: DOLE Rule 1410, TBM, Critical Lift Plans, WSO]
        S5[SOS Emergency Response System: Floating Jewel, Cradle Notch, Reverb Broadcast]
    end

    SHARED --- CORE_MODULES
```

Core 1 owns Sales, CRM, Client, Job Order, Rental, and Project Management and
is external to this repository. Core 2 receives three actionable business transaction flows:
**Service, Rental, and Sale**. These flows are scheduled, staffed, equipped, and executed by the
**5 main operational business modules** (Dispatch with Planning, Assignment, Fleet, Cranes, Fuel), with DVIR, HoS, and Safety acting as integrated capabilities.

Rental and Sales operations use backend flow handlers in `app/Modules/Rental` and `app/Modules/Sales`
to coordinate equipment reservation, inspection diffs, and prevent inventory collisions with active dispatch operations.

## Module and Submodule Map

```mermaid
flowchart TB
    subgraph MOD_1["1. Dispatch Job and Scheduling (Real-Time Activation)"]
        D1[Client service request intake and handoff conversion]
        D2[Project Planning: multi-day phases, milestones & dependency gates]
        D3[Draft job creation and schedule window definition]
        D4[Priority and emergency manager approval gate]
        D5[Readiness evaluation, batch row locking and activation]
        D6[Forward-only field status progression]
        D7[Reason-coded cancellation, reopen, and archival]
        D8[Day/Week/Month schedule calendar boards]
    end

    subgraph MOD_2["2. Assign Driver/Operator and Equipment"]
        A1[Personnel eligibility, licenses, credentials, and rest periods]
        A2[Offer dispatch, worker response, and reject reasons]
        A3[Operational asset readiness, maintenance status, and lockouts]
        A4[Multi-asset assignment linking and metadata]
        A5[Overlapping schedule conflict review and atomic reassignment]
        H1[HoS Duty status tracking: Off Duty, Sleeper Berth, Driving, On Duty]
        H2[11-Hour driving limit and 14-hour on-duty window enforcement]
        H3[Mandatory 30-minute rest break after 8 cumulative driving hours]
        H4[Real-time fatigue risk scoring and manager threshold alerts]
    end

    subgraph MOD_3["3. Fleet Management"]
        F1[Fleet-vehicle registry for trucks, lowbeds, and support units]
        F2[Vehicle operational status and readiness lifecycle]
        F3[Maintenance work orders, repairs, and safe-release verification]
        F4[Vehicle GPS coordinates, heading azimuth, speed, and freshness]
        V1[Pre-trip and post-trip digital inspection checklists]
        V2[360-degree walkaround defect capture with mobile photo tagging]
        V3[Safety-critical defect gating and automatic equipment grounding]
    end

    subgraph MOD_4["4. Crane and Equipment Management"]
        C1[Crane registry, tonnage capacity, boom length, and load charts]
        C2[Rigging gear, spreader bars, and auxiliary equipment registry]
        C3[Third-party safety certifications and operator qualification checks]
        C4[Equipment readiness and defect lockouts]
        C5[3-State inspection checklists and maintenance work orders]
        C6[Operating hours, lift counters, and deployment histories]
    end

    subgraph MOD_5["5. Fuel Management"]
        U1[Worker fuel-request submission with quantity and purpose]
        U2[Operations forwarding and queue review]
        U3[Operations Manager independent approval and rejection]
        U4[Field technician physical verification]
        U5[Final fuel logging with odometer, unit cost, total cost, and receipts]
        U6[Consumption monitoring, anomaly detection, and reporting]
    end
```

### Tri-Modal Inbound Flow Lifecycle Steps

```mermaid
flowchart LR
    subgraph SVC_STEPS["1. Field Service Flow"]
        S_IN["Service Request"] --> S_DSP["Dispatch Draft"] --> S_ASN["Resource Assign"] --> S_ACT["Activate & Progress"] --> S_RPT["Job Report"]
    end

    subgraph RNT_STEPS["2. Equipment Rental Flow"]
        R_RES["Reservation"] --> R_CHK["Pre-Checkout Inspection"] --> R_DEP["Active Rental Window"] --> R_DIF["Return Condition Diff"] --> R_REL["Safe Release"]
    end

    subgraph SAL_STEPS["3. Equipment Sales Flow"]
        O_ORD["Sales Order"] --> O_RES["Inventory Reservation"] --> O_FUL["Transport Fulfillment"] --> O_VIN["VIN/Serial Handover"] --> O_TRN["Ownership Transfer"]
    end
```

## Role-based UI/UX surfaces

```mermaid
flowchart LR
    subgraph Office[Office web workspace]
        W[Live role-filtered Inertia/React workspace]
        B[Dispatch board, project plans and decision workspace]
        R[Asset register, DVIR review, fuel, safety, user, and audit surfaces]
        T[Tracking map and synchronized list]
        E[SOS emergency response banner & dashboard]
        W --> B
        W --> R
        W --> T
        W --> E
    end

    subgraph Field[Field experience]
        M[Tactical Cockpit HUD - Day/Night]
        N[In-Cab Turn-by-Turn Navigation]
        D[DVIR 360 Walkaround Defect Capture]
        H[Hours of Service HoS Duty Status Logging]
        S[1-Tap Floating SOS Emergency Jewel]
        J[Job detail and next safe action]
        O[Offline SQLite queued, syncing, and conflict states]
        M --> N
        M --> D
        M --> H
        M --> S
        M --> J --> O
    end

    SA[System Administrator] --> W
    OM[Operations Manager] --> W
    CO[Operator] --> M

    RG[Rigger Workforce\nNon-Software User] -. verified qualifications & on-site co-signature .-> CO
    RG -. roster scheduling .-> OM

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
    subgraph Intake["1. Service Request Intake & Project Planning (Module 1)"]
        RQ["Client Service Request / Project Plan"] --> DRAFT["Create Draft Dispatch Job"]
        DRAFT --> SCHED["Set Schedule, Site & Requirements"]
        SCHED --> BOARD["Schedule Board & Multi-Crane Conflict Review"]
    end

    subgraph Assignment["2. Resource Qualification & Assignment (Modules 2, 3, 4)"]
        BOARD --> CHECK_PERS["Check Personnel Availability & Qualifications (Module 2)"]
        BOARD --> CHECK_ASSETS["Check Unified Asset Register Readiness & Maintenance (Modules 3 & 4)"]
        BOARD --> CHECK_HOS["Check Operator HoS Rest & Duty Status (Module 2)"]
        
        CHECK_PERS --> LOCK_BATCH["Lock & Revalidate Resource Batch"]
        CHECK_ASSETS --> LOCK_BATCH
        CHECK_HOS --> LOCK_BATCH
    end

    subgraph Approval["3. Priority / Emergency Gate (Module 1)"]
        LOCK_BATCH --> IS_EMERGENCY{"Priority or Emergency Job?"}
        IS_EMERGENCY -- "No (Routine)" --> ACTIVATION
        IS_EMERGENCY -- "Yes" --> PENDING["Pending Manager Approval"]
        PENDING --> MGR_DECISION{"Operations Manager Decision"}
        MGR_DECISION -- "Approved" --> ACTIVATION["Activate Dispatch"]
        MGR_DECISION -- "Rejected" --> REJECTED["Return for Revision / Reassignment"]
    end

    subgraph WorkerResponse["4. Operator Response (Module 2)"]
        ACTIVATION --> RESP{"Assigned Operator Response"}
        RESP -- "Accept" --> DISPATCHED["Status: Dispatched"]
        RESP -- "Reject (Reason Required)" --> REASSIGN["Close Interval & Flag for Reassignment"]
    end

    subgraph FieldExecution["5. Field Progression & Safety Checklists (Modules 1, 2, 3)"]
        DISPATCHED --> ACCEPTED["Status: Accepted"]
        ACCEPTED --> DVIR_PRE["Pre-Trip DVIR & 360 Walkaround (Module 3)"]
        DVIR_PRE --> EN_ROUTE["Status: En Route (Heavy-Vehicle Navigation)"]
        EN_ROUTE --> ARRIVED["Status: Arrived & Parked"]
        ARRIVED --> TBM["Toolbox Meeting & Crane Setup"]
        TBM --> WORKING["Status: Working (HoS Driving/On-Duty Tracked)"]
        WORKING --> DVIR_POST["Post-Trip DVIR Inspection (Module 3)"]
        DVIR_POST --> COMPLETED["Status: Completed"]
        
        DISPATCHED -. "Authorized Override" .-> CANCEL["Cancel (Reason Required) / Reopen"]
        EN_ROUTE -. "Authorized Override" .-> CANCEL
        WORKING -. "Authorized Override" .-> CANCEL
    end

    subgraph FuelMgmt["6. Fuel Management Workflow (Module 5)"]
        WORKING -. "Initiates Request" .-> FUEL_SUB["Field User Submits Fuel Request"]
        FUEL_SUB --> FUEL_FWD["Operations Staff Forwards Request"]
        FUEL_FWD --> FUEL_DECISION{"Manager Decision"}
        FUEL_DECISION -- "Approve" --> FUEL_VERIFY["Technician / Manager Verifies"]
        FUEL_VERIFY --> FUEL_LOG["Log Fuel, Odometer, Cost & Receipt"]
        FUEL_DECISION -- "Reject" --> FUEL_REJ["Fuel Request Rejected"]
    end

    subgraph Maintenance["7. Unified Asset Maintenance & Safe Release (Modules 3 & 4)"]
        INSPECT["Asset / DVIR Inspection"] --> COND{"Inspection Result"}
        COND -- "Pass" --> READY["Ready for Service"]
        COND -- "Fail / Critical Defect" --> DEFECT["Declare Defect & Ground Equipment"]
        DEFECT --> MAINT["Move to Under Maintenance"]
        MAINT --> REPAIR["Record Repair & Parts"]
        REPAIR --> REINSPECT["Post-Repair Inspection"]
        REINSPECT -- "Pass" --> RELEASE["Safe Release to Ready for Service"]
    end

    subgraph SharedServices["Shared Platform Services & Safety Governance"]
        AUTH["Auth, Spatie RBAC 3 System Users & Scoped Visibility"]
        AUDIT["Versioned Audit Trail & Notifications"]
        TRACK["Live MapLibre Tracking & Outbox Replay"]
        GPT["GPT Dispatch Recommendation Engine"]
        SAFETY["Statutory Safety: DOLE Rule 1410, TBM, Critical Lift Plans, WSO"]
        SOS["SOS Emergency Response: Floating Jewel, Reverb Broadcast, Escalation"]
    end

    FieldExecution --> AUDIT
    FieldExecution --> TRACK
    FieldExecution --> SAFETY
    FieldExecution --> SOS
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
