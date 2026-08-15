# Core Transaction 2 — Module Architecture & Directory Index

## System Architecture Overview
Core Transaction 2 is structured as a modular monolith in Laravel 13 with an Inertia 3 / React 19 web frontend and a standalone React Native / Expo field mobile client.

---

## 1. Backend Modules (`app/Modules/`, `app/Platform/`, `app/Shared/`)

### A. Dispatch Module (`app/Modules/Dispatch/`)
- **Controllers**:
  - `OperationsWorkspaceController`: Primary Inertia controller serving `/operations` workspace and aggregate statistics.
  - `DispatchWorkflowController`: Handles dispatch CRUD, status transitions, priority overrides, and cancellations.
  - `DispatchActivationController`: Evaluates readiness and executes plan activation.
  - `ApprovalRequestController`: Handles submission and decisioning of manager approval requests.
  - `Api/V2/DispatchV2ApiController`: REST API v2 endpoints for dispatch jobs, plans, offers, readiness, progression, and outbox.
  - `Api/V1/FieldDispatchJobController`: REST API v1 endpoints for mobile field worker assignments and progression.
- **Models**:
  - `DispatchJob`: Central aggregate root representing an operational dispatch job.
  - `DispatchPlanVersion`: Immutable, versioned plan snapshots detailing personnel and asset assignments.
  - `DispatchAssignmentOffer`: Assignment offers dispatched to workers with accept/reject lifecycle.
  - `DispatchPersonnelAssignment`: Active worker assignments linked to a dispatch plan.
  - `DispatchAssetAssignment`: Active equipment/asset assignments linked to a dispatch plan.
  - `ApprovalRequest`: Independent managerial approval requests for exceptions and emergency priorities.
  - `AuditEvent`: Immutable operational audit trail records.
  - `DispatchOutboxMessage`: Asynchronous transactional outbox event messages.
  - `DispatchReconciliationFinding`: Discrepancy logs from data reconciliation sweeps.
- **ViewModels**:
  - `OperationsWorkspaceViewModel`: Comprehensive aggregate view model powering the live operations workspace.
  - `DispatchActivationWorkspaceViewModel`: Detailed readiness evaluation, safety blockers, and approval context.
- **Services & Commands**:
  - `DispatchV2Commands`: Unified domain command layer executing all lifecycle state mutations.
  - `EligibilityService`: Evaluates qualification, availability, and double-booking constraints.
  - `DispatchV2Reconciliation`: Reconciles legacy data and verifies referential integrity.
  - `DispatchV2MetricsService`: Aggregates real-time telemetry, queue depths, and operational metrics.
  - `IdempotentCommandService`: Secures idempotency keys and prevents replay attacks.

### B. Shared Asset & Fleet Module (`app/Shared/Assets/`)
- **Models**:
  - `OperationalAsset`: Physical fleet assets (Cranes, Transport Trucks, Support Units).
  - `AssetMaintenanceLog`: Defect logs, repair records, and maintenance work orders.
  - `AssetInspectionReport`: Safety inspection checklists and condition ratings.
- **Enums**:
  - `AssetStatus`: Canonical statuses (`available`, `assigned`, `working`, `under_inspection`, `under_maintenance`, `awaiting_parts`, `ready_for_service`, `unavailable`).
  - `AssetType`: Equipment classifications (`crane`, `truck`, `trailer`, `rigging_gear`).

### C. Shared Platform & Operations Modules
- **Job Reporting (`app/Modules/Reports/`)**:
  - Models: `JobReport`, `ReportAttachment`.
  - Enforces private storage access, SHA-256 integrity verification, and manager sign-off.
- **Data Exports (`app/Modules/Exports/`)**:
  - Model: `DataExport`.
  - Asynchronous background job generation (CSV/PDF) with 24-hour expiration windows.
- **AI Advisory (`app/Modules/Gpt/`)**:
  - Model: `GptRecommendation`.
  - Manages AI resource recommendations, explanation telemetry, and human confirmation gating.
- **Identity & Access (`app/Platform/Identity/`)**:
  - Models: `User`, `Role`, `Permission`.
  - Enforces Spatie granular permission tokens and single canonical role assignment.

---

## 2. Web Frontend Architecture (`resources/js/`, `resources/css/`)

### A. Pages (`resources/js/pages/`)
- `workspace.tsx`: The authoritative live operations workspace at `/operations`.
- `dispatch-detail.tsx`: The authoritative deep dispatch detail workspace at `/operations/dispatch-jobs/{id}`.
- `operations.tsx`: Isolated prototype/sandbox simulation surface with clear demo badges and no backend writes.
- `auth/*`: Authentication surfaces (Login, Reset Password, Verify Email).

### B. Live Workspace Components (`resources/js/components/workspace/`)
- `live-dispatch-workspace.tsx`: Unified multi-stream dispatch workspace and filtering.
- `live-dispatch-intake.tsx`: Multi-stream intake hub (Manual, Service Request, Rental, Sales Order).
- `schedule-board-week-view.tsx` & `schedule-board-month-view.tsx`: Calendar schedule views.
- `tracking-workspace-section.tsx`: Real-time MapLibre tracking and fleet telemetry view.
- `reports-workspace-section.tsx`: Job reports, SHA-256 attachment verification, and manager approval.
- `notifications-workspace-section.tsx` & `notification-center-popover.tsx`: Multi-category notification center.
- `exports-workspace-section.tsx`: Asynchronous CSV/PDF data exports manager.
- `gpt-workspace-section.tsx`: AI resource recommendation review and human decisioning.
- `archive-workspace-section.tsx`: Soft-deleted dispatch recovery and restoration.
- `live-workspace-sections.tsx`: User management, credential tracking, and immutable audit log viewer.

### C. MapLibre GIS Components (`resources/js/components/maplibre/`)
- `maplibre-map.tsx`: Dynamically code-split vector map rendering engine.
- `maplibre-vehicle-marker.tsx`: Vehicle markers with heading azimuth, speed, and status styling.
- `maplibre-legend.tsx` & `maplibre-cluster.tsx`: Spatial overlays and clustering.

### D. Shared UI & Design System (`resources/js/components/ui/`, `resources/css/app.css`)
- Standardized canonical status badges (`CanonicalStatusBadge`), buttons, dialogs, form controls, and accessible touch targets meeting WCAG 2.2 AA.

---

## 3. Native Field Mobile Application (`packages/field-mobile/`)

### A. Navigation & Shell (`src/navigation/`, `src/components/layout/`)
- `AppNavigator.tsx`: Root navigation stack (Auth, Today, Route, Profile, Inspection).
- `field-bottom-nav.tsx`: Accessible navigation bar with >=56px touch targets.
- `field-header.tsx`: Glanceable shift timer, connection state, and outbox sync status.

### B. Core Cards & Safety Panels (`src/components/cards/`, `src/components/panels/`)
- `ShiftStatusCard.tsx`: Shift duration timer and location telemetry switch.
- `AssignmentResponseCard.tsx`: Offer acceptance and structured rejection with mandatory reasons.
- `FieldProgressionStepper.tsx`: Monotonic forward progression stepper.
- `HeavyCraneRouteCard.tsx` & `HeavyCraneDriveModeModal.tsx`: High-contrast route navigation HUD.
- `ParkedSecuredCard.tsx`: 4-point arrival safety checklist.
- `CraneSetupSafetyCard.tsx`: 15m exclusion zone and outrigger pad positioning safety mode.
- `CommandConflictBanner.tsx`: 409 conflict detection and state resolution banner.
- `FailedCommandsList.tsx`: Outbox retry and discard management.

### C. Inspection & Maintenance (`src/screens/EquipmentInspectionScreen.tsx`)
- 5-tab inspection suite: Inspection Checklist, Maintenance Work Order, Safe-Release Certificate, Fuel Receipt, and Custody Handover.

### D. Storage & Offline Sync Engine (`src/storage/`, `src/services/`)
- `outboxRepository.ts`: SQLite-backed durable transactional outbox.
- `locationService.ts`: Hardware GPS location tracking and background telemetry.
- `apiClient.ts`: Authenticated REST client with optimistic versioning and retry logic.
