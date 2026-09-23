# Core Transaction 2 — Feature Catalog

> **Capstone Project Title:**  
> **DESIGN AND IMPLEMENTATION OF A GPT MINI POWERED DISPATCH AND RESOURCE MANAGEMENT PLATFORM WITH MOBILE APPLICATION FOR REAL TIME TRACKING FOR FIELD SERVICE MONITORING**

## Overview
Core Transaction 2 delivers the complete operational backbone for heavy equipment dispatching, crane operations, crew scheduling, safety compliance, real-time tracking, and native field mobile execution, organized around **5 Main Operational Business Modules** and **3 System Users** (`System Administrator`, `Operations Manager`, `Operator`).

---

## 1. Dispatch Job and Scheduling (Real-Time Activation)
- **Direct Manual Operational Intake**:
  - Direct draft dispatch creation with explicit `[Manual • manual_intake]` provenance.
  - Site instructions, priority tagging (`routine`, `priority`, `emergency`), ground bearing assessment, outrigger pad clearance, power line clearance, and municipal permit checklists.
  - Operates independently without requiring upstream Core 1 commercial quotation or sales order creation.
- **Service Request Intake & Multi-Draft Conversion**:
  - Service demand handoff with customer, location, and requirement capture.
  - Multi-dispatch conversion enabling a single service demand to be staged into multiple specialized dispatch drafts (e.g. site prep, crane delivery, operation, demobilization).
- **Rental Reservation Delivery Handoffs**:
  - Direct intake of rental reservation dispatches with reservation window tracking, equipment condition checklists, and operator assignment context.
- **Sales Order Delivery Handoffs**:
  - Logistics fulfillment intake with order value, delivery vs pickup mode, and precise geo-coordinates.
- **Unlinked Handoff Queue & Intelligent Draft Reconciliation**:
  - Staging queue for unlinked Core 1 commercial transactions with automated matching against existing manual drafts to avoid duplicate executions.
- **Unified Multi-Source Dispatch Board**:
  - Filterable by source (`all`, `service_request`, `rental_reservation`, `sales_order`, `manual`), status, priority, and date.
  - Shared Day, Week, and Month multi-scale schedule calendar boards with conflict detection.
- **Long-Term Project Plans in Dispatch**:
  - Expandable multi-phase timelines with equipment reservations, maintenance windows, and linked weekly shift dispatches.
  - Role coverage planning, independent baseline approval, and approval of crew exceptions within the 24-hour lock.
  - Reviewed allocation changes and preserved project context when opening dispatch detail.
- **Canonical Dispatch Lifecycle Progression**:
  - Forward-only state progression: `draft` -> `pending_approval` -> `scheduled` -> `dispatched` -> `accepted` -> `en_route` -> `arrived` -> `working` -> `completed` / `cancelled`.
  - Reassignment, cancellation with reason codes, and reopening workflows.
- **Geospatial Site Coordinates & Planned Crane Slots**:
  - Site GPS coordinate pinning on dispatch jobs (`site_latitude`, `site_longitude`) and asset assignments.
  - Planned crane pad slot allocations (`planned_crane_slots`) for complex multi-crane setups.

---

## 2. Assign Driver/Operator and Equipment
- **Personnel & Asset Assignment**:
  - Multi-resource assignment (Lead Operator, Riggers, Technicians, Cranes, Transport Trucks, Support Equipment). Riggers are assigned as qualified employees (TESDA Rigging / DOLE-BOSH certified) without requiring mobile or web login accounts; field progression and lift execution are digitally logged by the operator or foreman.
  - Server-side qualification, license certification, rest-period, and equipment readiness checks.
  - Real-time double-booking conflict mitigation across overlapping time windows via the Shared availability coordinator.
- **Multi-Tier Approval Gates & Exception Overrides**:
  - Independent Operations Manager authorization required for emergency priority activations or unassigned required roles.
  - Human review decisions (Approve/Reject) with structured notes and audit logging.
- **Hours of Service (HoS) Duty Cycle Compliance**:
  - Heavy equipment operator duty status tracking (`operating`, `driving`, `standby`, `on_break`, `off_duty`).
  - Philippine DOLE-OSHC fatigue guardrails: 10.0-hour hard cap per shift with automated warning alert at 9.0 hours, mandatory rest breaks, and +10% Night Shift Differential (22:00–06:00).
  - Real-time fatigue risk scoring and shift log digital certification.

---

## 3. Fleet Management
- **Fleet Asset Registry & Maintenance**:
  - Transport trucks, flatbeds, lowbed trailers, escort vehicles, and support fleet units.
  - Vehicle maintenance work orders, defect logging, parts usage, run hours, and roadworthiness compliance.
- **Real-Time GPS Tracking & Telemetry (MapLibre GL)**:
  - Interactive MapLibre GL vector map with custom dark/light theme integration.
  - Real-time vehicle location markers with heading azimuth, speed, and freshness indicators (`fresh`, `delayed`, `stale`, `offline`).
  - Site geofences, designated staging bays, and route corridor overlays.
- **Driver Vehicle Inspection Reports (DVIR)**:
  - Standardized pre-trip and post-trip vehicle inspection checklists.
  - 4-angle walkaround photo tagging (`front`, `back`, `driver_side`, `passenger_side`) with photographic defect evidence.
  - Defect severity classification (`minor` vs `safety_critical`) with automatic critical safety lockout on compromised machines.
  - Digital operator signature and odometer recording.

---

## 4. Crane and Equipment Management
- **Heavy Equipment Registry & Specifications**:
  - Mobile cranes, crawler cranes, rough-terrain cranes, boom extensions, and rigging gear.
  - Load capacity charts, third-party crane safety certifications, and safe working load (SWL) verification.
- **Pre-Lift Safety Checklists & Safe-Release Verification**:
  - Pre-lift 3-state cycling inspection checklists (Pass / Attention / Critical Defect) with critical safety lockouts.
  - Post-repair safe-release return-to-service certification with digital sign-off before releasing equipment to operational status.
  - Outrigger pad placement, ground bearing pressure checks, and power line clearance verification.

---

## 5. Fuel Management
- **Multi-Step Fuel Request Workflow**:
  - Authorized field users submit fuel requests with quantity, fuel type, purpose, and optional job/asset.
  - Enforces ordered server workflow: `submitted` -> `forwarded` -> `approved/rejected` -> `verified` -> `logged`.
  - Independent supervisory review: requester cannot approve their own fuel request.
- **Verified Fuel Logs & Bowser Logistics**:
  - Mobile fuel bowser replenishment tracking and on-site tank levels.
  - Verification logging with liters dispensed, price per liter, total cost, odometer/hour meter, station info, and receipt photo attachments.
- **Baseline Burn Rate & Anomaly Detection**:
  - Asset baseline burn rate tracking (`baseline_burn_rate`, `burn_rate_unit`).
  - Effective burn rate and variance percentage calculation against historical prior logs.
  - Automated anomaly flagging (`is_anomaly`) with structured anomaly reasons and weekly aggregate reporting.

---

## 6. Shared Platform Services
- **User Administration & Role Management (3 Canonical System Users)**:
  - Single canonical role enforcement across operational software users: `System Administrator`, `Operations Manager`, `Operator`.
  - Workforce employee profile management (`PersonnelProfile`) for enterprise operational personnel (including non-software field personnel like **Riggers**) tracking certifications, qualifications (TESDA / DOLE-BOSH), and availability without issuing software login credentials.
  - Active/suspended status controls and operator qualification credential tracking.
- **Statutory Philippine Safety Governance (DOLE / OSHC)**:
  - Incident hazard reporting with GPS coordinates, severity triage, and verified photo rectification (`/api/v1/safety/hazards`).
  - Digital Critical Lift Plans for heavy lifts exceeding 75% rated capacity, tandem lifts, blind picks, or operations near energized powerlines, requiring independent Operations Manager authorization (`/api/v1/safety/lift-plans`).
  - Daily pre-lift Toolbox Meetings (TBM) with attendance tracking and crew digital cosignatures (`/api/v1/safety/toolbox-meetings`).
  - Imminent danger Work Stoppage Notices with mandatory hazard resolution before authorized resumption (`/api/v1/safety/work-stoppages`).
- **SOS Emergency Response System**:
  - High-priority distress alerts with instant location coordinates (`latitude`, `longitude`), categorization, and automated escalation timeouts.
  - Multi-channel delivery tracking and responder acknowledgement workflows.
  - Real-time emergency incident feed broadcast over Laravel Reverb (`operations.sos`).
  - Prioritized emergency hotline directory with SHA-256 phone hashing.
- **GPT Explainable Advisory & Resource Recommendations (`gpt-5-mini`)**:
  - AI-assisted resource allocation proposals based on job requirements and asset specifications.
  - Proactive background suggestions for complete, scheduled jobs with missing resources or blocking resource conflicts, using the authorized dispatch creator and existing quotas.
  - Strict 15-minute expiration countdown, $0.05 cost budget cap, and token telemetry tracking.
  - Human-in-the-loop confirmation modals with explicit plan application notices.
- **Job Reports & Private Attachments**:
  - Operator field work summaries, hours logged, and completion sign-offs.
  - Private multi-file upload (up to 10 files, 15 MiB per file) with SHA-256 cryptographic checksums and signed download links.
  - Managerial approval, rejection workflows, and resubmission tracking.
- **Notification Center & Asynchronous Data Exports**:
  - Multi-category event routing (`dispatch.*`, `safety.*`, `fuel.*`, `system.*`) with WCAG AA compliant visual tones.
  - Asynchronous background worker export for CSV and PDF formats across Dispatches, Reports, Assets, Fuel, Maintenance, and Audit logs.
- **System Administration Overrides & Health**:
  - Break-glass emergency abort of active dispatches (`emergencyAbortDispatch`).
  - Immediate safety lockdown of compromised assets (`safetyLockdownAsset`).
  - Automated system health telemetry (`/operations/admin/health`).
- **Archival & Immutable Audit Trail**:
  - Soft-deleted dispatch management with reason review and audited restoration.
  - Immutable audit trail recording all approvals, state changes, priority overrides, and user access events.

---

## 7. Native Field Mobile Application (`packages/field-mobile` for Operators)
- **Offline-First SQLite Architecture**:
  - Durable SQLite outbox queue persisting actor-scoped mutations during connectivity loss.
  - Bounded exponential backoff replay with 409 conflict detection, resolution, and HTTP 429 `Retry-After` delay backoff.
- **Hours of Service (HoS) Cockpit**:
  - Real-time shift duration timer and duty cycle state machine (`operating`, `driving`, `standby`, `on_break`, `off_duty`).
  - Philippine DOLE-OSHC fatigue guardrails: 10.0-hour hard operating cap with 9.0-hour threshold warning alert and +10% Night Shift Differential (22:00–06:00).
  - Safeguard intercept modals preventing unreleased asset tracking on shift completion.
  - Shift log digital certification with duty log history.
  - Tactical Cockpit HUD with seamless Daylight and Tactical Dark HUD theme switching.
- **Driver Vehicle Inspection Report (DVIR)**:
  - Standardized pre-trip and post-trip heavy equipment inspection checklists.
  - Equipment classification taxonomy (`heavy_crane`, `crawler_crane`, `rough_terrain_crane`, `boom_truck`, `heavy_transport_truck`, `earthmoving`, `material_handler`).
  - 4-angle walkaround photo tagging (`front`, `back`, `driver_side`, `passenger_side`) with photographic defect evidence.
  - Defect severity classification (`minor` vs `safety_critical`) with automatic critical safety lockout on compromised machines.
  - Digital operator signature and odometer/hour meter recording.
- **Assignment Offer & Smart Dual Handover**:
  - One-tap offer acceptance or structured rejection with mandatory reason selection.
  - Smart dual-handover protocol for equipment custody transfer between relief operators.
- **Heavy-Crane Route Navigation & Glanceable Drive Mode**:
  - In-cab turn-by-turn navigation HUD with bridge clearance corridor warnings, site entrance instructions, and delay reporting.
  - Large-format high-contrast HUD for safe operating in heavy vehicles.
- **Arrival & Crane Setup Safety Modes**:
  - 4-point Parked-and-Secured arrival checklist (parking brake, wheel chocks, amber strobes, ground stability).
  - Interactive 15m exclusion zone diagram with 4-point outrigger pad positioning, powerline clearance, and anemometer wind speed verification.
- **5-Tab Equipment Inspection & Maintenance Suite**:
  - 3-state cycling inspection checklist (Pass / Attention / Critical Defect) with critical safety lockouts.
  - Maintenance work order defect logging with severity categorization.
  - Safe-release post-repair return-to-service certification with digital signature.
  - Fuel receipt logging (liters, total cost, odometer, receipt number).
  - Custody transfer with condition ratings.
- **Floating SOS Jewel Panic Trigger**:
  - Raised circular SOS jewel docked in a scooped bottom-navigation cradle notch.
  - 2-second hold trigger confirmation modal to prevent accidental activation.
  - Emergency triage drawer sheet with real-time GPS tracking stream, incident categorization, and hotline dialing.

---

## 8. Accessibility & Responsive Hardening
- **WCAG 2.2 AA Compliance**:
  - High-contrast 2px visible focus rings on all interactive elements.
  - Minimum touch targets meeting or exceeding 44px on web and >=56px on native mobile bottom navigation.
  - High-contrast text (>4.5:1) and icon (>3:1) ratios; no state conveyed exclusively by color.
  - Global `prefers-reduced-motion` handling.
- **Responsive Layout**:
  - Seamless layout adaptation from 320px mobile viewports through 1920px+ ultrawide desktop monitors.
