# Core Transaction 2 — Module Architecture & Directory Index

## System Architecture Overview
Core Transaction 2 is structured as a two-service monorepo:
- **Operations Monolith & BFF** (`apps/operations/`): Laravel 13, Inertia 3, React 19 web frontend, and dedicated queue workers (`ai` and `reports`).
- **Tracking & Telemetry Microservice** (`apps/tracking/`): Standalone Laravel 13 API service with dedicated database (`core2_ms_tracking`) and HMAC authentication.
- **Field Mobile Client** (`packages/field-mobile/`): Native React Native / Expo client.

---

## 1. Operations Monolith Backend Architecture (`apps/operations/app/`)

### A. The 5 Main Operational Business Modules

#### 1. Dispatch Job and Scheduling (Real-Time Activation) (`apps/operations/app/Modules/Dispatch/`)
- **Controllers**:
  - `ClientController`: CRUD and validation for operational clients (`/operations/clients`).
  - `ServiceRequestController`: Inbound customer service demand intake (`/operations/service-requests`).
  - `DispatchJobController`: Dispatch list/detail views, geospatial coordinate updates, and crane slot allocation (`/operations/dispatch-jobs`).
  - `DispatchWorkflowController`: Dispatch lifecycle execution (activate, cancel, reopen, archive, restore, status transitions).
  - `ApprovalRequestController`: Supervisory decisioning on priority and exception approval requests.
  - `Planning\ProjectPlanningController`: Multi-phase long-term project planning, phase equipment allocations, and shift rostering (`/operations/project-plans/*`).
  - `Api/V2/DispatchJobV2Controller`: REST API v2 endpoints for dispatch jobs, readiness projection, forward progression, cancel, reopen, and archive.
  - `Api/V2/DispatchPlanApprovalV2Controller`: REST API v2 endpoints for plan version submission, supervisory approval/rejection, and emergency overrides.
  - `Api/V1/FieldDispatchJobController`: REST API v1 endpoints for assigned field mobile job progression.
- **Actions & Commands**:
  - `DispatchV2Commands`: Unified domain command layer executing all V2 lifecycle mutations.
  - Actions: `ActivateDispatchJob`, `CancelDispatchJob`, `ReopenDispatchJob`, `ArchiveDispatchJob`, `RestoreDispatchJob`, `TransitionDispatchJob`, `ConvertServiceRequestToDispatch`, `CreateDispatchFromSource`, `CreateManualDispatchHandoff`, `DecideApprovalRequest`, `RecordTowerCraneShiftLog`.
- **Services & Queries**:
  - `DispatchOutboxCommandService`: Transactional outbox message recording and reliable delivery.
  - `DispatchV2ReconciliationService`: Verifies referential integrity and reconciles legacy state.
  - `DispatchV2RolloutService`: Dual-run rollout verification and shadow metrics.
  - `DispatchScheduleQuery`: Schedule overlap and window conflict lookups.
- **Models**:
  - `DispatchJob`, `ServiceRequest`, `Client`, `ApprovalRequest`, `DispatchHandoff`, `DispatchExecutionAttempt`, `DispatchPlanVersion`, `DispatchPlanRequirementSlot`, `DispatchPlanApproval`, `DispatchAssignmentOffer`, `DispatchEmergencyOverride`, `DispatchIdempotencyKey`, `DispatchAuditLineage`, `DispatchReconciliationRun`, `DispatchReconciliationFinding`, `DispatchOutboxMessage`.
  - Planning Models: `ProjectPlan`, `ProjectPlanPhase`, `ProjectPlanAllocation`, `ProjectPlanShift`.
- **Events & Jobs**:
  - Events: `DispatchExecutionTransitioned`, `DispatchOutboxMessageDelivered`.
  - Jobs: `DeliverDispatchOutboxMessage`.
  - Console: `php artisan dispatch:v2-rollout-status`, `php artisan dispatch:v2-reconcile`.

#### 2. Assign Driver/Operator and Equipment (`apps/operations/app/Modules/Assignment/`)
- **Controllers**:
  - `AssignmentController`: Web assignment, reassignment, and worker response endpoints (`/operations/dispatch-jobs/{id}/assignments`).
  - `Api/V2/AssignmentOfferV2Controller`: REST API v2 endpoints for proposing, accepting, rejecting, withdrawing, expiring assignment offers, and designating leads.
  - `Api/V1/AssignmentResponseController`: REST API v1 endpoint for worker assignment response.
  - `Api/V1/HandoverController`: REST API v1 endpoints for initiating and claiming smart dual custody handovers.
- **Actions & Services**:
  - `AssignDispatchResources`, `ReassignDispatchResources`, `RespondToDispatchAssignment`.
  - `DispatchAssignmentOfferCommandService`: Offer lifecycle state machine and lead designation invariants.
  - `DispatchResourceEligibility`: Server-side qualification, rest period, license/certification validity, and role verification.
  - `DispatchAssetUsageConflictChecker`: Tagged checker preventing cross-module double-booking.
- **Queries & Models**:
  - Queries: `DispatchActivationReadinessQuery`, `PersonnelCandidateQuery`, `AssetCandidateQuery`.
  - Models: `DispatchPersonnelAssignment`, `DispatchAssetAssignment`.
- **Integrated Hours of Service (HoS) Sub-system (`apps/operations/app/Modules/HoursOfService/`)**:
  - *Controllers & Routes*: `Api/V1/HosShiftController` (`/api/v1/hos/*` — `current-shift`, `shifts/start`, `duty-status`, `shifts/certify`, `cycle-history`).
  - *Domain Scope*: Enforces worker labor hours, duty status compliance (`operating`, `driving`, `standby`, `on_break`, `off_duty`), DOLE 10h fatigue guardrails, and +10% Night Shift Differential.
  - *Models*: `OperatorShift`, `OperatorDutyLog`.

#### 3. Fleet Management (`apps/operations/app/Modules/Fleet/`)
- **Controllers**:
  - `AssetCatalogController`: Filtered read catalog at `/operations/fleet/assets` and `/api/v1/fleet/assets`.
- **Domain Scope**:
  - Transport trucks, flatbeds, lowbed trailers, escort vehicles, and support fleet units.
  - Vehicle maintenance logs, run hours, roadworthiness compliance, and GPS fleet tracking.
- **Module Composition** (thin adapter — logic lives in the Shared Asset Kernel):
  - `FleetServiceProvider` + `Routes/web.php` (prefix `operations/fleet`, names `fleet.*`) + `Routes/api.php` (prefix `v1/fleet`).
  - Owned asset kinds: `truck`, `vehicle`.
  - Permission namespace: `FleetViewAll`, `FleetViewAssigned`, `FleetUpdateStatus`, `FleetInspect`, `FleetMaintain`.
  - `AssetCatalogController` extends the abstract `Shared\Assets\AssetCatalogController`, overriding only `assetKinds()`, `viewAllPermission()`, and `viewAssignedPermission()`.
- **Integrated Driver Vehicle Inspection Report (DVIR) Sub-system (`apps/operations/app/Modules/Dvir/`)**:
  - *Controllers & Routes*: `Api/V1/DvirInspectionController` at `/api/v1/dvir/inspections` (index, store, show) with `throttle:60,1`.
  - *Domain Scope*: Pre-trip and post-trip inspections, 4-angle walkaround photos (`front`, `back`, `driver_side`, `passenger_side`), defect severity (`minor` vs `critical`), immediate critical defect safety lockout, and digital operator sign-off.
  - *Models*: `DvirInspection`, `DvirInspectionCheck`, `DvirInspectionPhoto`.

#### 4. Crane and Equipment Management (`apps/operations/app/Modules/CraneEquipment/`)
- **Controllers**:
  - `AssetCatalogController`: Filtered read catalog at `/operations/equipment/assets` and `/api/v1/equipment/assets`.
- **Domain Scope**:
  - Mobile cranes, all-terrain cranes, crawler cranes, boom extensions, and rigging gear.
  - Load capacity charts, third-party crane safety certifications, pre-lift 3-state inspection checklists, rigging gear inspections, and safe-release verification.
- **Module Composition** (thin adapter — logic lives in the Shared Asset Kernel):
  - `CraneEquipmentServiceProvider` + `Routes/web.php` (prefix `operations/equipment`) + `Routes/api.php` (prefix `v1/equipment`).
  - Owned asset kinds: `crane`, `mobile_crane`, `equipment`.
  - Permission namespace: `EquipmentViewAll`, `EquipmentViewAssigned`, `EquipmentUpdateStatus`, `EquipmentInspect`, `EquipmentMaintain`.
  - `AssetCatalogController` extends the abstract `Shared\Assets\AssetCatalogController`, overriding only `assetKinds()`, `viewAllPermission()`, and `viewAssignedPermission()`.

#### 5. Fuel Management (`apps/operations/app/Modules/Fuel/`)
- **Controllers & Actions**:
  - `FuelRequestController`: Web endpoints at `/operations/fuel-requests` and `/operations/reports/weekly-fuel-summary`.
  - `Api/V1/FuelRequestController`: Mobile read endpoints at `/api/v1/fuel-requests`.
  - Actions: `CreateFuelRequest`, `TransitionFuelRequest` (enforcing `submitted → forwarded → approved/rejected → verified → logged`).
- **Telemetry & Anomaly Detection**:
  - Asset baseline burn rate tracking (`baseline_burn_rate`, `burn_rate_unit`).
  - Automated burn rate calculation, variance percentage evaluation, and anomaly flagging (`is_anomaly`, `anomaly_reason`).
- **Models**:
  - `FuelRequest`, `FuelLog`.

---

### B. Tri-Modal Business Flow Adapters (Core 1 Ingestion)
- **Rental Flow Adapter (`apps/operations/app/Modules/Rental/`)**:
  - Controller: `RentalReservationController`.
  - Models: `RentalReservation`, `RentalReservationItem`, `RentalOperatorAssignment`, `RentalCheckout`, `RentalReturnRecord`.
  - Scope: Rental reservations, equipment availability locking, operator assignment, checkout/return condition diffs, and return check-ins.
- **Sales Flow Adapter (`apps/operations/app/Modules/Sales/`)**:
  - Controllers: `SalesCatalogController`, `SalesOrderController`, `SalesQuoteController`.
  - Models: `SalesCatalogItem`, `SalesQuote`, `SalesQuoteItem`, `SalesOrder`, `SalesOrderItem`.
  - Scope: Sales catalog items, quote reservations, transport fulfillment, serial/VIN verification, inventory ledger, and ownership transfer.

---

### C. Shared Asset Kernel & Platform Services
- **Shared Asset Kernel (`apps/operations/app/Shared/Assets/`)**:
  The single engine behind both the Fleet and Crane & Equipment modules — one `OperationalAsset` model and one set of inspection/maintenance tables serve all asset kinds.
  - **Abstract catalog base** (`Http/Controllers/AssetCatalogController`): Paginated (50/page) read catalog with kind filtering and two-tier visibility.
  - **Controllers**: `OperationalAssetController`, `InspectionController`, `MaintenanceWorkOrderController`.
  - **Models**: `OperationalAsset`, `Inspection`, `MaintenanceWorkOrder`.
  - **Enums**: `AssetStatus` (`available`, `assigned`, `working`, `under_inspection`, `under_maintenance`, `awaiting_parts`, `ready_for_service`, `unavailable`), `AssetUsageType`.
  - **Services**: `OperationalAssetStatusGuard`, `OperationalAssetAvailability`.
- **Platform Services (`apps/operations/app/Platform/`)**:
  - `Identity/`: Authentication (normalized username-first), Spatie RBAC enforcing the **3 canonical system users** (`System Administrator`, `Operations Manager`, `Operator`), user status management, `PersonnelProfile`, `PersonnelCredential` (tracking enterprise operational employees, credentials, and DOLE/TESDA qualifications, including non-software field personnel like Riggers), and upstream Core HR / Workforce Management adapters.
  - `Safety/`:
    - **Statutory Safety Governance** (`SafetyGovernanceApiController`): DOLE/OSHC safety tickets (`safety/hazards`, `safety/lift-plans`, `safety/toolbox-meetings`, `safety/work-stoppages`, `safety/metrics`).
    - **SOS Emergency Response System** (`SosResponderController`, `SosConfigurationController`, `Api/V1/SosIncidentController`, Models: `SosIncident`, `SosIncidentRecipient`, `SosEmergencyContact`, `SosDeliveryAttempt`, Event: `SosIncidentChanged`, Jobs: `DeliverSosEscalationJob`, `SweepSosEscalationsJob`).
  - `Tracking/`: `TrackingClientInterface`, `HttpTrackingClient`, `FakeTrackingClient`, `DatabaseTrackingClient`, `LocationController`, `LocationUpdateController`. Serves as BFF proxy and integration adapter to the Tracking microservice.
  - `Weather/`: `LocationWeatherController`, `LocationWeatherService` (`/api/v1/telemetry/weather`). External Tomorrow.io weather & masthead wind telemetry adapter.
  - `Reporting/` & `Attachments/`: `JobReportController` (with meter/geo telemetry & resubmissions), `ReportExportController`, `AttachmentController`, Models: `JobReport`, `ReportExport`, `Attachment`.
  - `Workspace/`: `OperationsWorkspaceController`, `AdminOverrideController` (break-glass emergency abort, asset safety lockdown), `SystemHealthController`, Event: `WorkspaceUpdated`, ViewModels: `OperationsWorkspaceViewModel`.
  - `Notifications/`: `NotificationController`, Model: `Notification`, Job: `SendQueuedNotificationJob`.
  - `Gpt/`: `GptRecommendationController`, Proactive Dispatch Advisory Drawer, Models: `GptRecommendation`, `GptRecommendationMetric`, Jobs: `GenerateGptRecommendationJob`, `PruneGptRecommendationsJob`.
  - `Audit/`: Immutable audit trail (`AuditEvent`, `AuditLogger`).
  - `Idempotency/`: Command deduplication (`CommandLog`, `IdempotentCommandService`).

---

## 2. Tracking Microservice Backend Architecture (`apps/tracking/app/`)

- **Controllers (`Http/Controllers/Api/Internal/`)**:
  - `LocationController`: High-throughput GPS ingestion (`POST /internal/v1/locations`), latest position projection (`GET /internal/v1/locations/latest`), and historical location queries (`GET /internal/v1/locations`).
- **Middleware (`Http/Middleware/`)**:
  - `ValidateServiceSignature`: HMAC-SHA256 signature verification asserting `X-Service-Name`, `X-Timestamp`, and `X-Service-Signature` using `TRACKING_SERVICE_SECRET`.
- **Models (`Models/`)**:
  - `LocationSample`: Append-only high-frequency GPS coordinate stream.
  - `LatestLocation`: Materialized constant-time read projection for live map rendering.
  - `TrackingCommandReceipt`: Command idempotency receipt log preventing duplicate sample ingestion.
- **Console Commands (`Console/Commands/`)**:
  - `PruneLocationUpdatesCommand` (`location:prune`): Daily scheduled job nullifying precise coordinates older than 30 days per privacy policy.

---

## 3. Web Frontend Architecture (`apps/operations/resources/js/`)

### A. Pages (`apps/operations/resources/js/pages/`)
- `workspace.tsx`: Authoritative live operations workspace at `/operations` delivering role-adaptive views.
- `dispatch-detail.tsx`: Authoritative deep dispatch detail workspace at `/operations/dispatch-jobs/{id}`.
- `operations.tsx`: Isolated prototype/sandbox simulation surface with clear demo badges.
- `error.tsx`: Branded full-stack error boundary presenting friendly status screens and unique incident Reference IDs (401, 403, 404, 419, 429, 500, 503).
- `auth/*`: Authentication surfaces (Login, Reset Password, Verify Email).

### B. Live Workspace Components (`resources/js/components/workspace/`)
- `dispatch-workspace-entry.tsx`: Authoritative workspace router between the modern Dispatch Desk, legacy/field workspace, and Resource Coverage.
- `dispatch-desk/`: Primary modern dispatch desk implementation (`dispatch-desk.tsx`, `dispatch-resources.tsx`, `use-dispatch-search.ts`, `use-dispatch-desk-state.ts`, etc.) supporting paginated search, selection, and resource inspection.
- `direct-dispatch/`: Direct manual operational dispatch creation modals and summaries.
- `live-dispatch-workspace.tsx`: Incumbent dispatch board preserved for compatibility (`dispatch_workspace=classic` or operator field mode).
- `live-dispatch-intake.tsx`: Multi-stream intake hub (Manual, Service Request, Rental, Sales Order).
- `schedule-board-week-view.tsx` & `schedule-board-month-view.tsx`: Multi-scale schedule calendar boards.
- `project-planning-workspace.tsx` & `project-planning/`: Resource coverage timeline, phase reservations, weekly shift rostering, and allocation preview.
- `tracking-workspace-section.tsx`: Real-time MapLibre tracking, weather telemetry, and fleet telemetry view.
- `reports-workspace-section.tsx`: Job reports, SHA-256 attachment verification, and manager approval.
- `notifications-workspace-section.tsx` & `notification-center-popover.tsx`: Multi-category notification center.
- `exports-workspace-section.tsx`: Asynchronous CSV/PDF data exports manager.
- `gpt-workspace-section.tsx` & `dispatch-gpt-advisory.tsx` / `dispatch-advisory-card.tsx`: AI advisory reviews, recommendation confidence, resource commitments, and one-click acceptance.
- `archive-workspace-section.tsx`: Soft-deleted dispatch recovery and restoration.
- `live-workspace-sections.tsx`: Credential tracking, audit log viewer, approvals, overview, and dispatch desk panels.
- `live-workspace-shell.tsx`: Main workspace layout shell, top navigation, system health indicator, and emergency SOS broadcast banner.

### C. MapLibre GIS Components (`resources/js/components/maplibre/`)
- `maplibre-map.tsx`: Dynamically code-split vector map rendering engine.
- `maplibre-vehicle-marker.tsx`: Vehicle markers with heading azimuth, speed, and status styling.
- `maplibre-legend.tsx` & `maplibre-cluster.tsx`: Spatial overlays, site geofences, and clustering.

### D. Shared UI & Design System (`resources/js/components/ui/`, `resources/css/app.css`)
- Standardized canonical status badges (`CanonicalStatusBadge`), buttons, dialogs, form controls, and accessible touch targets meeting WCAG 2.2 AA.

---

## 4. Native Field Mobile Application (`packages/field-mobile/`)

### A. Navigation & Shell (`src/navigation/`, `src/components/layout/`)
- `AppNavigator.tsx`: Root navigation stack (Auth, Today, Route, Profile, Inspection, DVIR).
- `field-bottom-nav.tsx`: Floating pill bottom navigation with >=56px touch targets and centered scooped cradle notch for the SOS jewel.
- `field-header.tsx`: Glanceable shift timer, connection state, outbox sync status, and interactive drawer sheet.
- `themeContext.tsx` & `useThemeTokens.ts`: Dynamic Daylight vs Tactical Cockpit HUD Dark Mode styling.

### B. Core Screens & Workspaces (`packages/field-mobile/src/screens/`)
- `HosScreen.tsx`: Hours of Service compliance cockpit, shift clock in/out, duty status toggle (`operating`, `driving`, `standby`, `on_break`, `off_duty`), DOLE 10h fatigue warnings, and +10% Night Shift Differential.
- `DvirScreen.tsx`: Pre/post-trip inspections, asset classification, 4-angle walkaround photo tagging (`front`, `back`, `driver_side`, `passenger_side`), defect severity classification, immediate safety defect lockout, and digital driver sign-off.
- `AssignedJobsListScreen.tsx`: Assigned jobs feed, offer acceptance/rejection, and job details.
- `HeavyCraneDriveModeScreen.tsx`: High-contrast in-cab turn-by-turn navigation HUD with clearance and corridor warning overlays.
- `FuelScreen.tsx`: Mobile fuel requests, dispensed liters, meter readings, receipt photo capture.
- `EquipmentInspectionScreen.tsx`: 5-tab inspection suite (Checklist, Maintenance Work Order, Safe-Release Certificate, Fuel Receipt, Custody Handover).
- `OperatorDashboardScreen.tsx`: Operator overview, active equipment binding, and telemetry state.
- `RentalHandoverScreen.tsx` & `SalesDeliveryScreen.tsx`: Equipment condition checkout/return and sales delivery handovers.
- `DocumentsWalletScreen.tsx`: Digital credentials, licenses, certifications, and compliance wallet.

### C. Core Cards & Safety Panels (`src/components/cards/`, `src/components/panels/`, `src/components/inspection/`)
- `ShiftStatusCard.tsx`: Real-time shift duration timer, duty cycle status, and location telemetry switch.
- `AssignmentResponseCard.tsx`: Offer acceptance and structured rejection with mandatory reasons.
- `FieldProgressionStepper.tsx`: Monotonic forward progression stepper.
- `ParkedSecuredCard.tsx`: 4-point arrival safety checklist.
- `CraneSetupSafetyCard.tsx`: 15m exclusion zone and outrigger pad positioning safety mode.
- `CommandConflictBanner.tsx`: 409 conflict detection and state resolution banner.
- `FailedCommandsList.tsx`: Outbox retry and discard management with 429 rate limit backoff.

### D. Storage & Offline Sync Engine (`src/storage/`, `src/services/`)
- `outboxRepository.ts`: SQLite-backed durable transactional outbox with 429 backoff support.
- `locationService.ts`: Hardware GPS location tracking and background telemetry.
- `apiClient.ts`: Authenticated REST client with optimistic versioning, retry backoff, and 429 `Retry-After` parsing.
