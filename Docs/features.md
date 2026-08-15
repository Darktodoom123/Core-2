# Core Transaction 2 — Feature Catalog

## Overview
Core Transaction 2 (Operations, Dispatch, Fleet & Native Field Mobile) delivers the complete end-to-end operational backbone for equipment dispatching, crane operations, crew scheduling, safety compliance, real-time telemetry, and field workflows.

---

## 1. Source-Aware Dispatch Intake Hub & Shared Workspace
- **Direct Manual Operational Intake**:
  - Direct draft dispatch creation with explicit `[Manual • manual_intake]` provenance.
  - Site instructions, priority tagging (`routine`, `priority`, `emergency`), ground bearing assessment, outrigger pad clearance, power line clearance, and municipal permit checklists.
  - Operates independently without requiring upstream Core 1 commercial quotation or sales order creation.
- **Service Request Intake & Multi-Draft Conversion**:
  - Service demand handoff with customer, location, and requirement capture.
  - Multi-dispatch conversion enabling a single service demand to be staged into multiple specialized dispatch drafts (e.g. site prep, crane delivery, operation, demobilization).
- **Rental Reservation Delivery Handoffs**:
  - Direct intake of rental reservation dispatches with reservation window tracking, equipment condition checklists (safe-release certified, fuel level 100%, certification active), and crane operator assignment context.
- **Sales Order Delivery Handoffs**:
  - Logistics fulfillment intake with order value, delivery vs pickup mode, and precise geo-coordinates.
- **Unlinked Handoff Queue & Intelligent Draft Reconciliation**:
  - Staging queue for unlinked Core 1 commercial transactions with automated matching against existing manual drafts to avoid duplicate executions.
- **Unified Multi-Source Dispatch Board**:
  - Filterable by source (`all`, `service_request`, `rental_reservation`, `sales_order`, `manual`), status, priority, and date.
  - Shared Day, Week, and Month multi-scale schedule calendar boards with conflict detection.

---

## 2. Resource Allocation, Eligibility & Approval Lifecycle
- **Personnel & Asset Assignment**:
  - Multi-resource assignment (Lead Operator, Riggers, Technicians, Cranes, Transport Trucks, Support Equipment).
  - Server-side qualification, license certification, rest-period, and equipment readiness checks.
  - Real-time double-booking conflict mitigation across overlapping time windows.
- **Multi-Tier Approval Gates & Exception Overrides**:
  - Independent Operations Manager authorization required for emergency priority activations or unassigned required roles.
  - Human review decisions (Approve/Reject) with structured notes and audit logging.
- **Canonical Dispatch Lifecycle Progression**:
  - Forward-only state progression: `draft` -> `pending_approval` -> `scheduled` -> `dispatched` -> `accepted` -> `en_route` -> `arrived` -> `working` -> `completed` / `cancelled`.
  - Reassignment, cancellation with reason codes, and reopening workflows.

---

## 3. Real-Time Tracking & Telemetry (MapLibre GL)
- **Interactive Fleet Operations Map**:
  - Dynamically chunked, high-performance MapLibre GL vector map with custom dark/light theme integration.
  - Real-time vehicle location markers with heading azimuth, speed, and freshness indicators (`fresh`, `delayed`, `stale`, `offline`).
  - Site geofences, designated staging bays, and route corridor overlays.

---

## 4. Shared Platform Surfaces
- **Job Reports & Private Attachments**:
  - Operator field work summaries, hours logged, and completion sign-offs.
  - Private multi-file upload (up to 10 files, 15 MiB per file) with SHA-256 cryptographic checksums and signed download links.
  - Managerial approval and rejection workflows.
- **Notification Center & Popover**:
  - Multi-category event routing (`dispatch.*`, `safety.*`, `fuel.*`, `system.*`) with WCAG AA compliant visual tones.
  - Compact header popover with unread counter badge and full notification center with bulk read actions.
- **Asynchronous Background Data Exports**:
  - Asynchronous background worker export for CSV and PDF formats across Dispatches, Reports, Assets, Fuel, Maintenance, and Audit logs.
  - Live progress polling, 24-hour expiration countdown, and automatic retry controls.
- **GPT Explainable Advisory & Resource Recommendations**:
  - AI-assisted resource allocation proposals based on job requirements and asset specifications.
  - Strict 15-minute expiration countdown, $0.05 cost budget cap, and token telemetry tracking.
  - Human-in-the-loop confirmation modals with explicit plan application notices.
- **User Administration & Role Management**:
  - Single canonical role enforcement (`Administrator`, `Operations Manager`, `Dispatcher`, `Field Worker`, `Driver`, `Technician`, `Safety Officer`).
  - Active/suspended status controls and operator qualification credential tracking.
- **Archival & Immutable Audit Trail**:
  - Soft-deleted dispatch management with reason review and audited restoration.
  - Immutable audit trail recording all approvals, state changes, priority overrides, and user access events.

---

## 5. Native Field Mobile Application (`packages/field-mobile`)
- **Offline-First SQLite Architecture**:
  - Durable SQLite outbox queue persisting actor-scoped mutations during connectivity loss.
  - Bounded exponential backoff replay with 409 conflict detection and resolution.
- **Today's Work & Shift Management**:
  - Glanceable shift status card with active timers, GPS sharing toggles, and sync status.
  - Failed command management with retry attempt counts and discard options.
- **Assignment Offer Management**:
  - One-tap offer acceptance or structured rejection with mandatory reason selection.
- **Heavy-Crane Route Navigation & Glanceable Drive Mode**:
  - Bridge clearance corridor warnings, site entrance/gate instructions, and real-time delay reporting.
  - Large-format high-contrast HUD for safe driving navigation.
- **Arrival & Crane Setup Safety Modes**:
  - 4-point Parked-and-Secured arrival checklist (parking brake, wheel chocks, amber strobes, ground stability).
  - Interactive 15m exclusion zone diagram with 4-point outrigger pad positioning, powerline clearance, and anemometer wind speed verification.
- **5-Tab Equipment Inspection & Maintenance Suite**:
  - 3-state cycling inspection checklist (Pass / Attention / Critical Defect) with critical safety lockouts.
  - Maintenance work order defect logging with severity categorization.
  - Safe-release post-repair return-to-service certification with digital technician signature.
  - Fuel receipt logging (liters, total cost, odometer, receipt number).
  - Technician-to-operator custody transfer with condition ratings.

---

## 6. Accessibility & Responsive Hardening
- **WCAG 2.2 AA Compliance**:
  - High-contrast 2px visible focus rings on all interactive elements.
  - Minimum touch targets meeting or exceeding 44px on web and 48px on native mobile.
  - High-contrast text (>4.5:1) and icon (>3:1) ratios; no state conveyed exclusively by color.
  - Global `prefers-reduced-motion` handling.
- **Responsive Layout**:
  - Seamless layout adaptation from 320px mobile viewports through 1920px+ ultrawide desktop monitors.
