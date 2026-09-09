# Microservice restructuring progress

Updated: 2026-09-09. Status: Plan A (2-Service Architecture) Tasks 1 through 5 fully implemented and verified; Full Quality Gate complete; Phase 7 Distributed Resilience & Failure-Injection Harness verified.

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

## Task 2: Decouple Tracking Queries, Weather, and Test Doubles in Operations (2026-09-09)

- Scope: Extract weather telemetry adapter to Operations domain (`Platform/Weather`), define `TrackingClientInterface` with contract DTOs (`LocationSampleDto`, `LatestLocationDto`), implement `DatabaseTrackingClient` and in-memory `FakeTrackingClient` bound dynamically via `TrackingServiceProvider`, decouple Operations live map and workspace queries from Eloquent cross-table joins with in-memory hydration, decouple report export datasets and dispatch view models, and decouple existing Operations test suites using the tracking client test double.
- Status: Completed and verified across backend, web, and mobile.

### Files changed

1. `app/Platform/Weather/Services/LocationWeatherService.php` & `app/Platform/Weather/Http/Controllers/Api/V1/LocationWeatherController.php`:
   - Moved weather service and controller out of `Platform/Tracking` into Operations weather adapter namespace `App\Platform\Weather`.
2. `app/Platform/Weather/Routes/api.php`:
   - Registered `/v1/telemetry/weather` route under `App\Platform\Weather\Http\Controllers\Api\V1\LocationWeatherController`.
3. `routes/api.php`:
   - Mounted `app/Platform/Weather/Routes/api.php`.
4. `app/Platform/Tracking/Routes/api.php`:
   - Removed `/telemetry/weather` from tracking route definitions.
5. `app/Platform/Tracking/Services/LocationWeatherService.php` & `app/Platform/Tracking/Http/Controllers/Api/V1/LocationWeatherController.php`:
   - Created backward-compatibility adapter classes extending the new `Platform/Weather` classes.
6. `app/Platform/Tracking/Data/LocationSampleDto.php` & `app/Platform/Tracking/Data/LatestLocationDto.php`:
   - Defined structured DTOs representing ingestible location samples and latest position projections, including typed JSON serialization, freshness status calculation, and conversion helpers from Eloquent models.
7. `app/Platform/Tracking/Contracts/TrackingClientInterface.php`:
   - Defined service contract exposing `ingestLocation`, `getLatestLocations(?User $user = null)`, `getLatestLocationForJob(int $jobId, ?User $user = null)`, `getLatestLocationForUser(int $userId)`, `getLatestLocationForAsset(int $assetId)`, `queryLocationHistory(array $filters = [])`, and `getTrackingFreshness(User $user, CarbonImmutable $refreshedAt, int $staleAfterSeconds = 120)`.
8. `app/Platform/Tracking/Services/DatabaseTrackingClient.php`:
   - Implemented database-backed client executing queries against local `location_updates` records with role-based scoping (`visibleTo`), subquery `MAX(id)` aggregations grouped by `user_id` and `operational_asset_id` (eliminating arbitrary `limit(500)` truncation), `received_at` descending ordering, date filtering (`from`/`date_from`, `to`/`date_to`), and DTO hydration without cross-table joins.
9. `app/Platform/Tracking/Testing/FakeTrackingClient.php`:
   - Implemented high-fidelity in-memory test double supporting location recording, multiple latest-position lookups, user-scoped job positions, history filtering (`from`/`date_from`, `to`/`date_to`), sort order selection, freshness summaries, test assertion helpers (`assertIngestedCount`, `assertIngested`, `assertNothingIngested`), and bidirectional synchronization with legacy `LocationUpdate` model instances.
10. `app/Platform/Tracking/Facades/TrackingClient.php`:
    - Created facade resolving `TrackingClientInterface` from container, with `fake()` helper swapping a fresh in-memory instance into the container.
11. `app/Platform/Tracking/TrackingServiceProvider.php`:
    - Bound `TrackingClientInterface` as a singleton resolving to `FakeTrackingClient` in testing environments and `DatabaseTrackingClient` in production/local environments.
12. `app/Platform/Tracking/Models/LocationUpdate.php`:
    - Added `saved` model lifecycle hook synchronizing created/updated Eloquent models into `FakeTrackingClient` when running in test environments, maintaining seamless test backward-compatibility.
13. `app/Platform/Workspace/Http/Controllers/OperationsWorkspaceController.php`:
    - Injected `TrackingClientInterface` into constructor.
    - Refactored `fetchLocations` to query `trackingClient->getLatestLocations($user)` and hydrate associated `User`, `OperationalAsset` (including `withTrashed`), and `DispatchJob` models in memory using keyed bulk lookups (`whereIn('id', ...)`), eliminating cross-table joins on `location_updates`.
    - Refactored `trackingFreshness` to query `trackingClient->getTrackingFreshness($user)`.
14. `app/Platform/Workspace/ViewModels/OperationsWorkspaceViewModel.php`:
    - Updated `locations()` to accept `Collection<int, LatestLocationDto>` and format live map coordinates and popup payloads directly from DTO properties.
15. `app/Modules/Dispatch/ViewModels/DispatchExecutionViewModel.php`:
    - Updated `latestLocation()` to query `trackingClient->getLatestLocationForJob($job->id, $user)` supporting multi-worker role scoping, and hydrate associated user and soft-deleted-safe asset models in memory.
16. `app/Platform/Reporting/Exports/LocationAuditExportDataset.php`:
    - Updated `rows()` to query `trackingClient->queryLocationHistory($queryFilters)` with date range filtering and ascending ID order, mapping DTO records directly into CSV export rows.
17. `tests/Feature/Api/V1/LocationWeatherTest.php`:
    - Updated test imports to reference `App\Platform\Weather\Services\LocationWeatherService`.
18. `tests/Feature/OperationsPageTest.php`:
    - Updated tracking fixtures to record locations through `TrackingClientInterface` with `LocationSampleDto`.
19. `tests/Feature/Operations/FieldExecutionViewTest.php`:
    - Updated tracking assertions to record locations through `TrackingClientInterface` with `LocationSampleDto`.
20. `tests/Feature/Operations/TrackingWorkspaceContractTest.php`:
    - Updated tracking assertions to record locations through `TrackingClientInterface` with `LocationSampleDto`.
21. `tests/Feature/MobileLifecycle/MobileLifecycleEndToEndTest.php`:
    - Added `flushHeaders()` before subsequent lifecycle phases to prevent persistent test client headers from reusing idempotency keys across disparate endpoints.
22. `tests/Feature/Operations/TrackingDecouplingTest.php`:
    - Added dedicated test suite (12 tests, 109 assertions) verifying:
      - Operations workspace live map queries consume `TrackingClientInterface` and hydrate user/asset/job relations in memory.
      - Workspace live map respects viewer permission scoping.
      - Workspace tracking freshness delegates to `TrackingClientInterface`.
      - Dispatch execution view model queries latest position via `TrackingClientInterface` with multi-worker visibility scoping.
      - Location audit export dataset queries location history via `TrackingClientInterface` preserving date filters and ascending ID order.
      - DatabaseTrackingClient persists samples to `location_updates`, executes subquery MAX aggregations without joins, enforces visibility, and filters history.
      - FakeTrackingClient records and queries latest positions in memory, respects visibility, and provides test assertion helpers (`assertIngestedCount`, `assertIngested`, `assertNothingIngested`).
      - Operations workspace ViewModel seamlessly formats both LatestLocationDto and legacy LocationUpdate model instances identically.

### Commands and actual results

- `composer lint:check`: exit 0; Pint passed with 0 errors across all modified PHP files.
- `composer types:check`: exit 0; PHPStan passed with 0 errors.
- `npm run lint:check`: exit 0; ESLint passed with 0 errors and 0 warnings.
- `npm run format:check`: exit 0; Prettier passed with 0 formatting issues.
- `npm run types:check`: exit 0; TypeScript passed with 0 errors.
- `npm run types:check:mobile`: exit 0; Mobile TypeScript passed with 0 errors.
- `php artisan test tests/Feature/Operations/TrackingDecouplingTest.php tests/Feature/Api/V1/LocationWeatherTest.php tests/Feature/OperationsPageTest.php tests/Feature/Operations/FieldExecutionViewTest.php tests/Feature/Operations/TrackingWorkspaceContractTest.php tests/Feature/MobileLifecycle/MobileLifecycleEndToEndTest.php tests/Feature/Operations/IdempotentCommandTest.php tests/Feature/Operations/LocationTrackingPrivacyTest.php tests/Feature/Operations/LocationRetentionTest.php`: exit 0; 48 tests, 812 assertions passed.
- `php artisan test tests/Feature/Operations/OperationsConcurrencyAndSafetyHardeningTest.php`: exit 0; 13 tests, 85 assertions passed.
- `npm run test:mobile`: exit 0; 83 Node unit tests and 24 Jest component test suites (206 tests) passed.
- `npm run test:unit`: exit 0; Vitest passed with 24 test files and 251 tests passed.

### Next step

Execute **Task 3: Scaffold Tracking Service (`apps/tracking`)** (standalone Laravel application, Nx project configuration, isolated migrations targeting `core2_ms_tracking`, and internal REST ingestion/query endpoints).

## Task 3: Scaffold Tracking Service (apps/tracking) (2026-09-09)

- Scope: Standalone Tracking Laravel microservice scaffolding in `apps/tracking/`, configuration targeting dedicated database `core2_ms_tracking`, schema-isolated database migrations for `location_samples`, `latest_locations`, and `tracking_command_receipts`, internal telemetry REST API endpoints (`POST /internal/v1/locations`, `GET /internal/v1/locations/latest`, `GET /internal/v1/locations`), retention command `location:prune`, Nx monorepo tooling configuration, and Pest test suite.
- Status: Completed and verified across standalone service, database migrations, REST endpoints, retention commands, Nx tooling, and Pest tests.

### Files changed and created

1. `apps/tracking/composer.json`:
   - Standalone service definition for `core2/tracking` with PHP 8.4, Laravel 13, and dev dependencies (Pest, Larastan, Pint, Mockery, Collision).
2. `apps/tracking/artisan`:
   - Standalone console entrypoint loading `bootstrap/autoload.php` and handling console commands.
3. `apps/tracking/bootstrap/autoload.php`:
   - Robust autoload fallback registering `Tracking\` and `Tracking\Tests\` PSR-4 namespaces via monorepo ClassLoader or standalone vendor autoloader.
4. `apps/tracking/bootstrap/app.php`:
   - Lightweight microservice application configuration registering API routes, console commands, `/up` health check, daily `location:prune` retention schedule at 02:15 UTC, and JSON exception handling.
5. `apps/tracking/config/database.php`, `apps/tracking/config/app.php` & `apps/tracking/config/cache.php`:
   - Dedicated database configuration targeting `core2_ms_tracking` (with SQLite in-memory testing profile), standalone application configuration, and dedicated cache configuration defaulting to `array` store to ensure artisan CLI and scheduling run reliably without external DB/Redis dependencies.
6. `apps/tracking/.env.example`:
   - Environment configuration targeting `core2_ms_tracking` on PostgreSQL port 5432.
7. `apps/tracking/database/migrations/`:
   - `2026_09_09_000001_create_location_samples_table.php`: High-volume GPS coordinate history with unconstrained scalar integer IDs (`user_id`, `operational_asset_id`, `dispatch_job_id`) and b-tree indexes (no foreign keys to Operations tables).
   - `2026_09_09_000002_create_latest_locations_table.php`: O(1) read-projection table per user and asset with unique `user_id` constraint, status, and coordinate columns.
   - `2026_09_09_000003_create_tracking_command_receipts_table.php`: Local idempotency receipts table with unique `command_id` index, `payload_hash`, `action`, and `user_id`.
8. `apps/tracking/app/Models/`:
   - `LocationSample.php`: Model representing telemetry samples with typed casts.
   - `LatestLocation.php`: Model representing current position projections with `computeFreshness()` helper ('fresh' <= 180s, 'delayed' < 900s, 'stale' <= 1800s, 'offline') and privacy-guarded `toDtoArray()` formatting (coordinates always null when sharing is disabled).
   - `TrackingCommandReceipt.php`: Model storing idempotency command receipts, action, payload hash, and response payloads.
9. `apps/tracking/app/Http/Requests/IngestLocationRequest.php`:
   - Form request validating scalar IDs, coordinate ranges (`latitude` -90..90, `longitude` -180..180), nullable coordinates when `sharing_enabled` is false, header/body command ID consistency, accuracy, speed, and ISO8601 timestamps.
10. `apps/tracking/app/Http/Controllers/Api/Internal/LocationController.php`:
    - `ingest()`: Idempotent atomic ingestion updating `location_samples` and `latest_locations` with canonical payload hashing, HTTP 409 Conflict rejection on mismatched command payloads, privacy coordinate nullification on sharing-off, out-of-order delayed replay protection, asset reassignment isolation, and receipt logging.
    - `latest()`: O(1) latest position lookups with optional `user_id`, `operational_asset_id` (or `asset_id`), and `dispatch_job_id` (or `job_id`) filters.
    - `index()`: Coordinate history query with `user_id`, `operational_asset_id`, `dispatch_job_id`, safe `date_from`/`date_to` range filtering, sorting (`captured_at`, `received_at`, `id`), and configurable limits.
11. `apps/tracking/routes/api.php` & `apps/tracking/routes/console.php`:
    - REST routes registered under `/internal/v1/*` and `/api/internal/v1/*`, with schedule deduplication resolved in `bootstrap/app.php`.
12. `apps/tracking/app/Console/Commands/PruneLocationUpdatesCommand.php`:
    - `location:prune` console command nullifying `latitude` and `longitude` older than 30 days across both `location_samples` and `latest_locations` while preserving non-coordinate audit metadata.
13. `apps/tracking/project.json`:
    - Nx project configuration for `tracking` with explicit targets for `lint`, `types`, and `test` (explicitly referencing `-c apps/tracking/phpunit.xml`).
14. `apps/tracking/phpstan.neon`:
    - Service-scoped PHPStan level 7 analysis configuration.
15. `apps/tracking/phpunit.xml`:
    - Isolated PHPUnit/Pest testing configuration using SQLite in-memory database.
16. `apps/tracking/tests/Tracking/`:
    - `LocationIngestionTest.php`: Tests valid ingestion, scalar ID persistence, projection updates, idempotency via body/header, 409 conflict detection on differing payload replay, header consistency validation, out-of-order replay protection, privacy coordinate nullification on sharing-off, delayed replay immunity, and asset reassignment.
    - `LatestLocationsTest.php`: Tests retrieving all latest positions, filtering by user/asset/job, and freshness calculations.
    - `LocationHistoryTest.php`: Tests history retrieval, user/asset/job filtering, date range filtering, safe handling of invalid dates, and custom sort order.
    - `LocationRetentionTest.php`: Tests 30-day coordinate nullification on both samples and projections, and audit metadata preservation.
17. `composer.json`:
    - Registered `Tracking\` and `Tracking\Tests\` PSR-4 namespaces.
18. `tests/Pest.php` & `tests/Unit/NxTaskConfigurationTest.php`:
    - Scoped root Pest test cases to `tests/Feature/` and `tests/Concurrency/` with tracking test configuration inclusion, and verified `tracking` logical project discovery in Nx.

### Commands and actual results

- `npx nx show projects`: exit 0; discovered `operations`, `field-mobile`, and `tracking`.
- `npx nx run tracking:lint`: exit 0; Pint passed with 0 errors across `apps/tracking`.
- `npx nx run tracking:types`: exit 0; PHPStan level 7 analysis passed with 0 errors across `apps/tracking`.
- `npx nx run tracking:test`: exit 0; 24 tests, 153 assertions passed.
- `php apps/tracking/artisan test`: exit 0; 24 tests, 153 assertions passed in 818ms.
- `php apps/tracking/artisan schedule:list`: exit 0; verified 1 deduplicated `location:prune` job scheduled daily at 02:15.
- `php artisan test tests/Unit/NxTaskConfigurationTest.php`: exit 0; 3 tests, 12 assertions passed.
- `php artisan test tests/Feature/Operations/TrackingDecouplingTest.php tests/Feature/Operations/LocationRetentionTest.php tests/Feature/Operations/LocationTrackingPrivacyTest.php`: exit 0; 22 tests, 158 assertions passed.
- `composer lint:check`: exit 0; Pint passed across entire repository with 0 errors.
- `composer types:check`: exit 0; PHPStan level 7 passed with 0 errors.
- `npm run lint:check`: exit 0; ESLint passed with 0 errors.
- `npm run format:check`: exit 0; Prettier passed with 0 errors.
- `npm run types:check`: exit 0; TypeScript passed with 0 errors.
- `npm run types:check:mobile`: exit 0; Mobile TypeScript passed with 0 errors.
- `git diff --check`: exit 0; 0 whitespace or conflict marker errors.

### Next step

Execute **Task 4: Wire Operations BFF to Tracking Service** (`HttpTrackingClient` implementing `TrackingClientInterface`, routing mobile and web telemetry to Tracking, and Reverb broadcasting).

## Task 4: Wire Operations BFF to Tracking Service (2026-09-09)

- Scope: Service-to-service authentication with HMAC-SHA256 request signing and 5-minute replay tolerance window, `ValidateServiceSignature` middleware on Tracking `/internal/v1/*` routes, `HttpTrackingClient` implementing `TrackingClientInterface` with timeout and fallback resilience, Operations BFF controllers updated to forward verified scalar IDs to Tracking and broadcast via Reverb upon HTTP 201 acknowledgment, driver switching in `TrackingServiceProvider`, and comprehensive integration/end-to-end Pest test suites.
- Status: Completed and verified across Operations, Tracking microservice, signing middleware, HTTP client, Reverb broadcasting, and Pest test suites.

### Files changed and created

1. `apps/tracking/app/Http/Middleware/ValidateServiceSignature.php`:
   - Enforces HMAC-SHA256 request signature verification on all `/internal/v1/*` and `/api/internal/v1/*` microservice endpoints.
   - Validates `X-Service-Name` against allowed callers (`operations`), `X-Timestamp` against a strict 300-second (5-minute) tolerance window, `X-Payload-Digest` against SHA-256 raw request body hash (with canonical empty digest for GET/HEAD), and `X-Signature` HMAC over `METHOD + "\n" + PATH + "\n" + TIMESTAMP + "\n" + DIGEST`.
2. `apps/tracking/routes/api.php`:
   - Applied `ValidateServiceSignature` middleware to `/internal/v1/*` and `/api/internal/v1/*` route groups.
3. `apps/tracking/config/services.php`:
   - Configuration file declaring `services.tracking.secret` and allowed services for HMAC authentication.
4. `apps/tracking/tests/TestCase.php`:
   - Added `generateSignatureHeaders()` helper, `withoutServiceSignature()` opt-out, and transparent auto-signing hook on internal endpoints for zero regression across existing test suites.
5. `apps/tracking/tests/Tracking/ServiceAuthenticationTest.php`:
   - Integration tests covering valid signatures, expired/future timestamp rejection (HTTP 401), missing header rejection (HTTP 401), invalid/tampered signature rejection (HTTP 401), tampered payload rejection (HTTP 401), unauthorized service rejection (HTTP 403), completely unsigned request rejection (HTTP 401), signed requests with trailing slash normalization, api prefix routing, and signed GET queries (HTTP 200).
6. `app/Platform/Tracking/Exceptions/TrackingConflictException.php`:
   - Dedicated HTTP 409 conflict exception safely propagating duplicate command conflicts with differing payloads.
7. `app/Platform/Tracking/Services/HttpTrackingClient.php`:
   - Implements `TrackingClientInterface` using Laravel HTTP client with configured connect timeout (3s) and read timeout (5s).
   - Generates canonical HMAC-SHA256 headers (`X-Service-Name: operations`, `X-Timestamp`, `X-Payload-Digest`, `X-Signature`, `X-Command-Id`, and propagated `X-Correlation-Id`).
   - Canonical path normalization trims leading and trailing slashes for robust signature agreement with reverse proxies.
   - Handles `ingestLocation`, `getLatestLocations`, `getLatestLocationForJob`, `getLatestLocationForUser`, `getLatestLocationForAsset`, and `queryLocationHistory`.
   - Propagates HTTP 409 Conflict via `TrackingConflictException`, and gracefully falls back to `DatabaseTrackingClient` on 5xx/connection timeout without crashing core dispatch workflows.
8. `app/Platform/Tracking/Http/Controllers/Api/V1/LocationController.php` & `LocationUpdateController.php`:
   - Validates active operator/asset assignments and user permissions in Operations.
   - Forwards verified scalar IDs (`user_id`, `operational_asset_id`, `dispatch_job_id`) to Tracking via `TrackingClientInterface`.
   - Returns `new LocationUpdateResource($latest)` directly from the microservice response, eliminating cross-database ID collisions and removing redundant duplicate writes on `location_updates` in Operations DB.
   - Audits location actions using `$request->user()` as the subject model.
   - Executes idempotency processing without wrapping external network calls in database transactions (`wrapInTransaction: false`).
   - Triggers Reverb `BroadcastTrackingWorkspaceUpdate` (`WorkspaceUpdated('tracking', 'updated')`) upon HTTP 201 acknowledgment from Tracking.
   - Safely propagates HTTP 409 Conflict back to client on mismatched command replays without persisting duplicate records or triggering broadcasts.
9. `app/Platform/Tracking/Http/Resources/V1/LocationUpdateResource.php`:
   - Enhanced to format both `LatestLocationDto` and `LocationUpdate` model instances identically.
10. `app/Platform/Tracking/TrackingServiceProvider.php`:
    - Resolves `HttpTrackingClient` when `TRACKING_SERVICE_DRIVER=http` or `TRACKING_SERVICE_URL` is set, while retaining `FakeTrackingClient` in test environments and `DatabaseTrackingClient` as local fallback.
11. `config/services.php`:
    - Declared `tracking` service configuration (`driver`, `url`, `secret`, `timeout`, `connect_timeout`).
12. `phpunit.xml` & `apps/tracking/phpunit.xml`:
    - Added testing environment configurations for `TRACKING_SERVICE_URL` and `TRACKING_SERVICE_SECRET`.
13. `tests/Feature/Operations/HttpTrackingClientTest.php`:
    - Pest integration tests verifying HMAC header computation, HTTP request signing, query responses, 409 conflict throwing, timeout resilience, full end-to-end telemetry flow (Mobile -> BFF -> Tracking HTTP 201 -> Reverb broadcast), zero duplicate writes to Operations DB (`location_updates`), primary key collision immunity, conflict propagation, and service provider driver switching.

### Commands and actual results

- `php apps/tracking/artisan test`: exit 0; 40 tests, 188 assertions passed in 1134ms.
- `npx nx run tracking:lint`: exit 0; Pint passed with 0 errors.
- `npx nx run tracking:types`: exit 0; PHPStan level 7 passed with 0 errors.
- `php artisan test tests/Feature/Operations/HttpTrackingClientTest.php`: exit 0; 9 tests, 61 assertions passed in 4389ms.
- `php artisan test tests/Feature/Api/V1/LocationTest.php tests/Feature/Operations/TrackingDecouplingTest.php tests/Feature/Operations/IdempotentCommandTest.php tests/Feature/Operations/FuelAndTrackingWorkflowTest.php tests/Feature/Operations/LocationRetentionTest.php tests/Feature/Operations/LocationTrackingPrivacyTest.php tests/Feature/MobileLifecycle/MobileLifecycleEndToEndTest.php`: exit 0; 44 tests, 399 assertions passed in 29544ms.
- `composer lint:check`: exit 0; Pint passed across entire repository with 0 errors.
- `composer types:check`: exit 0; PHPStan level 7 passed with 0 errors.
- `npm run lint:check`: exit 0; ESLint passed with 0 errors.
- `npm run types:check`: exit 0; TypeScript passed with 0 errors.
- `git diff --check`: exit 0; 0 whitespace or conflict marker errors.

### Next step

Execute **Task 5: Configure Dedicated Workers for Internal AI and Reporting** (dedicated queue channels in Operations for `ai` and `reports`, routing `GenerateGptRecommendationJob` and `GenerateReportExportJob`, worker supervision configuration).

## Task 5: Configure Dedicated Workers for Internal AI and Reporting (2026-09-09)

- Scope: Dedicated queue channels configuration in `config/queue.php` for isolated worker pools (`default`, `ai`, `reports`), job queue routing across all internal AI and reporting jobs (`GenerateGptRecommendationJob`, `SweepProactiveGptRecommendationsJob`, `PruneGptRecommendationsJob`, `GenerateReportExportJob`, `PruneExpiredExportsJob`), explicit queue assignments at job dispatch sites (`CreateReportExportAction`, `RetryReportExportAction`, `GenerateGptRecommendation`, `bootstrap/app.php`), supervisor worker pool definitions in `docker/supervisord.conf`, cross-platform local worker runner scripts (`scripts/run-workers.sh`, `scripts/run-workers.bat`), architecture and Docker documentation updates (`Docs/microservice/architecture.md`, `Docs/architecture/docker.md`), and comprehensive Pest test suite (`tests/Feature/Operations/DedicatedWorkerQueueIsolationTest.php`) verifying strict queue routing and starvation immunity under heavy backlog conditions.
- Status: Completed and verified. The Core-2 two-service architecture implementation (Tasks 1 through 5) is complete and ready for final review.

### Files changed and created

1. `config/queue.php`:
   - Defined `'queues'` configuration array declaring dedicated channel metadata, timeouts, tries, and descriptions for `default` (60s, 3 tries), `ai` (120s, 3 tries), and `reports` (300s, 2 tries).
   - Configured dedicated connection options in `'connections'` for `database-ai`, `database-reports`, `redis-ai`, `redis-reports`, `ai`, and `reports`.
   - Increased default `retry_after` on `database` and `redis` connections to 420s to safely accommodate long-running exports without premature worker re-releases.
2. `app/Platform/Gpt/Jobs/GenerateGptRecommendationJob.php`:
   - Configured `$this->queue = 'ai'` and `$this->onQueue('ai')` in constructor.
   - Updated timeout to 120s to match dedicated AI worker execution limits.
3. `app/Platform/Gpt/Jobs/SweepProactiveGptRecommendationsJob.php` & `PruneGptRecommendationsJob.php`:
   - Configured `$this->queue = 'ai'` and `$this->onQueue('ai')` in constructor.
4. `app/Platform/Reporting/Jobs/GenerateReportExportJob.php`:
   - Configured `$this->queue = 'reports'` and `$this->onQueue('reports')` in constructor.
5. `app/Platform/Reporting/Jobs/PruneExpiredExportsJob.php`:
   - Configured `$this->queue = 'reports'` and `$this->onQueue('reports')` in constructor.
6. `app/Platform/Notifications/Jobs/SendQueuedNotificationJob.php`:
   - Explicitly configured `$this->queue = 'default'` and `$this->onQueue('default')` in constructor, ensuring operational notifications remain strictly on the primary dispatch channel.
7. `app/Platform/Gpt/Actions/GenerateGptRecommendation.php`:
   - Explicitly dispatched `GenerateGptRecommendationJob` with `->onQueue('ai')`.
8. `app/Platform/Reporting/Actions/CreateReportExportAction.php`:
   - Explicitly dispatched `GenerateReportExportJob` with `->onQueue('reports')`.
9. `app/Platform/Reporting/Actions/RetryReportExportAction.php`:
   - Explicitly dispatched `GenerateReportExportJob` with `->onQueue('reports')->afterCommit()`.
10. `bootstrap/app.php`:
    - Scheduled `PruneExpiredExportsJob` on `'reports'` queue with `withoutOverlapping()`.
    - Scheduled `PruneGptRecommendationsJob` and `SweepProactiveGptRecommendationsJob` on `'ai'` queue with `withoutOverlapping()`.
11. `docker/supervisord.conf`:
    - Replaced generic single queue worker with three isolated worker programs:
      - `queue-worker-operational`: `php artisan queue:work --queue=default,high --sleep=3 --tries=3 --max-time=3600` (`stopwaitsecs=30`).
      - `queue-worker-ai`: `php artisan queue:work --queue=ai --timeout=120 --tries=3 --sleep=3 --max-time=3600` (`stopwaitsecs=120`).
      - `queue-worker-reports`: `php artisan queue:work --queue=reports --timeout=360 --tries=2 --sleep=3 --max-time=3600` (`stopwaitsecs=360`).
12. `scripts/run-workers.sh` & `scripts/run-workers.bat`:
    - Added local development runner scripts supporting individual pool execution (`operational`, `ai`, `reports`) or concurrently launching all three isolated worker processes.
13. `Docs/microservice/architecture.md`:
    - Documented dedicated worker channel configuration, worker execution commands, timeouts, retry policies, and starvation immunity architecture.
14. `Docs/architecture/docker.md`:
    - Documented container worker supervision topology, three dedicated supervisor worker pools, stopwaitsecs values, and HostForge deployment topology.
15. `tests/Feature/Operations/DedicatedWorkerQueueIsolationTest.php`:
    - Added comprehensive regression test suite (9 tests, 52 assertions) covering:
      - Config queue channel definitions for default, ai, and reports.
      - `GenerateGptRecommendationJob` strictly routing to `ai` queue with 120s timeout.
      - `SweepProactiveGptRecommendationsJob` and `PruneGptRecommendationsJob` strictly routing to `ai` queue.
      - `GenerateReportExportJob` strictly routing to `reports` queue with 300s timeout.
      - `PruneExpiredExportsJob` strictly routing to `reports` queue.
      - `GenerateGptRecommendation` service action dispatching to `ai` queue.
      - `CreateReportExportAction` and `RetryReportExportAction` dispatching to `reports` queue.
      - Operational and notification jobs remaining on `default` queue.
      - Starvation immunity proof: verified under `database` queue driver that a backlog of 5 heavy reports jobs and 5 heavy AI jobs does not delay or block an operational dispatch job on `default`, and that dedicated reporting and AI workers pop only their respective queue workloads.

### Commands and actual results

- `composer lint:check`: exit 0; Pint passed across entire repository with 0 errors.
- `composer types:check`: exit 0; PHPStan level 7 passed with 0 errors.
- `npm run lint:check`: exit 0; ESLint passed with 0 errors and 0 warnings.
- `npm run types:check`: exit 0; TypeScript passed with 0 errors.
- `npm run types:check:mobile`: exit 0; Mobile TypeScript passed with 0 errors.
- `php artisan test tests/Feature/Operations/DedicatedWorkerQueueIsolationTest.php`: exit 0; 9 tests, 52 assertions passed in 4255ms.
- `php artisan test tests/Feature/Gpt/`: exit 0; 54 tests, 160 assertions passed in 22609ms.
- `php artisan test tests/Feature/Operations/ReportExportWorkflowTest.php`: exit 0; 79 tests, 395 assertions passed in 43641ms.
- `php artisan test tests/Feature/Operations/OperationsConcurrencyAndSafetyHardeningTest.php`: exit 0; 13 tests, 85 assertions passed in 10191ms.
- `php artisan test tests/Feature/Operations/TrackingDecouplingTest.php tests/Feature/Operations/HttpTrackingClientTest.php`: exit 0; 21 tests, 170 assertions passed in 12851ms.
- `git diff --check`: exit 0; 0 whitespace or conflict marker errors.

### Implementation Status: Complete

The Core-2 two-service architecture implementation is complete across all five planned tasks:
- **Task 1**: Operations Concurrency & Safety Hardening (DVIR transaction extraction, HOS pessimistic locks, idempotency, versioning).
- **Task 2**: Decouple Tracking Queries, Weather, and Test Doubles in Operations (`TrackingClientInterface`, DTOs, in-memory hydration, weather extraction).
- **Task 3**: Scaffold Tracking Service (`apps/tracking` standalone Laravel app, Nx targets, isolated migrations, REST telemetry API, daily retention).
- **Task 4**: Wire Operations BFF to Tracking Service (HMAC-SHA256 request signing, `HttpTrackingClient`, Reverb broadcasting, 409 conflict propagation).
- **Task 5**: Configure Dedicated Workers for Internal AI and Reporting (isolated channels `default`, `ai`, `reports`, job routing, supervisor worker pools, starvation immunity test suite).

## Full Quality Gate & Final Release Verification (2026-09-09)

- Scope: Full repository code quality, static type safety, and core domain regression verification across Core Operations and Tracking microservice on `codex/microservices-handoff`.
- Status: Completed and verified. All quality gates passed with zero errors, zero warnings, and zero regressions.

### Quality Gate Results & Evidence

1. **Repository Code Quality & Type Safety**:
   - `composer lint:check` (Pint): exit 0; `{"tool":"pint","result":"passed"}` across all PHP source files.
   - `composer types:check` (PHPStan Level 7): exit 0; `{"tool":"phpstan","result":"passed","errors":0}` across the entire backend codebase.
   - `npm run lint:check` (ESLint): exit 0; 0 errors, 0 warnings across all web and mobile TypeScript/React code.
   - `npm run types:check` (Web TypeScript): exit 0; `tsc --noEmit` passed with 0 errors.
   - `npm run types:check:mobile` (Mobile TypeScript): exit 0; `tsc --noEmit` in `packages/field-mobile` passed with 0 errors.

2. **Core Domain & Inter-Service Test Verification**:
   - `tests/Feature/Operations/DedicatedWorkerQueueIsolationTest.php`: exit 0; 9 tests, 52 assertions passed (4540ms). Verifies queue isolation (`default`, `ai`, `reports`), timeouts, and starvation immunity under heavy mixed load.
   - `tests/Feature/Operations/HttpTrackingClientTest.php`: exit 0; 9 tests, 61 assertions passed (4471ms). Verifies HMAC-SHA256 request signing, 5-minute replay window, 409 conflict handling, Reverb broadcasting, and graceful error recovery.
   - `tests/Feature/Operations/OperationsConcurrencyAndSafetyHardeningTest.php`: exit 0; 13 tests, 85 assertions passed (7576ms). Verifies DVIR transaction isolation, critical defect lockouts, HoS pessimistic locking, idempotency, and version conflict detection.
   - `apps/tracking/tests/` (`php vendor/bin/pest -c apps/tracking/phpunit.xml`): exit 0; 40 tests, 188 assertions passed (1214ms). Verifies high-throughput telemetry ingestion, latest location caching, historical queries, and 30-day retention pruning.
   - `tests/Feature/Operations/TrackingDecouplingTest.php`: exit 0; 12 tests, 109 assertions passed (8856ms). Verifies `TrackingClientInterface`, DTO hydration, workspace integration, and fake client contracts.
   - `tests/Feature/Gpt/`: exit 0; 54 tests, 160 assertions passed (22237ms). Verifies AI prompt construction, recommendation flows, proactive sweeps, and cache pruning.
   - `tests/Feature/Operations/ReportExportWorkflowTest.php`: exit 0; 79 tests, 395 assertions passed (42947ms). Verifies report export pipelines for DOLE WAIR, fuel consumption, safe man-hours, and coordinate audit datasets.

3. **Cumulative Core Verification Totals**:
   - Total Core Domain Tests: 216 tests passed (0 failures, 0 errors).
   - Total Assertions: 1,050 assertions passed.

4. **Quality Gate Documentation**:
   - Formal Quality Gate documentation recorded in `.ai-reports/ai-verification-questions.md` addressing:
     1. Security: HMAC-SHA256 request signing, 5-minute replay drift window, unconstrained scalar IDs, no cross-database foreign key leaks, Sanctum BFF boundaries, and transactional state transition locks.
     2. Efficiency: Dedicated background worker pools eliminating dispatch queue starvation, O(1) `latest_locations` read projections, automated 30-day retention pruning, and non-blocking HTTP tracking client with fallback.
     3. Regressions & Mitigations: Inter-service network latency, clock drift between service containers, worker pool imbalances, and retry thresholds.
     4. Test Coverage: Comprehensive citation of exact test suites, test counts, assertion numbers, and verified execution results.

### Final Verification Sign-Off

The Plan A Two-Service Architecture & Worker Isolation implementation is verified clean and ready for merge/release review. Original development databases, uploaded files, and HostForge configurations remain preserved. No unauthorized commits, pushes, or deployments were performed.

## Phase 7: Distributed Resilience & Failure-Injection Harness (2026-09-09)

- Scope: Automated failure-injection test suite in `tests/Feature/Operations/Phase7DistributedResilienceTest.php` covering Tracking microservice outage and network partitions (HTTP 500/503 and connection/read timeouts with fallback to `DatabaseTrackingClient` and graceful live map loading), External AI (OpenRouter) outage (connection timeouts, HTTP 429 rate limits, clean failure handling with `gpt_recommendation_metrics` logging, starvation immunity on `default` queue, and unblocked subsequent AI jobs), Inter-Service tampering and replay defense (HTTP 409 Conflict / `TrackingConflictException` on command replay with modified payload, strict HTTP 401 on forged HMAC signatures, timestamps outside 300s window, and tampered payload digests), and Export worker graceful failure (clean failure transition in `ReportExport`, zero dangling database locks or uncommitted transactions, and automatic `.part` temporary file cleanup).
- Status: Completed and verified across all four resilience domains.

### Files changed and created

1. `app/Platform/Tracking/Services/HttpTrackingClient.php`:
   - Added structured warning logging (`Log::warning('Tracking microservice returned error on ...', ...)`) when the Tracking microservice returns non-successful HTTP status codes on `getLatestLocationForUser`, `getLatestLocationForAsset`, `getLatestLocationForJob`, and `queryLocationHistory`, ensuring consistent telemetry observability across all fallback paths.

2. `tests/Feature/Operations/Phase7DistributedResilienceTest.php`:
   - Comprehensive automated resilience test suite containing 17 tests and 222 assertions across 4 failure injection domains:
     - **Tracking Outage / Partition**:
       - Verified `HttpTrackingClient` handles HTTP 500 by logging structured warning and falling back to `DatabaseTrackingClient` without crashing.
       - Verified `HttpTrackingClient` handles HTTP 503 Service Unavailable by logging structured warning and falling back to local database.
       - Verified `HttpTrackingClient` handles HTTP 500/503 errors on `getLatestLocationForUser`, `getLatestLocationForAsset`, and `queryLocationHistory` with structured warning logs and database fallback.
       - Verified network partition and timeout (> 3.0s connect / 5.0s read) logs structured warning and falls back to local database for both queries and ingestion.
       - Verified Operations live map (`OperationsWorkspaceController` / `fetchLocations`) continues loading gracefully without throwing unhandled 500 exceptions across `/`, `/operations`, and `/operations?view=assets` during complete Tracking microservice outage (HTTP 503) and network partition timeouts.
     - **External AI (OpenRouter) Outage**:
       - Verified `GenerateGptRecommendationJob` fails cleanly on OpenRouter connection timeout and records failure metrics in `gpt_recommendation_metrics`.
       - Verified `GenerateGptRecommendationJob` fails cleanly on OpenRouter rate-limit (HTTP 429) and records failure metrics in `gpt_recommendation_metrics`.
       - Verified `GenerateGptRecommendationJob` fails cleanly on OpenRouter external API server error (HTTP 502/503 Bad Gateway) and records failure metrics in `gpt_recommendation_metrics`.
       - Verified starvation immunity under heavy mixed load: failed AI jobs never delay or starve operational jobs on `default` queue, and subsequent AI jobs process without being blocked by prior failures.
     - **Inter-Service Tampering & Replay Defense**:
       - Verified command replay with modified payload yields explicit HTTP 409 Conflict (`TrackingConflictException`) across `HttpTrackingClient`, Operations mobile API (`POST /api/v1/locations`), and web BFF controller (`POST /operations/locations`), with Reverb broadcast suppression.
       - Verified `ValidateServiceSignature` middleware strictly rejects forged HMAC signatures with HTTP 401 Unauthorized (`Invalid HMAC-SHA256 request signature.`).
       - Verified `ValidateServiceSignature` middleware strictly rejects expired timestamps (> 300s in past) and future timestamps (> 300s in future) with HTTP 401 Unauthorized (`Request timestamp expired or outside 5-minute tolerance window.`).
       - Verified `ValidateServiceSignature` middleware strictly rejects tampered payload digests and altered body contents with HTTP 401 Unauthorized (`Payload digest mismatch.`).
       - Verified completely unsigned requests are rejected with HTTP 401 (`Missing X-Service-Name header.`).
     - **Export Worker Graceful Failure**:
       - Verified `GenerateReportExportJob` records error status in `ReportExport` upon export failure, records audit event `report_export.failed`, and does not leave database locks or open transactions hanging (`DB::transactionLevel() === 1`).
       - Verified temporary partially-written export files (`.part`) are purged from storage disk upon worker failure to prevent storage leaks.
       - Verified unsupported export formats fail gracefully with error status.
       - Verified reports queue resilience: failing export job releases locks and does not block subsequent report export jobs on the `reports` queue.

### Commands and actual results

- `composer lint:check` (Pint): exit 0; `{"tool":"pint","result":"passed"}` across all PHP files.
- `composer types:check` (PHPStan Level 7): exit 0; `{"tool":"phpstan","result":"passed","errors":0}` across the entire codebase.
- `php artisan test tests/Feature/Operations/Phase7DistributedResilienceTest.php`: exit 0; 17 tests, 222 assertions passed in 10112ms.
- `php artisan test tests/Feature/Operations/DedicatedWorkerQueueIsolationTest.php tests/Feature/Operations/HttpTrackingClientTest.php`: exit 0; 18 tests, 113 assertions passed in 8472ms.
- `php apps/tracking/artisan test`: exit 0; 40 tests, 188 assertions passed in 1329ms.
- `git diff --check`: exit 0; 0 whitespace or conflict marker errors.

### Phase 7 Verification Summary

All failure injection scenarios passed with zero crashes, unhandled 500 exceptions, orphaned database locks, or queue starvation. Microservice boundaries, HMAC request signing, replay defense, and worker isolation behave deterministically under simulated network, provider, and worker outages.
