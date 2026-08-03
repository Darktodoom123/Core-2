# Core Transaction 2 — Data Flow Diagram (DFD)

**Last updated:** 2026-07-31  
**Status:** Visual DFD reference for system data flow, processes, data stores, and external entities

This document provides Level 0 (Context Diagram), Level 1 (Modular System DFD), and Level 2 (Detailed Workflow DFDs) data flow diagrams for **Core Transaction 2**. It visualizes how external entities interact with system processes, transformed data flows, and relational data stores.

For authoritative system definitions, consult [Architecture.md](../Architecture.md), [modules.md](../modules.md), [business_rules.md](../business_rules.md), and [database.md](../database.md).

---

## 1. Level 0 DFD — Context Diagram

The Context Diagram defines the system boundary for Core Transaction 2, showing key external actors, system inputs, and system outputs.

```mermaid
flowchart TD
    %% External Entities
    CLIENT["🏢 Client / Customer"]
    OFFICE["👨‍💼 Office Staff / Dispatcher"]
    APPROVER["👨‍⚖️ Manager / Approver"]
    FIELD["🚚 Field Driver / Operator"]
    GPT["🤖 GPT Assistance Service"]
    STORAGE["📁 Object Storage S3"]

    %% Central System Boundary
    CT2(("Core Transaction 2 System"))

    %% Data Flows to/from Client
    CLIENT -->|"Service Request / Job Intake"| CT2
    CT2 -->|"Job Status Updates & Reports"| CLIENT

    %% Data Flows to/from Office Staff
    OFFICE -->|"Draft Job, Schedule & Priority"| CT2
    OFFICE -->|"Resource Assignments"| CT2
    CT2 -->|"Schedule Board & Live Tracking"| OFFICE

    %% Data Flows to/from Approver
    OFFICE -->|"Priority & Emergency Requests"| APPROVER
    APPROVER -->|"Approval / Rejection Decision"| CT2
    CT2 -->|"Pending Approval Notifications"| APPROVER

    %% Data Flows to/from Field User
    CT2 -->|"Dispatch Order & Assignment Push"| FIELD
    FIELD -->|"Accept / Reject Response"| CT2
    FIELD -->|"Field Status Progression (En Route, Arrived, Working, Completed)"| CT2
    FIELD -->|"GPS Location Outbox Pings"| CT2
    FIELD -->|"Fuel Request & Dispense Log"| CT2

    %% Data Flows to/from External Services
    CT2 -->|"Dispatch Context Data"| GPT
    GPT -->|"Advisory Recommendation (Read-only)"| CT2
    CT2 -->|"File Upload (Inspection/Receipt Attachments)"| STORAGE
    STORAGE -->|"Signed File URLs"| CT2
```

---

## 2. Level 1 DFD — Decomposed Modular Data Flow

Level 1 decomposes the system into the 5 Core Business Modules and Shared Platform Services, detailing interactions with canonical data stores.

```mermaid
flowchart TB
    %% External Entities
    E_CLIENT["Client"]
    E_OFFICE["Office Dispatcher"]
    E_APPROVER["Manager / Approver"]
    E_FIELD["Field Driver / Operator"]

    %% Data Stores
    D1[("D1: Clients & Service Requests")]
    D2[("D2: Dispatch Jobs & Approval Requests")]
    D3[("D3: Users, Roles & Qualifications")]
    D4[("D4: Personnel & Asset Assignments")]
    D5[("D5: Operational Assets (Fleet & Cranes)")]
    D6[("D6: Inspections & Maintenance")]
    D7[("D7: Fuel Logs & Authorizations")]
    D8[("D8: Location History & Outbox")]
    D9[("D9: Audit Trail & Notifications")]

    %% Processes
    P1(("1.0 Service Intake & Dispatch Scheduling"))
    P2(("2.0 Personnel & Asset Assignment"))
    P3_P4(("3.0 & 4.0 Asset Management (Fleet & Cranes)"))
    P5(("5.0 Fuel Request & Authorization"))
    P6(("6.0 Field Execution & Tracking"))
    P7(("7.0 Auth, RBAC & Audit Engine"))

    %% Data Flow Connections: Process 1.0
    E_CLIENT -->|"Service Request"| P1
    E_OFFICE -->|"Draft Job & Schedule"| P1
    P1 -->|"Write Client & Request"| D1
    P1 -->|"Write Job & Draft State"| D2
    E_APPROVER -->|"Approve / Deny Emergency Request"| P1
    P1 -->|"Log Approval Decision"| D2
    P1 -->|"Emit Audit Log"| D9

    %% Data Flow Connections: Process 2.0
    P1 -->|"Trigger Assignment Check"| P2
    P2 -->|"Check Personnel Eligibility"| D3
    P2 -->|"Check Asset Readiness"| D5
    P2 -->|"Verify No Schedule Overlap"| D4
    P2 -->|"Persist Assignments"| D4
    E_OFFICE -->|"Resource Assignment Input"| P2

    %% Data Flow Connections: Process 3.0 & 4.0
    E_OFFICE -->|"Register / Update Assets"| P3_P4
    P3_P4 -->|"Update Fleet & Crane Data"| D5
    E_FIELD -->|"Submit Inspection Form"| P3_P4
    P3_P4 -->|"Record Inspection & Maintenance"| D6
    P3_P4 -->|"Update Asset Status (Available/Maintenance)"| D5

    %% Data Flow Connections: Process 5.0
    E_FIELD -->|"Fuel Request"| P5
    P5 -->|"Validate Active Job / Assigned Asset"| D2
    P5 -->|"Validate Asset Assignment"| D4
    E_APPROVER -->|"Fuel Approval Decision"| P5
    P5 -->|"Record Fuel Log & Receipts"| D7

    %% Data Flow Connections: Process 6.0
    P2 -->|"Dispatch Push"| P6
    P6 -->|"Send Assignment Notification"| E_FIELD
    E_FIELD -->|"Response (Accept/Reject)"| P6
    P6 -->|"Update Response State"| D4
    E_FIELD -->|"Status Transition (Dispatched -> Completed)"| P6
    P6 -->|"Update Job Field Status"| D2
    E_FIELD -->|"GPS Location Pings"| P6
    P6 -->|"Store Location History"| D8

    %% Data Flow Connections: Process 7.0 (Platform)
    P7 -->|"Authorize User Action"| D3
    P7 -->|"Write Audit Trail"| D9
    D2 -.->|"Read Active Jobs"| P7
    P7 -.->|"Live Map / Tracking Feed"| E_OFFICE
```

---

## 3. Level 2 DFD — Detailed Core Workflows

### 3.1 Dispatch Lifecycle & Field Activation Flow

```mermaid
flowchart TD
    %% Actors
    DISPATCHER["Dispatcher"]
    APPROVER["Approver"]
    DRIVER["Field Driver / Operator"]

    %% Data Stores
    D_JOBS[("D2: Dispatch Jobs & Approvals")]
    D_ASSIGN[("D4: Personnel & Asset Assignments")]
    D_ASSET[("D5: Operational Assets")]
    D_AUDIT[("D9: Audit Trail")]

    %% Processes
    P1_1(("1.1 Draft Intake & Job Scheduling"))
    P1_2(("1.2 Resource Eligibility Check"))
    P1_3(("1.3 Priority / Emergency Approval"))
    P1_4(("1.4 Activation Readiness Verification"))
    P1_5(("1.5 Field Status Progression"))

    %% Step 1: Draft Intake
    DISPATCHER -->|"1. Input Job Specs"| P1_1
    P1_1 -->|"Write Status: Draft"| D_JOBS

    %% Step 2: Resource Assignment
    P1_1 -->|"Trigger Eligibility"| P1_2
    P1_2 -->|"Validate Qualifications & Schedules"| D_ASSIGN
    P1_2 -->|"Validate Asset Status (Safe/Released)"| D_ASSET
    P1_2 -->|"Persist Assignments"| D_ASSIGN

    %% Step 3: Approval Request (if high priority / emergency)
    P1_1 -->|"Emergency Job Flagged"| P1_3
    APPROVER -->|"Approve Emergency Job"| P1_3
    P1_3 -->|"Record Approval Record"| D_JOBS

    %% Step 4: Activation
    P1_2 & P1_3 -->|"Requirements Satisfied"| P1_4
    P1_4 -->|"Check Optimistic Version & Asset Safety"| D_ASSET
    P1_4 -->|"Update Status: Dispatched / Active"| D_JOBS
    P1_4 -->|"Log Activation Audit"| D_AUDIT

    %% Step 5: Field Progression
    P1_4 -->|"Push Job to Driver App"| DRIVER
    DRIVER -->|"Update Field Progression State"| P1_5
    P1_5 -->|"Persist Field Transition (Dispatched -> Accepted -> En Route -> Arrived -> Working -> Completed)"| D_JOBS
    P1_5 -->|"Log Progression Event"| D_AUDIT
```

### 3.2 Fuel Request, Authorization & Dispense Flow

```mermaid
flowchart TD
    DRIVER["Field Driver / Operator"]
    APPROVER["Manager / Fuel Approver"]

    D_FUEL[("D7: Fuel Logs & Authorizations")]
    D_JOBS[("D2: Dispatch Jobs")]
    D_ASSETS[("D5: Operational Assets")]
    D_AUDIT[("D9: Audit Trail")]

    P5_1(("5.1 Fuel Request Creation"))
    P5_2(("5.2 Autonomous & Manual Validation"))
    P5_3(("5.3 Approval Decision & Station Code"))
    P5_4(("5.4 Dispense & Receipt Verification"))

    DRIVER -->|"1. Submit Fuel Request (Amount, Asset ID, Job ID)"| P5_1
    P5_1 -->|"Verify Active Job Assignment"| D_JOBS
    P5_1 -->|"Verify Vehicle Status"| D_ASSETS
    P5_1 -->|"Save Pending Request"| D_FUEL

    P5_1 -->|"Notify Approver"| P5_2
    APPROVER -->|"2. Review Fuel Request"| P5_3
    P5_3 -->|"Approve Request & Generate Auth Code"| D_FUEL
    P5_3 -->|"Audit Log Approval"| D_AUDIT

    DRIVER -->|"3. Input Dispense Log, Odometer & Upload Receipt"| P5_4
    P5_4 -->|"Reconcile Dispensed vs Approved Fuel"| D_FUEL
    P5_4 -->|"Update Asset Meter / Odometer"| D_ASSETS
    P5_4 -->|"Log Completed Fuel Transaction"| D_AUDIT
```

---

## 4. DFD Element Legend & Conventions

| DFD Element | Symbol / Notation | Description in Core Transaction 2 |
| --- | --- | --- |
| **External Entity** | `[Rectangle]` | Users (Client, Dispatcher, Driver, Approver) or External Systems (S3 Storage, GPT AI Service) |
| **Process** | `((Circle / Bubble))` | Domain logic action executed by server (e.g. `ActivateDispatchJob`, `AssignDispatchResources`) |
| **Data Store** | `[(Database / Cylinder)]` | PostgreSQL relational tables (e.g. `dispatch_jobs`, `operational_assets`, `fuel_requests`) |
| **Data Flow** | `-->|Data Label|` | Typed parameters, JSON payloads, or domain events passing between components |

---

## 5. Architectural Data Flow Rules & Constraints

1. **Server Authority**: All data flow transitions are validated by Laravel Policies, Form Requests, and domain Actions. Frontend components do not directly write to Data Stores.
2. **Immutable Audit Trails**: Every state change in Process `1.0` through `6.0` automatically triggers an append-only write to `D9: Audit Trail`.
3. **Asynchronous Location Outbox**: Location updates from `E_FIELD` are collected in an offline browser/mobile outbox and flushed asynchronously via idempotent pings to `D8`.
4. **Advisory GPT Integration**: GPT assistance reads dispatch context from `D2`/`D5` but produces advisory recommendations only. Human intervention is required to convert recommendations into domain actions.
