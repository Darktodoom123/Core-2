# Project: Web Dispatch & Operations Workspace Parity

## Architecture
- **Backend Domain Integration**: Direct bridge between Laravel core modules (`App\Modules\HoursOfService`, `App\Modules\Dvir`, `App\Modules\Fuel`, `App\Platform\Reporting`, `App\Modules\Assignment`) and the Web Operations Workspace (`OperationsWorkspaceController` and `OperationsWorkspaceViewModel`).
- **Data Persistence & Relationships**:
  - `OperationalAsset` linked to `dvirInspections()`, `latestDvirInspection()`, and `activeOperatorShift()`.
  - `FuelRequest` linked to `operator_shift_id`.
  - `JobReport` linked to `OperatorDutyLog` (standby/delay logs) and cross-referenced with `DvirInspection` and `FuelRequest` for the parent dispatch job.
- **Safety Lockout Architecture**:
  - `CreateDvirInspectionAction` automatically triggers equipment lockout when critical defects exist: updates `OperationalAsset.status` to `AssetStatus::UnderMaintenance` and creates a dispatch-blocking `MaintenanceWorkOrder`.
  - Dispatch board prevents assignment of locked-out assets; authorized managers can clear lockout via audited safety override.
- **Frontend Architecture & Modular Decomposition**:
  - Authoritative entrypoint: `apps/operations/resources/js/pages/workspace.tsx` and `apps/operations/resources/js/components/workspace/live-workspace-shell.tsx`.
  - Decompose monolithic `live-workspace-sections.tsx` (4,816 lines) into modular SOLID domain directories:
    * `apps/operations/resources/js/components/workspace/fleet/` (AssetsSurface, operator binding, HoS clocks, DOLE warnings, DVIR photo gallery, safety lockout)
    * `apps/operations/resources/js/components/workspace/fuel/` (FuelSurface, 5-stage transition modal, meter validation, receipt photo upload, variance & anomaly alerts)
    * `apps/operations/resources/js/components/workspace/reports/` (ReportsSurface, digital signatures, delay/demurrage logs, review dialog, cross-references)
  - Prototype Debt Elimination: Purge unrouted simulation wrappers (`operations.tsx`, `operations-reducer.ts`, `data/fixtures/`, `PrototypeSandboxBanner`).
- **Design System & Industrial Tokens**:
  - Tailwind tokens, `Panel`, `CanonicalStatusBadge`, `Stat`, `EmptyState`, Instrument Sans typography, and high-density monospaced data tags.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Live Operator Binding & Telemetry Proxy | Display active operator, shift start time, duration, and telemetry freshness (`Fresh`, `Delayed`, `Stale`, `Offline`) per asset. | M1, M2 | ORIGINAL_REQUEST §R1 |
| 2 | Equipment Hours of Service (HoS) Clocks | Display current duty status (`Operating`, `Driving`, `Standby`, `Rest/Break`, `Off Duty`) and cumulative shift operating hours on web. | M1, M2 | ORIGINAL_REQUEST §R1 |
| 3 | DOLE 10-Hour Fatigue Warnings | Detect and display fatigue cautions at 9.0h and critical hard-cap warnings at 10.0h with relief handover prompts. | M1, M2 | ORIGINAL_REQUEST §R1 |
| 4 | Pre/Post-Trip DVIR Badges & Details | Expose inspection status badges (`Passed`, `Defect Flagged`, `Pending Inspection`) and checklist logs on asset cards/tables. | M1, M2 | ORIGINAL_REQUEST §R1 |
| 5 | Walkaround Defect Photo Viewer | 4-angle exterior walkaround photo gallery loaded directly from Cloudflare R2 CDN URLs with SHA-256 integrity tags. | M1, M2 | ORIGINAL_REQUEST §R1 |
| 6 | Critical Defect Automatic Lockout | Automatically lock asset to `UnderMaintenance` and create dispatch-blocking work order upon critical DVIR defect submission. | M1, M2 | ORIGINAL_REQUEST §R1, Acceptance Criteria |
| 7 | Managerial Safety Lockout Override | Allow authorized operations managers to clear lockout with audited justification and work order sign-off. | M1, M2 | ORIGINAL_REQUEST §R1 |
| 8 | Production Fuel Request Integration | Connect web fuel requests directly to `App\Modules\Fuel` backend, replacing mock reducers with live Eloquent models. | M1, M3 | ORIGINAL_REQUEST §R2 |
| 9 | Comprehensive Refueling Log & Meters | Support logging dispensed liters, odometer km, engine hours, price/L, total PHP cost, vendor, and receipt photo uploads. | M1, M3 | ORIGINAL_REQUEST §R2 |
| 10 | Monotonic Meter Validation | Enforce that logged odometer km and engine hours cannot be less than current asset meter readings. | M1, M3 | ORIGINAL_REQUEST §R2, Spec Miner |
| 11 | Fuel Consumption Variance & Anomaly Detection | Automatic anomaly flagging when volume variance >= 15% or burn rate exceeds equipment baseline by >= 15%. | M1, M3 | ORIGINAL_REQUEST §R2 |
| 12 | Fuel Request Approval & Segregation | Role-gated 5-stage transition state machine (`Submitted` → `Forwarded` → `Approved`/`Rejected` → `Verified` → `Logged`) with self-approval prevention. | M1, M3 | ORIGINAL_REQUEST §R2 |
| 13 | Rich Job Reports Display | Comprehensive web inspector for job reports: start/end timestamps, ending meters (engine hours/odometer), work summary. | M1, M4 | ORIGINAL_REQUEST §R3 |
| 14 | Standby & Demurrage Delay Breakdown | Display delay logs categorized by `StandbyReason` and highlight billable demurrage hours for client invoicing. | M1, M4 | ORIGINAL_REQUEST §R3 |
| 15 | Client Digital Sign-Off & Verification | Display client name, role, timestamp, signature image, and geolocation verification distance from site. | M1, M4 | ORIGINAL_REQUEST §R3 |
| 16 | Supervisory Review & Job Auto-Completion | Approval/rejection workflow for managers; approving a report automatically transitions parent `DispatchJob` to `completed`. | M1, M4 | ORIGINAL_REQUEST §R3 |
| 17 | Cross-Referencing Operational Records | Direct cross-reference navigation linking Job Reports to associated DVIR inspection sheets and fuel tickets. | M1, M4 | ORIGINAL_REQUEST §R3 |
| 18 | Prototype Sandbox Debt Elimination | Eliminate `PrototypeSandboxBanner`, `operations-reducer.ts`, and in-memory mock states from `operations.tsx` and `resource-surfaces.tsx`. | M5 | ORIGINAL_REQUEST §R4 |
| 19 | SOLID UI Modularization | Decompose 4,816-line monolith `live-workspace-sections.tsx` into modular domain directories (`fleet/`, `fuel/`, `reports/`). | M2, M3, M4, M5 | ORIGINAL_REQUEST §R4, AGENTS.md |
| 20 | Real-Time / Polling Reactivity | Ensure web dashboards update seamlessly when field operators clock in, submit DVIRs, or log fuel. | M5 | ORIGINAL_REQUEST §R4 |
| 21 | Full Verification & Quality Gates | Pass all backend tests (`Hos`, `Dvir`, `Fuel`, `JobReport`), PHPStan (`composer types:check`), TypeScript (`npm run types:check`), ESLint (`npm run lint:check`), and production build (`npm run build`). | M6 | ORIGINAL_REQUEST Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend Schema, Relationships, Safety Lockout & ViewModel Prop Bridges | `OperationalAsset` relations, `CreateDvirInspectionAction` critical lockout, `OperationsWorkspaceViewModel` enrichment (HoS, DVIR, Fuel, Job Reports), fuel shift linking | none | PLANNED |
| M2 | Web Fleet Management Parity (`fleet/` UI & HoS/DVIR Integration) | Decompose `AssetsSurface` into `components/workspace/fleet/`, live operator binding, HoS chips, DOLE warnings, DVIR badges, photo carousel, lockout alert & override | M1 | PLANNED |
| M3 | Web Fuel Requests & Refueling Logs Parity (`fuel/` UI) | Decompose `FuelSurface` into `components/workspace/fuel/`, live CRUD, 5-stage workflow, monotonic meters, receipt upload, variance & anomaly alerts | M1 | PLANNED |
| M4 | Web Job Reports & Field Handover Review Parity (`reports/` UI) | Decompose `ReportsSurface` into `components/workspace/reports/`, meters, delay/demurrage table, client digital sign-offs, supervisory review, cross-references | M1 | PLANNED |
| M5 | Architecture Consistency, Prototype Debt Elimination & Clean-up | Purge unrouted simulation wrappers (`operations.tsx`, `operations-reducer.ts`, fixtures, `PrototypeSandboxBanner`), wire live props, ensure Echo/polling updates | M2, M3, M4 | PLANNED |
| M6 | E2E Testing, Quality Gates & Parity Verification | Comprehensive verification: `Hos`, `Dvir`, `Fuel`, `JobReport` Pest tests, PHPStan level 8, TypeScript compilation, ESLint, and Vite build | M1, M2, M3, M4, M5 | PLANNED |

## Interface Contracts
### Asset ViewModel Contract (`AssetViewModel`)
```typescript
export interface AssetViewModel {
    id: number;
    code: string;
    name: string;
    kind: string;
    subtype: string | null;
    status: StatusViewModel<AssetStatusValue>;
    is_dispatchable: boolean;
    blocking_work_orders_count: number;
    active_operator?: {
        id: number;
        name: string;
        shift_started_at: string | null;
        hours_elapsed: number;
        telemetry_status: 'fresh' | 'delayed' | 'stale' | 'offline';
    } | null;
    hos?: {
        duty_status: 'operating' | 'driving' | 'standby' | 'on_break' | 'off_duty';
        duty_status_label: string;
        hours_elapsed: number;
        fatigue_status: 'normal' | 'warning' | 'critical' | 'violation';
        dole_warning: boolean;
    } | null;
    latest_dvir?: {
        id: number;
        type: 'pre_trip' | 'post_trip';
        status: 'passed' | 'defect_flagged' | 'critical_defect' | 'pending_inspection';
        has_defects: boolean;
        critical_defects_count: number;
        completed_at: string | null;
        photos: Array<{ id: number; angle: string; url: string; file_name: string }>;
    } | null;
    lockout?: {
        is_locked_out: boolean;
        lockout_reason: string | null;
        critical_defects_count: number;
        can_override: boolean;
    } | null;
}
```

### Job Report ViewModel Contract (`JobReportViewModel`)
```typescript
export interface JobReportViewModel {
    id: number;
    dispatch_job_id: number;
    job: { id: number; reference: string; title: string } | null;
    author: { id: number; name: string } | null;
    status: StatusViewModel<'draft' | 'submitted' | 'approved' | 'rejected'>;
    work_summary: string;
    remarks: string | null;
    rejection_reason?: string | null;
    ending_meter_value?: number | null;
    meter_type?: string | null;
    started_at: string | null;
    ended_at: string | null;
    submitted_at: string | null;
    signer_name: string | null;
    signer_role: string | null;
    signed_at: string | null;
    latitude?: number | null;
    longitude?: number | null;
    delay_logs?: Array<{
        id: number;
        duty_status: string;
        standby_reason: string;
        is_demurrage_billable: boolean;
        started_at: string;
        ended_at: string | null;
        duration_minutes: number | null;
    }>;
    attachments: AttachmentViewModel[];
    cross_references?: {
        associated_dvirs?: Array<{ id: number; reference: string; has_defects: boolean }>;
        associated_fuel_requests?: Array<{ id: number; reference: string; quantity_litres: string }>;
    };
}
```

## Code Layout
- `apps/operations/app/Shared/Assets/Models/OperationalAsset.php`: Relationships `dvirInspections()`, `latestDvirInspection()`, `activeOperatorShift()`.
- `apps/operations/app/Modules/Dvir/Actions/CreateDvirInspectionAction.php`: Safety lockout logic on critical defects.
- `apps/operations/app/Platform/Workspace/ViewModels/OperationsWorkspaceViewModel.php`: Asset HoS/DVIR serialization and JobReport signature/delay serialization.
- `apps/operations/app/Modules/Fuel/ViewModels/FuelWorkspaceViewModel.php`: Download URL resolution for receipt photos.
- `apps/operations/resources/js/components/workspace/fleet/`: Modular Fleet management UI.
- `apps/operations/resources/js/components/workspace/fuel/`: Modular Fuel management UI.
- `apps/operations/resources/js/components/workspace/reports/`: Modular Job Reports UI.
- `apps/operations/resources/js/components/workspace/live-workspace-sections.tsx`: Refactored thin switchboard.
- `apps/operations/tests/Feature/Operations/`: Feature and integration tests verifying HoS, DVIR, Fuel, and JobReport parity.
