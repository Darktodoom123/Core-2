# Core Transaction 2 — Comprehensive UI Surface Inventory

**Phase:** UI-0 Baseline  
**Date:** 2026-08-15  
**Authority:** [Docs/Design.md](file:///c:/Users/User/Desktop/Core-2/Docs/Design.md), [Docs/features.md](file:///c:/Users/User/Desktop/Core-2/Docs/features.md), [Docs/modules.md](file:///c:/Users/User/Desktop/Core-2/Docs/modules.md), [Docs/consolidated/05_Design_System_Specification.md](file:///c:/Users/User/Desktop/Core-2/Docs/consolidated/05_Design_System_Specification.md)

---

## 1. Executive Summary

This document establishes the authoritative baseline inventory of all user interface surfaces, components, routes, permissions, and status vocabularies across the Core Transaction 2 repository. It distinguishes between **Live** (server-backed on routed paths), **Partial** (API-backed or incomplete UX flows), **Prototype** (unrouted fixture/reducer UI), and **Planned** (defined targets for implementation).

---

## 2. UI Surface Classification Matrix

### 2.1 Live UI Surfaces (Production Routed)

| Surface | File Path | Route / URL | Role Access | Key Features & Implemented Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Operations Workspace Shell** | `resources/js/pages/workspace.tsx`<br>`resources/js/components/workspace/live-workspace-shell.tsx` | `/operations`<br>`/workspace` | System Administrator, Dispatcher, Operations Manager, Driver, Crane Operator, Field Technician | Main authenticated shell, collapsible 248px sidebar, user menu, active module routing, toast notification stack, role-based nav filters. |
| **Operations Overview Dashboard** | `resources/js/components/dashboards/operations-overview-dashboard.tsx` | `/operations` (Overview tab) | Dispatcher, Operations Manager, Administrator | Quick operational metrics, actionable pending approvals list, asset safety blocker list, fuel workflow cards, stale telemetry alerts, embedded live tracking preview. |
| **Live Dispatch Workspace** | `resources/js/components/workspace/live-dispatch-workspace.tsx`<br>`resources/js/components/workspace/live-dispatch-intake.tsx` | `/operations` (Dispatch tab) | Dispatcher, Operations Manager | Client registration, transitional service request intake, one-to-many draft dispatch conversion, schedule board (Day, Week, Month), conflict indicators, status badge formatting. |
| **Dispatch Detail Workspace** | `resources/js/pages/dispatch-detail.tsx` | `/operations/dispatch-jobs/{dispatchJob}` | Dispatcher, Operations Manager, Assigned Personnel | Server-authoritative setup workspace, resource assignment forms, candidate eligibility & conflict toggles, approval decision banners, activation readiness checks, lifecycle progression, cancellation/reopen/archive actions. |
| **Live Tracking Map & List** | `resources/js/components/live-tracking-map.tsx`<br>`resources/js/components/dashboards/live-tracking-preview.tsx` | `/operations` (Tracking tab) | Dispatcher, Operations Manager, Administrator | MapLibre GL JS vector map, Stadia basemap styling, synchronized list alternative, freshness threshold chips (Fresh <2m, Delayed 2–10m, Stale >10m, Offline >30m), client-side location outbox with queue/sync/conflict states. |
| **Authentication Surfaces** | `resources/js/pages/auth/*` | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Unauthenticated / Internal users | Username/password login, email verification notice & link handling, password reset token flow, session expiration handling. |
| **Mobile Assigned Jobs List** | `packages/field-mobile/src/screens/AssignedJobsListScreen.tsx` | Native Mobile Shell (Field App) | Driver, Crane Operator, Field Technician | Touch-first (>=44px), today's assigned jobs, assignment offer accept/reject card with required reason, status progression header, offline SQLite sync indicator, location sharing toggle. |
| **Mobile Job Detail Screen** | `packages/field-mobile/src/screens/JobDetailScreen.tsx` | Native Mobile Shell (Field App) | Driver, Crane Operator, Field Technician | Touch-first forward-only lifecycle progression (`dispatched -> accepted -> en_route -> arrived -> working -> completed`), heavy-crane driver summary, park-and-secure confirmation, offline outbox banner, optimistic version conflict detection. |

---

### 2.2 Partial UI Surfaces (API-Backed / Scaffolding)

| Surface | File Path | Current Status | Implemented Slice | Missing / Target Implementation |
| :--- | :--- | :--- | :--- | :--- |
| **Reports Workspace** | `resources/js/components/workspace/reports-workspace-section.tsx` | Partial UI | Scoped report listing, submission modal, private PDF/image attachment upload with checksums. | Complete report review workflow, operations summary aggregation cards, approval/rejection notes. |
| **Notifications Center** | `resources/js/components/workspace/notifications-workspace-section.tsx`<br>`resources/js/components/workspace/notification-center-popover.tsx` | Partial UI | Popover notification list, unread badge counter, individual mark-as-read mutation. | Dedicated full-page notification management, bulk mark-as-read, category filtering (dispatch, safety, fuel, system). |
| **Data Exports Center** | `resources/js/components/workspace/exports-workspace-section.tsx` | Partial UI | Export creation modal (CSV/PDF), download links for generated files, retry failed export. | Live export progress polling indicator, 24-hour expiry countdown, dataset filtering (dispatches, assets, fuel, audit). |
| **GPT Dispatch Advisor** | `resources/js/components/workspace/gpt-workspace-section.tsx` | Partial UI | Asynchronous recommendation trigger, review modal, human accept/reject/retry actions, 15m expiry. | Integrated inline dispatch recommendation rail, conflict revalidation presentation at acceptance, token/cost metrics display. |
| **Archive & Restore Workspace** | `resources/js/components/workspace/archive-workspace-section.tsx` | Partial UI | Soft-deleted / archived dispatch job table, restore confirmation modal. | Advanced filtering by archived date range, batch restore, permanent purge prevention safeguards. |
| **Rental Operational Workspace** | `app/Modules/Rental/` (Backend complete) | Partial Backend/UI | Backend reservations, operator assignment, checkout/return, condition records, asset conflict checker. | Source-aware intake form in Dispatch Workspace, rental reservation card, equipment checkout/return completion panels. |
| **Sales Fulfillment Workspace** | `app/Modules/Sales/` (Backend complete) | Partial Backend/UI | Backend catalog, quotes, orders, inventory reservation, fulfillment, ownership transfer, conflict checker. | Source-aware intake form in Dispatch Workspace, sales order fulfillment card, ownership transfer completion panel. |

---

### 2.3 Prototype UI Surfaces (Unrouted / Fixture-Based Reference)

| Surface | File Path | Purpose & Status | Transition Strategy |
| :--- | :--- | :--- | :--- |
| **Prototype Operations Page** | `resources/js/pages/operations.tsx` | Unrouted design prototype showcasing full role-adaptive experience, dev user switcher, and multi-surface tab switching. | Extract reusable interaction patterns, migrate role-specific views into live workspace, retire fixture reducer. |
| **Local Operations Map** | `resources/js/components/local-operations-map.tsx` | Prototype SVG/Canvas asset map with mock vehicle telemetry. | Replaced by `live-tracking-map.tsx` (MapLibre GL JS); retire completely in UI-5. |
| **Prototype Surface Panels** | `resources/js/components/surfaces/` (`dispatch-surfaces.tsx`, `management-surfaces.tsx`, `mobile-surfaces.tsx`, `resource-surfaces.tsx`, `tracking-surfaces.tsx`) | Component library built against fixture state (`resources/js/state/operations-reducer.ts`). | Refactor to consume live Laravel Inertia view models or retire redundant components in UI-5. |
| **Fixture Data Store** | `resources/js/data/fixtures/` (`assets.ts`, `dispatch-jobs.ts`, `fuel.ts`, `users.ts`) | Mock records used exclusively by prototype pages. | Preserve for isolated UI unit tests; ensure zero imports in production pages. |

---

### 2.4 Planned UI Surfaces (Target Specifications)

| Surface | Target Phase | Documented Requirements |
| :--- | :--- | :--- |
| **Shared Source-Aware Dispatch Intake** | `UI-1` | Single intake modal supporting Service, Rental, Sale, and Manual Intake with explicit `manual_intake` provenance badge, source-specific validation, and Core 1 linking/reconciliation states. |
| **Heavy-Crane Driver Drive Mode** | `UI-4` | Compact mobile route card, heavy-vehicle site entrance & staging route preview, route freshness banner, voice/haptic-friendly large touch targets (no typing while moving). |
| **Parked & Secured Confirmation** | `UI-4` | Explicit mobile checkpoint required after arrival before any crane setup or operation controls are unlocked. |
| **Crane Setup Safety Mode** | `UI-4` | Site hazard map, exclusion zone diagram, blocking safety checklist verification before operation controls become active. |
| **Field Technician Workflows** | `UI-4` | Mobile asset inspection checklists, maintenance work order defect logging, post-repair safe release verification, fuel receipt verification. |
| **Responsive & A11y Polish** | `UI-6` | 320px–1440px fluid responsive layout, WCAG 2.2 AA compliance, 3px visible focus rings, 200% text zoom reflow, reduced motion preference adherence. |

---

## 3. Canonical Routes & Permissions Register

### 3.1 Web Routes (`routes/web.php` & Modules)

| Method | URI Path | Action / Controller | Permission Guard | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/login` | `AuthenticatedSessionController@create` | Guest | Login form |
| `POST` | `/login` | `AuthenticatedSessionController@store` | Guest (Throttled) | Authenticate user session |
| `POST` | `/logout` | `AuthenticatedSessionController@destroy` | Auth | Invalidate session |
| `GET` | `/operations` | `WorkspaceController@index` | Auth | Main operations workspace |
| `POST` | `/operations/clients` | `ClientController@store` | `dispatch.create` | Create active client |
| `POST` | `/operations/service-requests` | `ServiceRequestController@store` | `dispatch.create` | Submit service request |
| `GET` | `/operations/dispatch-jobs` | `DispatchJobController@index` | `dispatch.view_all` \| `dispatch.view_assigned` | List dispatch jobs |
| `POST` | `/operations/dispatch-jobs` | `DispatchJobController@store` | `dispatch.create` | Create / convert dispatch |
| `GET` | `/operations/dispatch-jobs/{dispatchJob}` | `DispatchJobController@show` | `dispatch.view_all` \| `dispatch.view_assigned` | Dispatch job detail workspace |
| `POST` | `/operations/dispatch-jobs/{dispatchJob}/activate` | `DispatchWorkflowController@activate` | `dispatch.activate` | Activate ready dispatch |
| `POST` | `/operations/dispatch-jobs/{dispatchJob}/assignments` | `AssignmentController@assign` | `assignments.create` | Assign personnel / assets |
| `POST` | `/operations/dispatch-jobs/{dispatchJob}/assignments/{assignment}/response` | `AssignmentController@respond` | `assignments.respond` | Accept / reject assignment |
| `POST` | `/operations/dispatch-jobs/{dispatchJob}/reassign` | `AssignmentController@reassign` | `assignments.reassign` | Reassign resources |
| `POST` | `/operations/dispatch-jobs/{dispatchJob}/status` | `DispatchWorkflowController@transition` | `dispatch.update_own_status` \| `dispatch.update` | Progress lifecycle status |
| `POST` | `/operations/dispatch-jobs/{dispatchJob}/cancel` | `DispatchWorkflowController@cancel` | `dispatch.cancel` | Cancel dispatch job |
| `POST` | `/operations/dispatch-jobs/{dispatchJob}/reopen` | `DispatchWorkflowController@reopen` | `dispatch.create` | Reopen cancelled dispatch |
| `POST` | `/operations/dispatch-jobs/{dispatchJob}/archive` | `DispatchWorkflowController@archive` | `archive.manage` | Soft-delete / archive dispatch |
| `POST` | `/operations/dispatch-jobs/{dispatchJob}/restore` | `DispatchWorkflowController@restore` | `archive.manage` | Restore archived dispatch |
| `GET` | `/operations/fleet/assets` | `AssetCatalogController@indexFleet` | `fleet.view_all` \| `fleet.view_assigned` | List fleet vehicles |
| `GET` | `/operations/equipment/assets` | `AssetCatalogController@indexEquipment` | `equipment.view_all` \| `equipment.view_assigned` | List cranes & equipment |
| `GET` | `/operations/fuel-requests` | `FuelRequestController@index` | `fuel.view_all` \| `fuel.view_own` | List fuel requests |
| `POST` | `/operations/fuel-requests` | `FuelRequestController@store` | `fuel.request` | Create fuel request |
| `POST` | `/operations/fuel-requests/{fuelRequest}/status` | `FuelRequestController@transition` | `fuel.forward` \| `fuel.approve` \| `fuel.verify` | Fuel lifecycle step |
| `GET` | `/operations/locations` | `LocationUpdateController@index` | `tracking.view_all` | Operations location feed |
| `POST` | `/operations/locations` | `LocationUpdateController@store` | `tracking.share_own` | Submit worker location |
| `GET` | `/operations/job-reports` | `JobReportController@index` | `reports.view_all` \| `reports.view_own` | List job reports |
| `POST` | `/operations/job-reports` | `JobReportController@store` | Auth | Submit job report |
| `POST` | `/operations/reports/exports` | `ReportExportController@store` | `reports.export` | Request CSV/PDF export |
| `GET` | `/operations/reports/exports/{export}/download` | `ReportExportController@download` | `reports.export` | Download signed export |
| `POST` | `/operations/gpt-recommendations` | `GptRecommendationController@store` | `gpt.use_dispatch` | Request GPT recommendation |
| `POST` | `/operations/gpt-recommendations/{recommendation}/accept` | `GptRecommendationController@accept` | `dispatch.create` \| `assignments.create` | Accept recommendation |
| `POST` | `/operations/gpt-recommendations/{recommendation}/reject` | `GptRecommendationController@reject` | Auth | Reject recommendation |
| `GET` | `/operations/users` | `UserManagementController@index` | `users.manage` | List users & credentials |
| `GET` | `/operations/rental-reservations` | `RentalReservationController@index` | `rental.view` | List rental reservations |
| `POST` | `/operations/rental-reservations` | `RentalReservationController@store` | `rental.create` | Create rental reservation |
| `GET` | `/operations/sales/orders` | `SalesOrderController@index` | `sales.view` | List sales orders |

---

### 3.2 Mobile API Routes (`routes/api.php` & `/api/v1`)

| Method | URI Path | Action / Controller | Guard | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | `FieldAuthController@login` | Guest (Throttled) | Issue mobile device Sanctum token |
| `POST` | `/api/v1/auth/logout` | `FieldAuthController@logout` | Sanctum Auth | Revoke device token |
| `GET` | `/api/v1/field/jobs` | `FieldDispatchJobController@index` | Sanctum Auth (`dispatch.view_assigned`) | Assigned jobs for authenticated worker |
| `GET` | `/api/v1/field/jobs/{dispatchJob}` | `FieldDispatchJobController@show` | Sanctum Auth (`dispatch.view_assigned`) | Assigned job detail & active offer |
| `POST` | `/api/v1/field/jobs/{dispatchJob}/assignments/{assignment}/response` | `FieldDispatchJobController@respondAssignment` | Sanctum Auth (`assignments.respond`) | Accept / reject assignment offer |
| `POST` | `/api/v1/field/jobs/{dispatchJob}/status` | `FieldDispatchJobController@transitionStatus` | Sanctum Auth (`dispatch.update_own_status`) | Idempotent status progression |
| `POST` | `/api/v1/field/location` | `FieldLocationController@store` | Sanctum Auth (`tracking.share_own`) | Idempotent location update |

---

## 4. State Vocabulary & Design Token Standards

### 4.1 Canonical State Vocabularies

```
[Dispatch Lifecycle]
draft -> pending_approval -> scheduled -> dispatched -> accepted -> en_route -> arrived -> working -> completed / cancelled

[Fuel Lifecycle]
submitted -> forwarded -> approved / rejected -> verified -> logged

[Asset Operational State]
available | assigned | working | under_inspection | under_maintenance | awaiting_parts | ready_for_service | unavailable

[Approval State]
pending | approved | rejected

[Telemetry Freshness]
fresh (<2m) | delayed (2-10m) | stale (>10m) | offline (>30m)
```

### 4.2 Color Role & Icon Pairings

- **Brand Amber (`--color-brand`):** Primary actions, active navigation, focused controls. (Icon: Lucide arrow/check, text label).
- **Warning Orange-Red (`--color-warning`):** Resolvable conflicts, schedule overlaps, delayed telemetry. (Icon: `AlertTriangle`, warning text).
- **Danger Red (`--color-danger`):** Hard safety blocks, unreleased maintenance, cancelled state, destructive actions. (Icon: `ShieldAlert` / `XCircle`).
- **Success Green (`--color-success`):** Confirmed assignments, completed jobs, synchronized outbox, available assets. (Icon: `CheckCircle2`).
- **Info Cobalt (`--color-info`):** Secondary metadata, export download status, informational notes. (Icon: `Info`).

---

## 5. UI-0 Exit Gate Verification

- [x] Comprehensive inventory of Live, Partial, Prototype, and Planned UI surfaces documented.
- [x] Canonical routes, permissions, and controllers cataloged and cross-referenced.
- [x] Zero product code modified.
- [x] Graph structure (`UI-EXECUTION-GRAPH.json`, `UI-EXECUTION-GRAPH.md`) created.
- [x] Handoff files initialized.
