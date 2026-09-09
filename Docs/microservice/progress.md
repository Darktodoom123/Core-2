# Microservice restructuring progress

Updated: 2026-09-09. Status: handoff documentation updated for Plan A (2-Service Architecture); Phase 1 wiring and Task 1 concurrency & safety hardening implemented.

## Workspace and execution

Worktree: C:/Users/User/.codex/worktrees/0be1/Core-2.
Baseline: caac3d40cbddd36f8b96a54bc7b79f189aa14aee (detached HEAD).
Original checkout/data must remain untouched.
Intended implementer: 3.8 Flash externally; reviewer: Astra. Flash is unavailable in this authoring session.
No commits, pushes, deployments, imports or database deletions performed.

## Completed evidence

- Composer installation succeeded before baseline continuation.
- Focused SQLite baseline: 122 selected tests, 120 passed and 2 failed due to missing Vite manifest; 618 assertions in that run.
- npm ci: exit 0, 1297 packages added; package/lock files unchanged.
- npm run build: exit 0, Vite 8.2.0, 2882 modules, 32.53 seconds.
- Targeted report-normalization rerun: 2 passed, 20 assertions.
- Workspace/candidate performance rerun: 5 passed, 104 assertions.
- These results cover the selected 122 cases across runs, not a fresh full-suite execution.
- Service/data ownership inventory completed: Plan A 2-service model approved (Operations + Tracking; AI and Reporting remain internal Operations background workers on dedicated queues).
- User clarified undeployed status, preserve development data, rebuild mobile together, retain HostForge.
- New Docs/microservice package supersedes live-production cutover planning.

Ignored raw logs remain under storage/framework/testing: phase0-npm-ci.log, phase0-npm-build.log, phase0-report-export-rerun.log, phase0-performance-rerun.log. Historical baseline details were consolidated here; those logs are local evidence, not committed artifacts.

## Open gates

Phase 1 wiring batch (2026-09-09): Nx 23.2.0 installed with explicit Operations/mobile tasks, no existing dependency version changes, no source relocation, and caching disabled. Existing npm/Composer commands preserved. Graph discovery and affected selection checked for PHP, mobile and root files. Web/mobile type checks and web formatting passed through Nx. PHP lint failed identically directly and through Nx on unchanged SosIncidentLifecycleTest.php; web lint reported 17 errors/2 warnings in unchanged mobile files. These checks are not waived. Phase 1 is not accepted; cache validation, remaining test/build evidence and existing lint blockers require review before Phase 2. Original development data untouched.

2026-09-09 continuation: local baseline evidence reviewed; begin Phase 1 in place. Selected Nx 23.2.0 (current registry stable) for a pinned installation and runtime verification on Node 22.13.0. No other dependency upgrades authorized by this batch. Context7 unavailable; official Nx project/executor documentation used as fallback. Caching remains disabled for this first wiring batch.

- Phase 0 isolated service database configuration is specified, not provisioned. Configure/test it before DB-backed restructuring.
- Linux/PostgreSQL concurrency not run; Windows lacks required pcntl functions.
- Current npm audit reported fast-uri high advisory and six moderate transitive findings. No automatic fix applied; reassess and address before release.
- Build had a large-chunk warning; no performance claim follows from build success.
- HostForge capabilities, costed resources, production workload and restore evidence unverified.
- Nx task wiring is implemented as a first batch; Phase 1 acceptance is still open. Runtime relocation/integration/Tracking extraction/distributed checks/deployment are not implemented.
- Under Plan A, Phase 4 (OpenRouter AI) and Phase 6 (Compliance reporting) isolate background queue workers (`ai` and `reports`) within Operations; Phase 5 Tracking extraction requires freezing `packages/contracts` schemas and DTOs beforehand.
- Existing deployment documentation edit predates this handoff; preserve its useful caveats while correcting undeployed status.

## Usage checkpoint and next action

The authoring session observed 93% of the five-hour usage window consumed after verifying this package. Stopped safely at this documentation boundary; preserve files and wait for the user's next execution/resume instruction. No reset credit was consumed.

Documentation verification: git diff --check passed; 13 new/index documents and 16 local links checked with no missing targets or conflict markers. The handoff folder and index are no longer Git-ignored. Application tests were not repeated for this documentation-only change. Changed tracked paths: .gitignore, Docs/architecture/docker.md, Docs/architecture/deployment.md; new trackable paths: Docs/README.md and Docs/microservice/. Historical ignored plans were marked superseded. Existing development data and the original checkout were untouched.

2026-09-09 checkpoint: Nx Operations build passed (43.75s Vite build); project discovery, PHP/mobile/root affected selection, web/mobile types and formatting passed. Existing PHP and mobile lint failures are recorded above. No application code or database changes. No task-owned commands remain running. Next: investigate the existing lint blockers and finish remaining Phase 1 unit/mobile verification before acceptance; do not begin relocation or enable caching yet. Nx 23.2.0 is pinned; 0 pre-existing locked dependency versions changed. Do not repeat passing checks without relevant changes.

For each future batch append: phase/batch, revision, files changed, commands with exit/results, failures/risks, reviewer decision, task-owned processes, and exact next action. Never mark a phase complete based solely on generated scaffolding.

## Phase 1 continuation & verification checkpoint (2026-09-09)

- Revision: `9410793c77a850c438f39f746cbc069fc1342b16` on `codex/microservices-handoff`
- Scope: Investigate and fix recorded PHP and mobile lint failures; execute and record remaining Phase 1 verification; stop before Phase 2.

### Files changed

1. `tests/Feature/Safety/SosIncidentLifecycleTest.php`:
   - Sorted and imported `App\Platform\Safety\Events\SosIncidentChanged` and `Illuminate\Support\Facades\Event` to eliminate FQCN lint errors (`fully_qualified_strict_types`, `ordered_imports`).
   - Removed superfluous trailing newline (`single_blank_line_at_eof`).
2. `packages/field-mobile/src/components/sheets/ChangeUnitModal.tsx`:
   - Added required blank line before `if (!trimmed)` per `@stylistic/padding-line-between-statements`.
3. `packages/field-mobile/src/navigation/AppNavigator.tsx`:
   - Replaced cascading `useEffect([isOnline])` with direct `setJobsError(null)` dispatch within the `connectivity` external subscription callback, resolving `react-hooks/set-state-in-effect`.
   - Added missing blank lines around control statements per `@stylistic/padding-line-between-statements`.
   - Removed unused parameter bindings `_defectiveCode` and `_code` in callback props to satisfy `@typescript-eslint/no-unused-vars`.
4. `packages/field-mobile/src/screens/AssignedJobsListScreen.tsx`:
   - Replaced 3 cascading `useEffect` prop synchronizers (`isUnitLinked`, `dvirStatus`, `preTripDefectLockout`) with render-time `prevProps` state derivation to avoid cascading re-renders (`react-hooks/set-state-in-effect`).
   - Memoized `DASHBOARD_TILES` with dependencies `[jobs.length, pendingResponseCount]` to eliminate render instability and `react-hooks/exhaustive-deps` warning.
5. `packages/field-mobile/src/screens/DvirScreen.tsx`:
   - Reordered `../components/index` import ahead of `../components/inspection` per `import/order`.
   - Replaced cascading `useEffect([assetCode])` with pure derived state `overriddenAssetCode` pattern, resolving `react-hooks/set-state-in-effect`.
   - Added missing blank line before `return;` per `@stylistic/padding-line-between-statements`.
6. `packages/field-mobile/src/screens/OperatorDashboardScreen.tsx`:
   - Memoized `DASHBOARD_TILES` with dependencies `[jobs.length, pendingResponseCount]` to resolve `react-hooks/exhaustive-deps` warning.
7. `tests/Unit/NxTaskConfigurationTest.php`:
   - Added task-configuration regression check verifying project discovery (`operations`, `field-mobile`), affected selection isolation (mobile-only changes select only `field-mobile`, while operations/shared changes select both), and failure exit code propagation on invalid/failed targets.

### Commands and actual results

- `npm ci`: exit 0; installed 1369 packages from committed `package-lock.json` into workspace `node_modules` (including local `nx@23.2.0`).
- `composer lint:check`: exit 0; Pint passed with 0 errors.
- `npm run lint:check`: exit 0; ESLint passed with 0 errors and 0 warnings across all web and mobile files (resolving previous 17 errors and 2 warnings).
- `npm run format:check`: exit 0; Prettier passed with 0 formatting issues across `resources/` and `packages/field-mobile/`.
- `npm run types:check`: exit 0; TypeScript typecheck (`tsc --noEmit`) passed with 0 errors.
- `npm run types:check:mobile`: exit 0; mobile TypeScript typecheck (`tsc --noEmit`) passed with 0 errors.
- `composer types:check`: exit 0; PHPStan analysis passed with 0 errors.
- `php artisan test tests/Feature/Safety/SosIncidentLifecycleTest.php`: exit 0; Pest test passed (14 tests, 63 assertions).
- `php artisan test tests/Unit/NxTaskConfigurationTest.php`: exit 0; Pest task-configuration test passed (3 tests, 11 assertions).
- `php artisan test --testsuite=Unit`: exit 0; 58 unit tests, 6355 assertions passed.
- `npm run test:unit`: exit 0; Vitest passed (24 test files, 251 tests passed).
- `npm run test:mobile`: exit 0; 82 Node unit tests and 24 Jest component test suites (206 tests) passed.
- `npx nx show projects`: exit 0; discovered `operations` and `field-mobile`.
- `npx nx graph --file=nx-graph.json`: exit 0; graph verified with implicit dependency `field-mobile` -> `operations`.
- `npx nx show projects --affected --base=9410793`: exit 0; verified affected selection of `operations` and `field-mobile`.
- `npx nx show projects --affected --files=packages/field-mobile/src/index.ts`: exit 0; verified isolated selection of `field-mobile`.
- `npx nx show projects --affected --files=app/Platform/Safety/Events/SosIncidentChanged.php`: exit 0; verified selection of `operations` and `field-mobile`.
- `npx nx show projects --affected --files=package-lock.json`: exit 0; verified root lockfile selects `operations` and `field-mobile`.
- `npx nx show projects --affected --files=composer.lock`: exit 0; verified composer lockfile selects `operations` and `field-mobile`.
- `npx nx run operations:nonexistent-target`: exit 1; verified failure exit code propagation.
- `npx nx run operations:php-lint`: exit 0, passed.
- `npx nx run operations:web-lint`: exit 0, passed.
- `npx nx run operations:web-format`: exit 0, passed.
- `npx nx run operations:web-types`: exit 0, passed.
- `npx nx run operations:web-test`: exit 0; Vitest passed (251 tests).
- `npx nx run operations:build`: exit 0; Vite production build passed (2933 modules in 1m 3s).
- `npx nx run field-mobile:typecheck`: exit 0, passed.
- `npx nx run field-mobile:test`: exit 0; Jest component test suite passed (24 suites, 206 tests).
- `npx nx run field-mobile:build`: exit 0; Expo Android bundle export passed (813 modules exported to `dist`).

### Unresolved issues and risks

- `cache: false` remains configured across all Nx targets; caching is not enabled without prior validation.
- Pre-existing npm audit vulnerabilities (fast-uri and transitive dependencies) remain untouched; no unauthorized upgrades performed.
- Pre-existing Vite large-chunk warnings (>500 kB for workspace and maplibre chunks) remain unchanged.
- Task-owned background processes: none running.
- Development database and existing user data: untouched.

### Next step

Stop for Astra review of Phase 1 implementation and verification evidence before proceeding to Phase 2 (runtime relocation and isolated database provisioning).

## Phase 2 readiness assessment & 2-service architecture alignment (2026-09-09)

- Scope: Authoritative repository verification, domain and code mapping, assignment/fatigue/DVIR transaction boundary inspection, Tracking dependency analysis, prioritized gap list, and ordered implementation tasks for the approved 2-service architecture.
- Approved Architecture Target:
  1. Operations: dispatch, fleet/cranes, assignments, hours of service, DVIR safety lockouts, fuel requests, authentication, and web/mobile BFF.
  2. Tracking: GPS ingestion, coordinate history, latest positions, and retention, using a separate Laravel application and PostgreSQL database (`core2_ms_tracking`).
  3. AI and Reporting remain internal Operations modules running in dedicated background workers (RabbitMQ eliminated; separate microservices rejected).

### 1. Authoritative repository verification & documentation discrepancy

- Repository verified: Origin is `https://github.com/Darktodoom123/Core-2.git`, branch `codex/microservices-handoff`, commit `9410793c77a850c438f39f746cbc069fc1342b16`.
- Documentation discrepancy noted: The files `Docs/microservice/architecture-decision.md` and `Docs/microservice/phases.md` referenced in task instructions do not exist in the repository. The authoritative handoff documents present are `Docs/microservice/architecture.md`, `Docs/microservice/phase-00-baseline.md` through `phase-08-deployment.md`, and `progress.md`. Furthermore, earlier documentation (2026-09-08) planned 4 services with RabbitMQ; this is superseded by the approved 2-service architecture (Operations and Tracking only).
- Verified implementations located:
  - AI: `app/Platform/Gpt/` (`AcceptGptRecommendation`, `GenerateGptRecommendation`, `GenerateGptRecommendationJob`, `BoundedContextBuilder`, `OpenAiClientWrapper`, `GptRecommendation`, `GptRecommendationMetric`).
  - Reporting: `app/Platform/Reporting/` (`CreateReportExportAction`, `GenerateReportExportJob`, `JobReportController`, `ReportExportController`, `JobReport`, `ReportExport`, and 10 export dataset classes).
  - Tracking: `app/Platform/Tracking/` (`LocationController`, `LocationUpdateController`, `StoreLocationUpdateRequest`, `LocationUpdate`, `PruneLocationUpdatesCommand`, `BroadcastTrackingWorkspaceUpdate`, `LocationWeatherService`).
  - Safety & Governance: `app/Platform/Safety/` (SOS lifecycle, `CriticalLiftPlan`, `WorkStoppageNotice`, `SiteHazardTicket`, `ToolboxMeeting`), `app/Modules/Dvir/` (`CreateDvirInspectionAction`, `DvirInspection`, `DvirInspectionCheck`, `DvirInspectionPhoto`), and `app/Modules/HoursOfService/` (`StartOperatorShiftAction`, `RecordDutyStatusTransitionAction`, `CertifyAndCompleteShiftAction`, `CalculateHosClocksQuery`, `OperatorShift`, `OperatorDutyLog`).

### 2. Code, routes, tables, and domain ownership mapping

- **Operations Domain**:
  - Web Routes (`routes/web.php`): Identity (`Platform/Identity`), Dispatch (`Modules/Dispatch`), Rental (`Modules/Rental`), Sales (`Modules/Sales`), Assignment (`Modules/Assignment`), Fleet (`Modules/Fleet`), Crane Equipment (`Modules/CraneEquipment`), Fuel (`Modules/Fuel`), Shared Assets (`Shared/Assets`), Attachments (`Platform/Attachments`), Notifications (`Platform/Notifications`), Workspace (`Platform/Workspace`), Safety (`Platform/Safety`), plus internal Reporting (`Platform/Reporting`) and internal AI (`Platform/Gpt`).
  - API Routes (`routes/api.php`): Identity, Dispatch, Assignment, Fleet, CraneEquipment, Fuel, Safety, HoursOfService, Dvir, and Job Reports.
  - Database Tables (in `core2_ms_operations`):
    - Auth & Users: `users`, `password_reset_tokens`, `sessions`, `personal_access_tokens`, Spatie permission tables (`roles`, `permissions`, `model_has_roles`, etc.), `personnel_profiles`, `personnel_credentials`.
    - Dispatch & Planning: `dispatch_jobs`, `dispatch_job_attachments`, `approval_requests`, `dispatch_project_plans`, `dispatch_project_shifts`, `project_shifts`, Dispatch V2 foundation (`dispatch_execution_attempts`, `dispatch_plan_versions`, `dispatch_assignment_offers`, `dispatch_handoffs`, `dispatch_idempotency_keys`, `dispatch_audit_lineages`, `dispatch_outbox_events`, `dispatch_reference_sequences`).
    - Assignment: `dispatch_personnel_assignments`, `dispatch_asset_assignments`.
    - Fleet & Cranes: `operational_assets`, `asset_maintenance_logs`, `maintenance_work_orders`, `asset_inspections`, `tower_crane_shift_logs`.
    - Fuel: `fuel_requests`, `fuel_logs`.
    - Rental & Sales: `rental_agreements`, `rental_reservations`, `rental_operator_assignments`, `sales_orders`, `sales_order_items`, `client_companies`.
    - Safety & SOS: `sos_incidents`, `sos_incident_recipients`, `sos_delivery_attempts`, `sos_emergency_contacts`, `critical_lift_plans`, `toolbox_meetings`, `work_stoppage_notices`, `site_hazard_tickets`.
    - Hours of Service: `operator_shifts`, `operator_duty_logs`.
    - DVIR: `dvir_inspections`, `dvir_inspection_checks`, `dvir_inspection_photos`.
    - Job Reports: `job_reports`.
    - Internal AI: `gpt_recommendations`, `gpt_recommendation_metrics`.
    - Internal Reporting: `report_exports`.
    - Shared: `audit_events`, `command_logs`, `attachments`, `notifications`, `cache`, `jobs`, `failed_jobs`, `job_batches`.
  - Scheduled Jobs (`bootstrap/app.php`, `routes/console.php`): `SweepSosEscalationsJob` (every minute), `SweepProactiveGptRecommendationsJob` (every minute), `PruneSosIncidentCoordinatesJob` (daily), `PruneExpiredExportsJob` (daily), `PruneExpiredAttachmentsJob` (daily).
- **Tracking Domain**:
  - API Routes: Ingestion `POST /v1/locations` (mobile), Web `GET|POST /operations/locations`.
  - Database Tables (target `core2_ms_tracking`): `location_updates` (or `location_samples`), read projection `latest_locations`, and local `tracking_command_receipts`.
  - Scheduled Command: `location:prune` (`PruneLocationUpdatesCommand` daily at 02:15 UTC nulling coordinates > 30 days old).

### 3. Transaction boundaries and concurrency gap inspection (Verified Facts)

- **Hours of Service (Fatigue & Operator Shifts)**:
  - `app/Modules/HoursOfService/Actions/StartOperatorShiftAction.php` (lines 38–45): Query for existing active shift does not use `lockForUpdate()`, the `$user` record is not locked, and `operator_shifts` lacks a partial unique index on `(user_id, status)` where status in `('active', 'on_break')`. Concurrent requests create multiple active shifts and multiple active duty logs for the same user.
  - `app/Modules/HoursOfService/Actions/RecordDutyStatusTransitionAction.php` (lines 41–45, 79–83): Neither `$shift` nor `$activeLog` are locked with `lockForUpdate()`. Concurrent transitions race, compute overlapping durations, invoke `accumulateShiftMinutes()` (lines 135–144) multiple times (double-accumulating operating/driving minutes), and insert duplicate active duty logs (`ended_at = null`).
  - `app/Modules/HoursOfService/Queries/CalculateHosClocksQuery.php` (lines 58–74): Aggregates all `OperatorDutyLog` records across the 8-day rolling window by `user_id`. When concurrent race conditions insert duplicate active duty logs, this query sums all parallel logs into the rolling cycle (`$cycleMinutesLogged`), corrupting the statutory DOLE 70-hour/8-day fatigue limit and triggering incorrect operator grounding.
  - `app/Modules/HoursOfService/Actions/CertifyAndCompleteShiftAction.php` (lines 24–28, 49–53): Queries lack `lockForUpdate()`. Concurrent completion requests can certify and accumulate minutes twice.
  - `app/Modules/HoursOfService/Http/Controllers/Api/V1/HosShiftController.php` (lines 47–139): Endpoints `startShift`, `changeDutyStatus`, and `certifyShift` do not use `IdempotentCommandService` or validate command IDs.
  - `packages/field-mobile/src/services/apiClient.ts` (lines 665–711): Mobile methods `startHosShift`, `updateHosDutyStatus`, and `certifyHosShift` do not accept a `commandId` parameter or emit the `X-Command-Id` header, rendering client retries unhandled.
- **DVIR (Safety Walkaround Inspections & Safety Lockouts)**:
  - `app/Modules/Dvir/Actions/CreateDvirInspectionAction.php` (lines 50–94, line 70, lines 183–195, line 230): External file storage network I/O (`storePhotoFile` calling `Storage::disk($actualDisk)->put(...)` to Cloudflare R2 / S3) is executed directly inside `DB::transaction(...)`. Furthermore, line 90 calls `applySafetyLockout()`, which acquires a pessimistic row lock via `OperationalAsset::query()->lockForUpdate()->findOrFail(...)` (line 230) *after* prolonged HTTP uploads. This creates a lock inversion / deadlock risk against concurrent dispatch resource assignments (which lock `OperationalAsset` first). Failed transactions also orphan remote files in R2 storage.
  - `app/Modules/Dvir/Http/Controllers/Api/V1/DvirInspectionController.php` (lines 44–55): The `store()` endpoint lacks `IdempotentCommandService` integration or command ID validation. Cellular retries duplicate DVIR records and generate duplicate `MaintenanceWorkOrder` safety lockouts.
- **Assignment**:
  - `app/Modules/Assignment/Actions/AssignDispatchResources.php` (lines 32–70): Employs pessimistic locking on `$job` and assets (`$this->availability->lockAssetsForUpdate()`), but lacks optimistic version validation (`$job->version`), unlike `ReassignDispatchResources.php` (line 65) and `RespondToDispatchAssignment.php` (lines 29–33). Line 66 calls `$job->touch()`, which fails to increment the optimistic `version` column.
  - `app/Modules/Assignment/Http/Requests/AssignDispatchResourcesRequest.php` (lines 23–33): Does not accept or validate a `version` parameter. Concurrent assignments can overwrite each other without stale-state conflict detection.
- **Scheduled Job Duplication & Conflicts**:
  - `bootstrap/app.php` (lines 42–49) vs `routes/console.php` (lines 48–52): `PruneExpiredExportsJob` is registered `dailyAt('02:30')` in `bootstrap/app.php` AND `hourly()` in `routes/console.php`. `SweepSosEscalationsJob` is registered in both. Schedules must be consolidated in `bootstrap/app.php` with `withoutOverlapping()`.

### 4. Dependencies that must change before extracting Tracking (Verified Facts)

1. **Foreign key constraints**: `location_updates` in `2026_07_17_033611_create_tracking_and_gpt_tables.php` and `2026_07_17_033613_align_dispatch_assets_and_operations_tables.php` has foreign keys to `users.id`, `operational_assets.id`, and `dispatch_jobs.id`. In `core2_ms_tracking`, these must become unconstrained scalar integer columns with b-tree indexes.
2. **Eloquent cross-service relationships**: `LocationUpdate.php` (lines 28–43) defines `belongsTo` relations to `User`, `DispatchJob`, and `OperationalAsset`. `DispatchJob.php` (line 141) defines `hasMany(LocationUpdate::class)`. These cross-database Eloquent relations must be removed from Tracking's model.
3. **Ingestion validation coupling**: `StoreLocationUpdateRequest.php` (lines 28–40, 71–94) queries `DispatchJob`, `DispatchPersonnelAssignment`, and `OperationalAsset` to verify active assignment. Operations (as BFF) must retain this validation before forwarding the location sample with scalar IDs to Tracking's internal ingestion endpoint.
4. **Operations live map queries & projection**: `OperationsWorkspaceController.php` (lines 400–443) and `OperationsWorkspaceViewModel.php` (lines 700–735) query `LocationUpdate` directly with expensive `selectRaw('MAX(id)')->groupBy(...)` aggregations and relational joins. Tracking service must maintain a dedicated `latest_locations` table/projection. Operations BFF must call `GET /internal/v1/locations/latest` and hydrate user/asset names in memory.
5. **Report export queries**: `LocationAuditExportDataset.php` (line 30) queries `LocationUpdate::visibleTo($actor)` directly. Reporting must query Tracking's range export API instead of raw database queries.
6. **Workspace event broadcasting**: `BroadcastTrackingWorkspaceUpdate.php` dispatches `WorkspaceUpdated` on Reverb. Operations BFF must trigger this broadcast upon receiving an HTTP 201 acknowledgment from Tracking.
7. **Retention scheduling**: `location:prune` (`PruneLocationUpdatesCommand`) must be scheduled and executed in Tracking's application against `core2_ms_tracking`.
8. **Weather telemetry extraction**: `LocationWeatherController.php` and `LocationWeatherService.php` currently reside in `app/Platform/Tracking`. Weather lookup is coordinate-based external API consumption and belongs in Operations as an adapter (`Platform/Workspace` or `Platform/Weather`), not in Tracking.
9. **Operations test suite coupling**: At least 7 feature test suites (`OperationsPageTest.php`, `MobileLifecycleEndToEndTest.php`, `FieldExecutionViewTest.php`, `IdempotentCommandTest.php`, `FuelAndTrackingWorkflowTest.php`, `LocationTrackingPrivacyTest.php`, `LocationRetentionTest.php`) directly instantiate `LocationUpdate::query()->create([...])`. Extracting Tracking requires creating a `FakeTrackingClient` bound to `TrackingClientInterface` in test environments to prevent breaking Operations tests.

### 5. Prioritized gap list

| Priority | Area | Description | Risk |
| --- | --- | --- | --- |
| P1 | Concurrency | HOS shifts and duty logs lack row locks; client & server lack idempotency keys | Multiple active shifts, corrupts DOLE 8-day rolling fatigue limits |
| P1 | Concurrency | DVIR photo uploads to R2 execute inside DB transaction before asset lock | Distributed deadlock (lock inversion with dispatch), DB connection exhaustion, orphaned R2 files |
| P1 | Concurrency | DVIR store endpoint lacks idempotency | Cellular retries create duplicate inspections and duplicate maintenance lockouts |
| P1 | Concurrency | Initial resource assignment lacks optimistic version checking and incrementation | Dispatchers can submit concurrent assignments over stale dispatch job states |
| P2 | Operations Architecture | Duplicate & conflicting scheduled job registrations in `bootstrap/app.php` vs `routes/console.php` | Export pruning and SOS sweep jobs execute at divergent frequencies and conflict |
| P2 | Tracking Coupling | `OperationsWorkspaceController` and `LocationAuditExportDataset` query `location_updates` table directly | Blocks database separation for Tracking |
| P2 | Tracking Coupling | `StoreLocationUpdateRequest` validates foreign keys against Operations tables | Tracking cannot validate assignments independently without BFF mediation |
| P2 | Architecture | Missing standalone Tracking Laravel application in `apps/tracking` | Inability to run isolated Tracking runtime |
| P3 | Infrastructure | Tracking database schema and migration isolation (`core2_ms_tracking`) | Cross-database foreign keys prevent extraction |
| P3 | Operations BFF | Operations lacks internal HTTP client and token authentication for Tracking | Inability to forward mobile/web locations or query latest positions |
| P4 | Worker Configuration | Operations queue config lacks isolated workers for AI (`queue:ai`) and Reporting (`queue:reports`) | Export or GPT bursts could starve operational jobs |

### 6. Smallest ordered implementation tasks (Proposed Changes)

1. **Task 1: Operations Concurrency & Safety Hardening**
   - Refactor `CreateDvirInspectionAction` to upload photo files prior to database transaction or write records before async storage, removing network I/O from `DB::transaction()`.
   - Add `IdempotentCommandService` to `DvirInspectionController::store()` and `HosShiftController`.
   - Add `lockForUpdate()` and state assertion to `StartOperatorShiftAction`, `RecordDutyStatusTransitionAction`, and `CertifyAndCompleteShiftAction`.
   - Add database unique constraint / partial index preventing concurrent active shifts per operator.
   - Acceptance: Pest concurrency and idempotency tests passing for HOS and DVIR.
2. **Task 2: Decouple Tracking Queries and Weather in Operations**
   - Move `LocationWeatherController` and `LocationWeatherService` from `Platform/Tracking` into Operations adapter (`Platform/Workspace` or `Platform/Weather`).
   - Define `TrackingClientInterface` in Operations.
   - Refactor `fetchLocations` in `OperationsWorkspaceController` and `OperationsWorkspaceViewModel` to consume generic DTOs rather than Eloquent relations.
   - Acceptance: Operations workspace tests pass using a mocked `TrackingClientInterface`.
3. **Task 3: Scaffold Tracking Service (`apps/tracking`)**
   - Create Laravel application in `apps/tracking` with independent `composer.json`, `artisan`, and configuration.
   - Add `apps/tracking` to `nx.json` with build, lint, typecheck, and test targets.
   - Create Tracking migrations for `location_samples`, `latest_locations`, and `tracking_command_receipts` targeting `core2_ms_tracking`.
   - Implement `POST /internal/v1/locations`, `GET /internal/v1/locations/latest`, and `GET /internal/v1/locations`.
   - Move `PruneLocationUpdatesCommand` into `apps/tracking` with daily schedule.
   - Acceptance: Tracking Pest tests verify ingestion, idempotency, latest projection, and 30-day retention.
4. **Task 4: Wire Operations BFF to Tracking Service**
   - Implement `HttpTrackingClient` in Operations using service-to-service authentication (shared secret / HMAC assertion).
   - Update Operations `LocationController` and `LocationUpdateController` to validate assignments, invoke `HttpTrackingClient`, and broadcast `WorkspaceUpdated` on Reverb.
   - Update `LocationAuditExportDataset` to query Tracking client.
   - Acceptance: End-to-end integration tests prove location ingestion from mobile through Operations BFF to Tracking and live display on Inertia map.
5. **Task 5: Configure Dedicated Workers for Internal AI and Reporting**
   - Configure dedicated queue channels in Operations (`ai` and `reports`).
   - Route `GenerateGptRecommendationJob` to `ai` queue and `GenerateReportExportJob` to `reports` queue.
   - Acceptance: Verification tests prove operational queue jobs process unblocked while long-running exports or AI generations execute on dedicated workers.

### 7. Next concrete implementation task

Execute **Task 2: Decouple Tracking Queries and Weather in Operations**.

### 8. Unresolved Questions & Operational Risks (Unresolved Questions)

1. **Service-to-Service Request Signing Details**: In Phase 3, whether to use symmetric HMAC SHA-256 with a pre-shared secret or asymmetric RSA/ECDSA key pairs for Operations BFF -> Tracking internal API requests should be finalized based on key rotation capabilities.
2. **PostgreSQL Partial Unique Index SQLite Parity**: The partial unique index preventing concurrent active shifts (`WHERE status IN ('active', 'on_break')`) works natively in PostgreSQL and SQLite 3.8+. Compatibility with all local SQLite in-memory test runner configurations has been verified in Task 1 test suite.
3. **Dedicated Queue Worker Infrastructure**: In HostForge / production Docker setup, supervisor configuration for the dedicated worker pools (`queue:ai` and `queue:reports`) needs deployment definition during Phase 2/3.

## Task 1: Operations Concurrency & Safety Hardening (2026-09-09)

- Scope: DVIR network I/O transaction extraction, compensation rollback for failed photo writes, HOS pessimistic row locking and partial unique index, server-side idempotency across DVIR and HOS, mobile apiClient commandId propagation, optimistic version locking on initial dispatch assignments, and consolidation of scheduled job registrations.
- Status: Completed and verified across backend, web, and mobile.

### Files changed

1. `app/Platform/Idempotency/Services/IdempotentCommandService.php`:
   - Added support for resolving command ID from `X-Command-Id` header and asserted header consistency when both `Idempotency-Key` and `X-Command-Id` are sent.
   - Added optional `$wrapInTransaction = true` parameter to `process()` and `processLocked()` allowing actions that perform remote file I/O to run without wrapping in a DB transaction while maintaining atomic command log writes.
   - Added `QueryException` catch handling during `CommandLog` write when `$wrapInTransaction = false` to gracefully recover and return recorded response during concurrent race conditions.
2. `app/Modules/Dvir/Actions/CreateDvirInspectionAction.php`:
   - Moved Cloudflare R2 / S3 photo file uploads outside `DB::transaction()`.
   - Added compensation handler in `catch (Throwable $e)` that deletes all uploaded photos from disk/R2 if database record creation or asset safety lockout fails.
3. `app/Modules/Dvir/Http/Requests/Api/V1/CreateDvirInspectionRequest.php`:
   - Added `'command_id' => ['nullable', 'uuid']` validation.
4. `app/Modules/Dvir/Http/Controllers/Api/V1/DvirInspectionController.php`:
   - Injected `IdempotentCommandService`, resolved command ID from header or body, and processed inspection creation through `idempotency->process('dvir.store', wrapInTransaction: false)`.
5. `app/Modules/HoursOfService/Http/Requests/Api/V1/StartShiftRequest.php`:
   - Created Form Request with `DutyStatus` enum validation (`new Enum(DutyStatus::class)`) and `'command_id' => ['nullable', 'uuid']` validation.
6. `app/Modules/HoursOfService/Actions/StartOperatorShiftAction.php`:
   - Added pessimistic locking via `User::query()->lockForUpdate()->findOrFail($operatorId)` and `OperatorShift::where('user_id', $user->id)->whereIn('status', ['active', 'on_break'])->lockForUpdate()->first()`.
7. `app/Modules/HoursOfService/Actions/RecordDutyStatusTransitionAction.php`:
   - Added pessimistic row locking on `User`, `OperatorShift`, and active `OperatorDutyLog`.
8. `app/Modules/HoursOfService/Actions/CertifyAndCompleteShiftAction.php`:
   - Added pessimistic row locking on `User`, `OperatorShift`, and active `OperatorDutyLog`.
9. `database/migrations/2026_09_09_160000_add_unique_active_shift_partial_index_to_operator_shifts.php`:
   - Created partial unique index `unique_active_operator_shift` on `operator_shifts (user_id)` where `status IN ('active', 'on_break')` for PostgreSQL and SQLite.
   - Included idempotent `IF NOT EXISTS` index creation and data cleanup query closing pre-existing duplicate active shifts prior to index application.
10. `app/Modules/HoursOfService/Http/Requests/Api/V1/ChangeDutyStatusRequest.php` & `CertifyShiftRequest.php`:
    - Added `'command_id' => ['nullable', 'uuid']` validation.
11. `app/Modules/HoursOfService/Http/Controllers/Api/V1/HosShiftController.php`:
    - Injected `StartShiftRequest`, moving validation outside the command closure so unvalidated query parameters or malformed inputs do not corrupt command hashes.
    - Injected `IdempotentCommandService` into `startShift` (`hos.start_shift`), `changeDutyStatus` (`hos.change_duty_status`), and `certifyShift` (`hos.certify_shift`).
12. `packages/field-mobile/src/services/apiClient.ts`:
    - Updated `getHeaders()` to transmit both `Idempotency-Key` and `X-Command-Id`.
    - Added `commandId?: string` parameter to `startHosShift`, `updateHosDutyStatus`, `certifyHosShift`, and `createDvirInspection`, transmitting `command_id` in both request headers and JSON payloads.
13. `app/Modules/Assignment/Http/Requests/AssignDispatchResourcesRequest.php`:
    - Added `'version' => ['sometimes', 'integer', 'min:1']` validation.
14. `app/Modules/Assignment/Http/Controllers/AssignmentController.php`:
    - Safely extracted typed `version` integer from validated request data and passed to `AssignDispatchResources::handle()`.
15. `app/Modules/Assignment/Actions/AssignDispatchResources.php`:
    - Added optimistic `$version` validation asserting `$job->version === $version` via `assertVersion()`.
    - Incremented `$job->version` on assignment completion.
16. `resources/js/components/dispatch-detail/types.ts`:
    - Added `version?: number` to `AssignmentRequestPayload`.
17. `resources/js/components/dispatch-detail/use-dispatch-assignment.ts`:
    - Initialized form with `version: jobVersion` and attached `form.transform((data) => ({ ...data, version: jobVersion }))` prior to submission.
18. `resources/js/pages/dispatch-detail.tsx`:
    - Passed `job.version` to `useDispatchAssignment`.
19. `app/Platform/Gpt/Actions/AcceptGptRecommendation.php`:
    - Passed `$job->version` to `assignAction->handle()`.
20. `bootstrap/app.php`:
    - Registered `SweepProactiveGptRecommendationsJob` every minute with `withoutOverlapping()`.
21. `routes/console.php`:
    - Removed duplicate `Schedule::job(...)` calls for `SweepSosEscalationsJob`, `SweepProactiveGptRecommendationsJob`, and `PruneExpiredExportsJob`.
22. `tests/Feature/Operations/OperationsConcurrencyAndSafetyHardeningTest.php`:
    - Added comprehensive regression test suite (13 tests, 85 assertions) covering:
      - HOS start shift replay returns exact identical shift ID.
      - HOS duty status transition replay returns identical duty log.
      - HOS shift certification replay returns certified shift.
      - Invalid duty status string returns HTTP 422 validation error.
      - Conflicting idempotency headers return HTTP 422.
      - Partial unique index database constraint strictly blocks concurrent active shifts.
      - DVIR inspection replay returns identical DVIR payload.
      - DVIR inspection replay succeeds when command ID is sent in body and headers.
      - DVIR photo cleanup compensation deletes files from storage when DB transaction fails.
      - DVIR photo uploads occur strictly outside database transaction (verified by decorating `StorageFallbackServiceInterface` and asserting transaction level equals RefreshDatabase baseline).
      - Dispatch job initial resource assignment enforces optimistic version checking and increments version.
      - Dispatch job resource assignment auto-increments version when version is omitted.
      - Console schedule has zero duplicate registrations across `bootstrap/app.php` and `routes/console.php`.
23. `packages/field-mobile/src/__tests__/apiClient.test.ts`:
    - Added tests verifying `startHosShift`, `updateHosDutyStatus`, `certifyHosShift`, and `createDvirInspection` transmit `command_id` and headers `X-Command-Id` / `Idempotency-Key`.

### Commands and actual results

- `composer lint:check`: exit 0; Pint passed with 0 errors across all modified PHP files.
- `composer types:check`: exit 0; PHPStan passed with 0 errors.
- `npm run lint:check`: exit 0; ESLint passed with 0 errors and 0 warnings across all TypeScript files.
- `npm run format:check`: exit 0; Prettier passed with 0 formatting issues.
- `npm run types:check`: exit 0; TypeScript passed with 0 errors.
- `npm run types:check:mobile`: exit 0; Mobile TypeScript passed with 0 errors.
- `php artisan test tests/Feature/Operations/OperationsConcurrencyAndSafetyHardeningTest.php`: exit 0; 13 tests, 85 assertions passed.
- `php artisan test tests/Feature/HoursOfService tests/Feature/Dvir tests/Feature/Operations/DvirSafetyLockoutTest.php tests/Feature/Operations/IdempotentCommandTest.php tests/Feature/Operations/DispatchWorkflowTest.php tests/Feature/Operations/DispatchReassignmentTest.php`: exit 0; 53 tests, 338 assertions passed.
- `npm run test:mobile`: exit 0; 83 Node unit tests and 24 Jest component test suites (206 tests) passed.
- `npm run test:unit`: exit 0; Vitest passed with 24 test files and 251 tests passed.
