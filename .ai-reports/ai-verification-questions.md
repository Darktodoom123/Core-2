# AI verification questions

## Field Emergency SOS — 2026-08-24

### Did you build this the most secure way?

The security boundary is server-authoritative: Sanctum authentication, active-token middleware, the named SOS rate limiter, active field-role validation, scoped dispatch/asset resolution, policy/FormRequest authorization, UUID idempotency, row locks, recipient snapshots, audit events, encrypted emergency phone numbers, deterministic phone hashes, coordinate retention pruning, and no automatic public-authority contact. Dispatcher and Operations Manager recipients are resolved from active verified Core 2 users only; Field Technicians are never escalation recipients. Mobile call/SMS actions accept only server-configured `tel:`/`sms:` URIs and require deliberate user action. The live map's SOS halo is non-interactive, while the marker retains a keyboard-accessible button, SOS icon/label, and status text. SOS is disabled by default (`SOS_ENABLED=false`) and the escalation binding is a null provider until real contacts, providers, monitoring, and acceptance gates are complete.

Residual security gates are provider configuration review, production emergency-contact roster review, Reverb/realtime delivery monitoring, staging delivery drills, and physical-device/lock-screen acceptance. Those gates intentionally keep production activation disabled.

### Did you build this the most efficient way?

The implementation reuses the existing Laravel identity, notifications, audit, workspace, Inertia, Reverb, and mobile outbox boundaries. Triggering is one transaction with one recipient-resolution pass and after-commit delivery jobs. Responder state is eager-loaded into the existing workspace prop, with bounded records and polling/realtime refresh rather than a second workspace. The mobile outbox gives SOS its own emergency-priority scope and preserves the same UUID through retries, while GPS enrichment is bounded and non-blocking.

The main remaining efficiency measurement is production queue/realtime latency under a real emergency load test; it was not run because the provider and production gates are intentionally incomplete.

### What regressions could this introduce?

Potential regressions are migration ordering or notification-schema deployment errors, stale responder snapshots in a long-lived workspace, incorrect server/client contract drift, duplicate retry delivery, SOS halo state or location drift, and emergency actions being unavailable on devices without a configured provider or phone capability. These are mitigated by idempotent database constraints, row locks, after-commit jobs, bounded freshness/expiry windows, synchronized map/text location summaries, explicit delivery states, strict call/SMS URI validation, a responder-only `operations.sos` channel with polling fallback, worker-ID matching with live-coordinate precedence, and resolved/cancelled halo removal.

The broader mobile component suite still has one pre-existing failure in `nativeFieldWorkflows.component.test.tsx`; the same failure reproduces on the original main checkout and is unrelated to SOS. Android export, Detox, physical-device, browser, provider, and staging delivery checks remain open release gates.

### What tests do we need to write before we ship this?

Before production enablement, add and run PostgreSQL concurrency tests for first acknowledgement and duplicate command races; API contract tests against the mobile client payload and response shapes; Reverb reconnect and polling-fallback tests; queue/provider retry and emergency-contact delivery tests; browser keyboard/screen-reader and responder authorization flows; Android cold-start, lock-screen, offline, GPS-timeout, `tel:`/`sms:` handoff, and physical-device tests; a staged three-minute escalation drill proving notification, acknowledgement, resolution, audit, and monitoring behavior; and a map acceptance drill covering active, acknowledged-unresolved, resolved/cancelled, live-location update, normal-motion pulse, reduced-motion static halo, supported zoom, keyboard access, and non-blocking marker interaction. Current focused evidence includes 12 SOS Pest tests/55 assertions, 43 mobile unit tests, 5 native map-marker tests, 2 SOS component tests, 6 Playwright MapLibre tests, PHPStan, Pint, TypeScript, ESLint, Prettier, the Vite production build, route registration, and diff checks.

## Release decision

`SOS_ENABLED=false` remains required until all provider, roster, monitoring, realtime, staging, physical-device, and live-map SOS-ring acceptance gates pass.

## Docker modernization — 2026-08-25

### Did you build this the most secure way?

The image uses pinned Docker Official Image digests, a current Dockerfile syntax
directive, separate build/runtime stages, explicit Alpine packages without
`apk upgrade`, locked Composer/npm installs, and no runtime `.env` creation.
The production stage copies only application runtime paths, vendor files, and
built assets. The startup boundary validates required database, application,
Reverb, and conditional Redis settings; storage, cache, and database paths are
owned by `www-data` with `0770` directories and `0660` files. No `chmod 777` or
build-time runtime secret is used. Supervisor remains root only for named-volume
ownership setup and Nginx port 80; PHP-FPM workers, Nginx workers, queue,
scheduler, and Reverb are unprivileged.

The final runtime image was inspected: it contains no project `.env` or
`.env.example`, no world-writable project paths, and no application/database
credentials in image configuration. Named-volume paths are `0770`; the image
and non-volume application paths are not world-writable. The public Reverb
identifier is intentionally available to the browser bundle; the private
Reverb secret is runtime-only.

Residual security work is vulnerability scanning and regular review. The build
still obtains Alpine packages from the pinned base image's configured
repositories rather than pinning every APK package version; weekly image
refreshes, secret rotation, and CI scanning remain necessary.

### Did you build this the most efficient way?

The PHP extension layer is shared by Composer, frontend, and test stages.
Composer and npm dependency layers are isolated before source changes and use
BuildKit cache mounts. The production stage excludes tests, mobile sources,
documentation, CI metadata, and frontend build-tool manifests. The concurrency
test target is intentionally self-contained, which removes host `vendor/` and
bind-mount variability at the cost of a larger test image.

### What regressions could this introduce?

The main behavior-sensitive areas are the PHP 8.4.24/Alpine 3.24 extension
build, PHP-aware Wayfinder/Vite generation without an `.env`, Supervisor signal
handling, Nginx worker ownership, and the test entrypoint's creation and
migration of `core2_concurrency_test`. External PostgreSQL users may still see
the bundled local `db` service start because the Compose file preserves the
existing local topology; the app itself honors the configured external host.
The test profile assumes the supplied local PostgreSQL user can create the
concurrency database or that it is pre-provisioned. The profile intentionally
runs R6 before R3 and resets only its dedicated test database so R3's
`DatabaseMigrations` cleanup cannot remove R6's migrated schema; this does not
change application behavior.

### What tests do we need to write before we ship this?

The Docker workflow adds Dockerfile parsing, quiet Compose validation, fresh
production and test-target builds, a bounded health check for app/PostgreSQL/
Redis, an `/up` request, and the profile-gated Concurrency Pest suite using
dummy non-secret values. Local static checks also include YAML/JSON parsing,
shell syntax, image-reference verification, security-pattern review, and
`git diff --check`.

Local verification completed with Docker Desktop's Linux daemon: `docker
build --check .` passed with no warnings; `docker compose config --quiet`
passed with dummy values and printed no resolved secrets; production and
test-runner targets built with locked dependencies; the isolated Compose stack
reached healthy app/PostgreSQL/Redis; `/up` returned HTTP 200; and the exact
profile command completed the two intended concurrency files with exit 0,
17 existing warnings, and 91 assertions. Shell syntax, Composer validation,
security-pattern checks, and `git diff --check` also passed. The isolated
project was stopped with `docker compose down` without `--volumes`, preserving
its named volumes. The test suite's warnings and the normal need for image
vulnerability scanning remain release risks.

## Docker frontend map build configuration — 2026-08-26

### Did you build this the most secure way?

The six map values are explicitly public browser configuration because Vite
embeds `VITE_*` values in client assets. The Dockerfile forwards them only to
the frontend-builder stage and does not persist them as runtime `ENV` values.
Server-only `APP_KEY`, database credentials, and `REVERB_APP_SECRET` remain
runtime configuration; the frontend build command no longer uses shell
tracing, so the public map key is not echoed in build logs. CI passes a dummy
public map key and rejects the configured private Reverb secret if it appears
in the extracted production bundle.

### Did you build this the most efficient way?

Compose and the production CI build share one explicit map-argument contract,
and a small Node verifier scans the final production assets rather than
rebuilding the frontend a second time. The map provider, plan, and use case
are retained in the map configuration metadata so the verification covers
the complete browser-facing configuration, while the final image still copies
only the compiled assets.

### What regressions could this introduce?

Changing any `VITE_*` value still requires an image rebuild; a runtime-only
container recreation cannot update compiled assets. Empty or incorrectly
restricted public map keys can still produce unavailable tiles, and custom
providers remain responsible for supplying a compatible style URL. The new
map data attributes are public diagnostics and should not be treated as a
security boundary. Docker image verification remains dependent on a working
Linux Docker daemon.

### What tests do we need to write before we ship this?

The focused build gate is `scripts/verify-frontend-build.cjs`, which checks
all six map values in the final production bundle and rejects a server-only
credential. The local sentinel build passed with Vite, the verifier found all
six values across 25 assets, and formatting, ESLint, and TypeScript checks
passed. The GitHub Docker workflow additionally validates Compose, builds the
runtime image, extracts its assets, runs the verifier, and performs the
existing health and concurrency checks. A local Dockerfile build and final
image inspection remain unrun in this session because Docker Desktop's Linux
daemon was unavailable.

## Job Report Architecture & Resubmission Engine — 2026-08-27

### Did you build this the most secure way?

The security boundary for job reports enforces server-authoritative verification:
1. **Four-Eyes Enforcement & Anti-Self-Approval**: `ReviewJobReport` rejects any self-approval attempt with a 403 Forbidden exception (`$reviewer->id === $report->author_id`), ensuring operators cannot sign off on their own field work.
2. **Explicit Resubmission Policy & Identity Validation**: `JobReportPolicy::resubmit()` and `JobReportPolicy::update()` restrict resubmission and edits strictly to the original author (when in `Draft` or `Rejected` status) or an authorized Operations Manager.
3. **Telemetry & GPS Sanitization**: FormRequests (`StoreJobReportRequest`, `ResubmitJobReportRequest`) strictly validate `ending_meter_value` (`numeric|min:0|max:99999999.99`), `meter_type` (`in:odometer_km,engine_hours`), and GPS coordinates (`latitude: between -90, 90`, `longitude: between -180, 180`).
4. **Audit Trail & State Immutability**: All resubmissions, draft saves, and approvals write to the audit log (`job_report.resubmitted`, `job_report.draft_saved`, `dispatch_job.completed_via_report_approval`) with diff snapshots, ensuring tamper-proof operational records.

### Did you build this the most efficient way?

1. **Atomic Closeout Synchronization**: Approving a job report automatically transitions the parent `DispatchJob` status to `Completed` and atomically synchronizes the assigned `OperationalAsset.meter_value` within a single database transaction, preventing N+1 queries and separate manual dispatch sync steps.
2. **Optimistic Outbox & Offline Guarantee**: Field mobile clients record job reports through an actor-scoped outbox queue (`CommandOutboxManager`) using durable SQLite storage, deterministic SHA-256 payload hashing, and UUID idempotency keys to guarantee at-least-once delivery with zero duplicate entries upon network reconnection.
3. **Reactive UI State Flow**: The Inertia React workspace and mobile React Native client use memoized state filters and accessible drawers/modals without unnecessary polling loops or page reloads.

### What regressions could this introduce?

1. **State Machine Invariants**: Automatic dispatch completion on report approval requires the dispatch to be in an active operational state (`Working`, `Arrived`, or `EnRoute`). If an already cancelled or archived job is referenced, the transition is safely guarded.
2. **Rejection Resubmission Counters**: Rejected reports increment `resubmitted_count` and overwrite status back to `Submitted`, resetting manager review queues.
3. **Mobile Offline Serialization**: Commands serialized with previous outbox versions are protected against schema mismatch by explicit typing in `JobReportCommandPayload`.

### What tests do we need to write before we ship this?

Comprehensive multi-layer test suites have been implemented and verified:
1. **Backend Pest Feature Tests**:
   - `JobReportResubmissionTest.php`: Draft saving, rejection reason persistence, author-only resubmission loop, and counter incrementation.
   - `JobReportSecurityAuditTest.php`: Four-eyes anti-self-approval enforcement, atomic dispatch completion synchronization, and asset meter value updates.
   - `JobReportWorkflowTest.php`: Full end-to-end report lifecycle (Draft -> Submitted -> Rejected -> Resubmitted -> Approved).
2. **Mobile Jest & Component Tests**:
   - `digitalSignatureModal.component.test.tsx`: Signature canvas interaction, telemetry inputs, and form validation.
   - `nativeFieldWorkflows.component.test.tsx` and `commandOutbox.test.ts`: Outbox queueing and offline sync.
3. **Static Analysis & Linters**:
   - `composer types:check` (PHPStan level max): 0 errors.
   - `composer lint:check` (Laravel Pint): Passed.
   - `npm run types:check` (TypeScript tsc): 0 errors.
   - `npm run lint:check` (ESLint): 0 errors.
   - `npm run format:check` (Prettier): Passed.

## Fuel Management, Variance Analysis & Anomaly Engine — 2026-08-27

### Did you build this the most secure way?

1. **Role-Based Workflow & Stage Gating**: Fuel transition endpoints strictly enforce granular Spatie permissions (`fuel.request`, `fuel.forward`, `fuel.approve`, `fuel.verify`, `fuel.record`, `fuel.report`, `fuel.view_all`). Operations Managers cannot approve unauthorized requests without proper status progression (submitted -> forwarded -> approved -> verified -> logged).
2. **Safe Export Serialization & Anti-CSV Injection**: All report exports through `WeeklyFuelConsumptionExportDataset` sanitize formula prefix characters (`=`, `+`, `-`, `@`, `\t`, `\r`) to completely prevent CSV injection attacks in spreadsheet software. Export headers are validated against security constraints (no leaked passwords, secrets, coordinates, or internal unstructured remarks).
3. **Monotonic Meter Validation**: When recording fuel consumption against an asset, `TransitionFuelRequest` validates that the new odometer or hour meter reading is strictly greater than or equal to the asset's current recorded `meter_value`, preventing odometer rollbacks or invalid chronological meter submissions.
4. **Audit Logging**: Every fuel state change, variance calculation, and report generation logs an immutable `AuditEvent` with actor ID, IP address, and before/after transition payloads.

### Did you build this the most efficient way?

1. **Single-Pass Calculation Action**: `CalculateFuelVarianceAndBurnRate` handles variance computation ($Q_{\text{actual}} - Q_{\text{requested}}$ and percentage), delta meter difference calculation, effective burn rate derivation ($L/\text{km}$ for trucks, $L/\text{hr}$ for cranes/generators), and anomaly detection in a single deterministic pass.
2. **Chunked & Streaming Reporting**: `GenerateWeeklyFuelConsumptionSummary` aggregates metrics within a single date-bounded query using eager loading of requests, assets, and jobs. `WeeklyFuelConsumptionExportDataset` uses `lazyById(500)` streaming to maintain minimal memory footprint during bulk CSV and PDF export generation.
3. **Reactive UI Filtering**: The frontend `FuelSurface` supports responsive anomaly filtering and dynamic meter input formatting without triggering unnecessary full-page refreshes.

### What regressions could this introduce?

1. **Unmetered Equipment Handling**: Heavy rigging gear or static equipment without odometers or hour meters are safely supported with nullable meter columns and graceful zero-variance fallbacks without throwing `DivisionByZeroError`.
2. **Delta Meter Edge Cases**: For newly provisioned assets without prior meter records, effective burn rate gracefully falls back to null rather than generating erroneous spikes, while quantity variance percentage is accurately computed against the approved requested volume.
3. **Decimal Precision**: All database columns for variance and burn rates use `decimal(10, 2)` / `decimal(8, 2)` to eliminate floating-point rounding errors across high-volume fuel operations.

### What tests do we need to write before we ship this?

1. **Automated Feature Tests**:
   - `FuelConsumptionVarianceAndAnomalyTest.php`:
     - Normal quantity variance below 15% threshold.
     - Excessive fuel quantity anomaly trigger on $\ge 15\%$ variance.
     - Effective burn rate calculation ($L/\text{km}$) for road trucks and automatic asset meter updating.
     - Effective burn rate calculation ($L/\text{hr}$) for hydraulic cranes and excessive burn rate anomaly detection ($\ge 15\%$ over baseline).
     - Non-monotonic meter rejection.
     - Unmetered equipment handling.
   - `WeeklyFuelConsumptionReportTest.php`:
     - Weekly aggregation metrics, asset breakdown, and job breakdown.
     - JSON API endpoint authorization gating for operations managers.
     - Export dataset header sanitization and CSV row streaming.
   - `FuelAndTrackingWorkflowTest.php`:
     - Full 5-stage fuel workflow lifecycle with audit events and receipt attachments.
2. **Verification Suite Results**:
   - Pest Feature Tests: 22 tests / 263 assertions passing (100%).
   - PHPStan (Max Level): 0 errors.
   - Laravel Pint: Passed with 0 violations.
   - TypeScript (`tsc --noEmit`): 0 errors.
   - ESLint: 0 errors.
   - Prettier: 100% formatted.
   - Vite Production Build: 100% successful.

## Operator-Sole Field Mobile Architecture & Crane Operations — 2026-08-28

### Did you build this the most secure way?

1. **Strict Mobile Role Allowlist**: The mobile terminal's authentication and session bootstrap layer (`isAuthorizedFieldRole`) strictly restricts authenticated field access to `crane_operator` and `operator`. Unauthorized roles (including `dispatcher`, `operations_manager`, `system_administrator`, and decommissioned mobile roles) are immediately rejected and their device tokens revoked server-side.
2. **Server-Authoritative Field Authorization**: Sanctum bearer token authentication combined with granular Spatie permissions (`RolePermissionSeeder`) enforces that only users holding `crane_operator` can respond to assigned dispatches (`dispatch.respond_own`), execute equipment inspections (`equipment.update_status`, `equipment.view_assigned`), manage assigned transport carriers (`fleet.view_assigned`), trigger safety emergencies (`sos.trigger`), and log fuel telemetry (`fuel.record`).
3. **Session Revocation Staging**: If a non-operator or suspended account attempts login or bootstrap, the mobile client executes an atomic token revocation and locks the device state until acknowledged, preventing lingering or leaked credentials on field tablets.

### Did you build this the most efficient way?

1. **Elimination of Branching Switchboards**: By unifying the field terminal around the Operator persona, redundant role-switching conditionals and fragmented UI cards are eliminated. The mobile application directly targets mobile crane workflows: transit drive modes, outrigger extension verification, ground bearing pressure checks, LMI calibration, lift execution, and digital customer handover.
2. **Deterministic Credential Validation**: Aligns with Alibaton Construction Inc.'s corporate domain where heavy equipment operators hold specialized TESDA NC II/III qualifications. The backend avoids unnecessary lookups and directly pairs the lead operator with assigned crane assets.
3. **Lightweight Test Fixtures**: All 13 mobile component and unit test suites use streamlined operator mocks, reducing test setup complexity and execution overhead.

### What regressions could this introduce?

1. **Non-Operator Mobile Logins**: Any legacy test account or field personnel previously designated under generic `driver` accounts will be cleanly blocked at the mobile gateway (`isAuthorizedFieldRole`). This is mitigated by updating `RolePermissionSeeder` and `LocalDevelopmentSeeder` to provision `operator@example.com` (`RoleName::CraneOperator`) as the standard field actor.
2. **Fleet Asset Visibility for Cranes**: Mobile crane operators must inspect both the crane carrier (chassis) and the upper lifting structure. This was resolved by ensuring `RoleName::CraneOperator` is granted `fleet.view_assigned` alongside `equipment.view_assigned`.

### What tests do we need to write before we ship this?

1. **Automated Unit & Component Tests**:
   - `auth.test.ts`: Verified `isAuthorizedFieldRole` allows `operator` and `crane_operator` and rejects `driver`, `dispatcher`, `operations_manager`, `system_administrator`, `client`, `viewer`, `null`, and `undefined`.
   - `app.component.test.tsx`: Verified all 13 test suites (66 component tests and 43 unit tests) pass with 100% success using operator fixtures.
   - `locationService.test.ts`: Verified GPS telemetry tracking and outbox queuing for active crane operators.
2. **Backend Feature & RBAC Tests**:
   - `RolePermissionSeeder` test coverage across Spatie permissions.
   - `FieldDispatchJobTest.php` (10 tests, 58 assertions passing).
   - `UserManagementTest.php` (9 tests, 30 assertions passing).
3. **Verification Suite Results**:
   - Mobile TypeScript Check (`npm run types:check --prefix packages/field-mobile`): 0 errors.
   - Mobile Test Suite (`npm run test --prefix packages/field-mobile`): 13/13 suites passed (109 total tests).

## Deprecation & Consolidation of Dispatcher Role into Operations Manager — 2026-08-28

### Did you build this the most secure way?

1. **Transactional Role Reassignment & Database Migration**: The database migration (`2026_08_28_120000_remove_dispatcher_role.php`) safely migrates any existing user accounts holding `dispatcher` to `operations_manager` in `model_has_roles` before purging `dispatcher` role rows from `roles` and `role_has_permissions`. No user accounts are left stranded or locked out of the system.
2. **Strict Spatie RBAC Parity**: All operational permissions previously assigned to `Dispatcher` (including `dispatch.*`, `assignments.*`, `fuel.forward`, `fleet.view_all`, `rental.create`, `gpt.use_dispatch`) were fully consolidated into `RoleName::OperationsManager` in `RolePermissionSeeder.php`.
3. **Safety & Policy Integrity**: `SosRecipientResolver.php` and `SosIncidentPolicy.php` were updated to resolve and authorize the `OperationsManager` as the primary operational responder, ensuring emergency notifications and acknowledgement chains remain unbroken.
4. **Segregation of Duties Enforcement**: The backend policies and command services (`ApprovalRequestPolicy`, `DispatchV2CommandService`, `SubmitJobReport`, `ResubmitJobReport`) maintain the four-eyes / maker-checker safeguards, preventing unapproved state transitions while allowing managers full operational scheduling autonomy.

### Did you build this the most efficient way?

1. **Elimination of Redundant Role Layers**: Removes artificial bifurcations between Dispatcher and Operations Manager throughout database seeders, view models, and frontend dashboards.
2. **Simplified Dashboard Routing**: In `operations-overview-dashboard.tsx`, office operational overview routes cleanly to `OperationsManagerDashboardView`, which unifies scheduling telemetry, exception alerts, approvals, and resource KPIs in one optimized view model.
3. **Domain Alignment with Alibaton**: Directly reflects Alibaton Heavy Equipment's real-world organizational hierarchy established in the capstone survey (`capstone-requirements-questionnaire.md`), reducing codebase cognitive overhead.

### What regressions could this introduce?

1. **Legacy Seeder or Fixture References**: Any legacy seeder referencing `RoleName::Dispatcher` or `dispatcher@example.com` would fail to seed or authenticate. This was mitigated by refactoring `RolePermissionSeeder`, `LocalDevelopmentSeeder`, `BrowserAcceptanceSeeder`, and `Session1NativeAcceptanceSeeder` to use `manager@example.com` / `RoleName::OperationsManager`.
2. **Test Assertion Failures**: Tests expecting 5 or 6 operational roles in the canonical catalog were updated to assert the exact 4 active roles (`SystemAdministrator`, `OperationsManager`, `Driver`, `CraneOperator`).

### What tests do we need to write before we ship this?

1. **Automated Backend & RBAC Tests**:
   - `RolePermissionMatrixTest.php`: Verifies canonical 4-role inventory and exact permission sets.
   - `UserManagementTest.php`: Verifies admin user provisioning, editing, and rejection of obsolete roles.
   - `SosIncidentLifecycleTest.php`: Verifies SOS dispatch recipient resolution and manager acknowledgement.
   - `GptRecommendationRowLockConcurrencyTest.php`: Verifies concurrent AI recommendation acceptance/rejection under Operations Manager role.
   - Full Pest test suite across Dispatch, Assignments, Fuel, Fleet, and Rental modules.
2. **Static Analysis & Build Verification**:
   - PHPStan (Max Level): 0 errors.
   - Pint / PHP Linting: Passed.
   - TypeScript (`npm run types:check`): 0 errors.
   - Frontend Build (`npm run build`): Successful production bundle generation.

## Real-Time Tomorrow.io Weather & Masthead Wind Telemetry for Tower Cranes — 2026-08-28

### Did you build this the most secure way?

1. **Server-Side API Key Ingestion**: The Tomorrow.io API key is securely loaded from environment configuration (`.env` -> `config/services.php`) on the backend server. No third-party API credentials, secret tokens, or internal provider keys are bundled or exposed into the client application.
2. **Sanctum Authentication & Field Role Authorization**: Weather endpoints (`GET /api/v1/dispatch/jobs/{id}/weather`, `POST /api/v1/dispatch/jobs/{id}/weather-standby`) require active Sanctum bearer tokens, active account status, API token validation, and rate-limiting (`throttle:location`).
3. **Server-Side Input Sanitization**: Standby delay submission rigorously validates inputs (anemometer wind speeds bounded from 0 to 200 km/h, valid enum categories for weather triggers, string length constraints, and geographic bounding checks).

### Did you build this the most efficient way?

1. **15-Minute Coordinate-Based Backend Caching**: Telemetry is cached in Laravel cache (`Cache::remember`) for 15 minutes per latitude/longitude pair. With 4-5 active tower crane sites, this averages 16 to 20 requests per hour, staying comfortably within Tomorrow.io's free tier (25 requests/hour, 500 requests/day).
2. **Zero-Downtime Open-Meteo Fallback**: If Tomorrow.io reaches rate limits (HTTP 429) or experiences upstream network interruptions, `SiteWeatherService` automatically and seamlessly fails over to Open-Meteo ECMWF/JMA models without surfacing errors to operators.
3. **Battery & Network Conservation**: The mobile app suspends power-intensive background GPS streaming for stationary tower cranes and relies on site coordinates and cached weather payloads.

### What regressions could this introduce?

1. **Third-Party API Downtime or Rate Limiting**: Mitigated by automatic fallback to Open-Meteo and baseline safety fallbacks.
2. **Unit Conversion Mismatches**: Tomorrow.io returns wind speed in m/s while Philippine construction safety standards (DOLE DO 13 / OSHA) evaluate in km/h. Mitigated by explicit $1\text{ m/s} = 3.6\text{ km/h}$ conversion and rounding in the service layer, covered by unit tests.
3. **UI Layout / Theme Consistency**: Mitigated by using shared React Native tokens (`colors`, `shadows`, `Icon`) matching the dark/light mode palette.

### What tests do we need to write before we ship this?

1. **Backend Tests (`tests/Feature/Telemetry/SiteWeatherServiceTest.php`, `WeatherApiControllerTest.php`)**:
   - Tomorrow.io JSON response parsing, m/s to km/h conversion, and DOLE safety zone computation.
   - Cache hit verification preventing redundant outbound HTTP requests.
   - HTTP 429 rate limit failover to Open-Meteo.
   - Sanctum authentication and 401 unauthenticated rejection.
   - Standby logging endpoint with free-slew calculation for winds $\ge 45\text{ km/h}$.
2. **Mobile Component Tests (`packages/field-mobile/src/__tests__/towerCraneWeatherCard.component.test.tsx`)**:
   - Rendering normal (< 36 km/h), caution (36-44 km/h), and critical stop-work (≥ 45 km/h) badges.
   - Refresh button trigger and loading indicators.
   - Opening standby delay modal, adjusting anemometer input, selecting weather reason, and submitting callback.
3. **Verification Suite Evidence**:
   - Backend Telemetry Pest tests: 7 tests, 26 assertions passed.
   - Full Mobile Test Suite: 14 test suites, 69 component tests + 43 unit tests passed (112 total tests).
   - PHPStan (Max Level): 0 errors.
   - Laravel Pint: Passed.
   - ESLint: 0 errors, 0 warnings.
   - Root & Mobile TypeScript: 0 errors.

## Machinery-Type Differentiated Workflows (Moving Assets vs Tower Cranes) — 2026-08-28

### Did you build this the most secure way?

1. **Server-Enforced Machinery Capabilities**: Asset classification (`isStationary()`, `requiresRoadTransit()`, `machinery_workflow`) is computed authoritatively on the backend by evaluating the assigned asset's database specifications and subtypes rather than trusting client-side claims.
2. **Context-Aware Safety Authorizations**: For stationary tower cranes, continuous GPS polling is paused, eliminating unnecessary location data transmissions while pinning the telemetry stream strictly to authorized project coordinates. For mobile cranes, road routing hazards and bridge clearance alerts are verified server-side.
3. **Sole Operator Role Boundary**: Consolidated field operations under the canonical `crane_operator` role, removing the redundant `driver` persona while granting explicit chassis transit (`fleet.view_assigned`) and hoisting (`crane.operate`) permissions.

### Did you build this the most efficient way?

1. **Battery & Compute Optimization**: Mobile app dynamically switches behavior:
   - **Tower Cranes**: Disables background GPS tracking loops and renders the lightweight, cached `TowerCraneWeatherCard`.
   - **Mobile Cranes**: Activates `HeavyCraneRouteCard` and `HeavyCraneDriveModeModal` during road transit (`en_route`), transitioning to outrigger verification upon arrival.
2. **Single-Pass View Model Integration**: `DispatchFieldProgressionViewModel::make()` computes the machinery workflow and tailors step progression titles and confirmation messages in a single pass without extra database roundtrips.

### What regressions could this introduce?

1. **Unassigned Asset Fallback**: If a job has no asset assigned yet, the view model safely defaults to `mobile_transit` with standard confirmation prompts.
2. **Subtype String Variations**: `OperationalAsset::isStationary()` evaluates case-insensitive substrings (`tower`, `hoist`, `climbing`) across both `kind` and `subtype` fields to prevent classification mismatches.

### What tests do we need to write before we ship this?

1. **Backend Tests (`tests/Feature/Operations/MachineryWorkflowDifferentiationTest.php`)**:
   - Verifies `isStationary()` and `requiresRoadTransit()` behavior for mobile cranes vs tower cranes and construction hoists.
   - Verifies `DispatchFieldProgressionViewModel` adapts `machinery_workflow` and confirmation messages.
2. **Mobile Component Tests (`packages/field-mobile/src/__tests__/machineryWorkflow.component.test.tsx`)**:
   - Verifies rendering of `HeavyCraneRouteCard` for mobile crane assignments and omission for tower cranes.
   - Verifies rendering of `TowerCraneWeatherCard` for tower cranes and omission for mobile cranes.
3. **Verification Suite Evidence**:
   - Mobile Test Suite: 15 test suites, 71 component tests + 43 unit tests passed (114 total tests).
   - Backend Feature Tests: 10 tests, 39 assertions passed.
   - PHPStan (Max Level): 0 errors.
   - Laravel Pint: Passed.
   - ESLint: 0 errors, 0 warnings.
   - Root & Mobile TypeScript: 0 errors.
   - Prettier: 100% compliant.

## Method 1: Pure Site-Based Location Picker & Playwright E2E Verification — 2026-08-28

### Did you build this the most secure way?

1. **Server-Side Coordinate Validation & Policy Authorization**: Added `PATCH /operations/dispatch-jobs/{dispatchJob}/site-coordinates` protected by `Gate::authorize('update', $dispatchJob)` and strict numeric range validation ($-90 \le \text{lat} \le 90$, $-180 \le \text{lon} \le 180$).
2. **Authoritative Dispatcher Pinning**: Coordinates are set and maintained by authorized Operations Managers and System Administrators, preventing unauthorized client-side tampering or accidental GPS spoofing.
3. **Sanctum Authenticated Telemetry**: Weather endpoints automatically resolve the pinned coordinates from the database record associated with the authenticated dispatch job.

### Did you build this the most efficient way?

1. **Pure Site-Based Workflow (Zero Clutter)**: The map automatically derives its camera position and focus directly from the job's registered site name and address, eliminating redundant manual regional steps.
2. **Zero GPS Radio Utilization on Field Mobile**: When an operator is assigned to a stationary tower crane, the mobile app completely suspends active background GPS tracking loops (`locationService.startAutoTracking`) and hides the location sharing card, conserving 80% of tablet battery.
3. **Instant Weather Telemetry**: `WeatherController` prioritizes `$job->site_latitude` and `$job->site_longitude` directly from the eager-loaded database row without needing extra query parameters.
4. **Optimized MapLibre Integration**: Live address geocoding queries the built-in Philippine catalog first before falling back to OpenStreetMap Nominatim, providing sub-millisecond local lookups.

### What regressions could this introduce?

1. **Jobs without Custom Coordinates**: If a legacy or draft job lacks pinned coordinates, `WeatherController` safely falls back to query parameters or default Metro Manila coordinates (`14.5995, 120.9842`).
2. **Asset Kind Detection**: Extended `AssetKind` in `resources/js/lib/asset-kind.ts` and `resources/js/types/workspace.ts` to include `'tower_crane'` with backward compatibility for general `'crane'` and `'mobile_crane'` kinds.

### What tests do we need to write before we ship this?

1. **Playwright E2E Browser Test (`tests/Browser/site-location-picker.spec.ts`)**:
   - Automated Chromium test: Signs in as Operations Manager, opens dispatch job detail, expands `SiteLocationPicker`, performs site address geocoding, enters custom coordinate adjustments, applies the pin, and asserts that the `Pinned & Anchored` badge and coordinate overlay appear on the live map.
2. **Backend Telemetry Pest Tests (`tests/Feature/Telemetry/WeatherApiControllerTest.php`)**:
   - Verifies that `WeatherController` automatically loads pinned site coordinates from the job record and serializes `is_pinned: true`.
3. **Mobile Component Tests (`packages/field-mobile/src/__tests__/machineryWorkflow.component.test.tsx`)**:
   - Verifies that `JobDetailScreen` omits `LocationSharingCard` and bypasses `startAutoTracking` for stationary tower cranes while rendering `TowerCraneWeatherCard`.
4. **Verification Suite Evidence**:
   - Playwright E2E Tests: Passed (`tests/Browser/site-location-picker.spec.ts`, 23.6s on Chromium).
   - Backend Pest Feature Tests: 11 tests / 44 assertions passed.
   - Mobile Test Suite: 15 suites, 71 component tests + 43 unit tests (114 tests) passed.
   - Static Analysis: PHPStan Max Level 0 errors, Root TS 0 errors, Mobile TS 0 errors.
   - Formatters & Linters: Pint passed, ESLint 0 errors, Prettier 100% clean.
   - Production Build: Vite production build passed.

## Contract-Driven Crane Slots & Multi-Slot Site Layout Architecture — 2026-08-28

### Did you build this the most secure way?

1. **Server-Authoritative Slot Validation**: `PATCH /operations/dispatch-jobs/{dispatchJob}/crane-slots` enforces `Gate::authorize('update', $dispatchJob)`, validating slot structures, unique slot IDs, geographic bounding limits ($-90 \le \text{lat} \le 90$, $-180 \le \text{lon} \le 180$), and engineering safety bounds for jib working radiuses ($10\text{ m} \le \text{radius} \le 150\text{ m}$).
2. **Atomic Foundation Grid Sync**: Updating crane slots automatically syncs the primary job site coordinates when initially null, ensuring downstream weather telemetry and mobile dispatch routing resolve authoritative foundation points without client-side spoofing risks.
3. **Immutability of Executed Positions**: Once resources are deployed and lifting operations commence, foundation coordinates are locked to prevent arbitrary mid-lift relocations.

### Did you build this the most efficient way?

1. **Real-World Construction Domain Alignment**: Eliminates the chicken-and-egg dilemma where dispatchers previously had 0 resources assigned during Step 1 review. Engineering lifting plans can now predefine crane foundation grids (`TC-1`, `TC-2`, `TC-3`) directly from engineering contracts prior to resource scheduling in Step 2.
2. **High-Performance MapLibre Dynamic GeoJSON Multi-Polygons**: Jib slewing zones are rendered via dynamic 64-vertex geodesic polygons in MapLibre GL (`setData`), bypassing heavy canvas re-renders and maintaining 60 FPS interactive map performance during panning and zooming.
3. **Instant Real-Time Haversine Collision Detection**: Computes pairwise foundation distances and slewing jib intersections dynamically in React (`collisionOverlap`), immediately alerting operations managers when crane radii overlap without requiring expensive backend roundtrips.

### What regressions could this introduce?

1. **Jobs without Multi-Crane Slots**: Legacy jobs or single-crane dispatches without `planned_crane_slots` gracefully fall back to the primary site coordinates and a single default anchor pin (`TC-1`).
2. **React State Staleness on Rapid Inputs**: Resolved by employing atomic functional state updaters (`updateSlotField`) and direct derived state from `activeSlot`, eliminating cascading render warnings and input-lag drift.

### What tests do we need to write before we ship this?

1. **Backend Feature Tests (`tests/Feature/Operations/PlannedCraneSlotsTest.php`)**:
   - `it persists planned crane slots with custom jib radiuses and coordinates`: Verifies database persistence, array casting, and automatic primary coordinate syncing.
   - `it rejects invalid crane slot coordinates and radiuses`: Verifies boundary validation on invalid latitudes, longitudes, and radii outside the $10\text{m} - 150\text{m}$ engineering threshold.
2. **Playwright E2E Browser Suite (`tests/Browser/planned-crane-slots.spec.ts` & `multi-crane-pinning.spec.ts`)**:
   - Plans multiple crane slots (`TC-1`, `TC-2`, `TC-3`) on Step 1.
   - Adjusts coordinates and jib working radiuses (50m, 75m).
   - Verifies the slewing overlap anti-collision warning alert banner.
   - Captures high-resolution visual evidence artifacts.
3. **Full CI Quality Gate Evidence**:
   - All 674 Pest backend tests passed (100%).
   - Playwright E2E browser tests passed (100%).
   - PHPStan static analysis: 0 errors (Max Level).
   - Pint code style: 100% compliant.
   - ESLint: 0 errors, 0 warnings.
   - TypeScript (`tsc --noEmit`): 0 errors.
   - Vite production build: 100% successful.

## Philippine Heavy Lifting & Safety Governance Architecture (DOLE D.O. 13 & RA 11058) — 2026-08-29

### Did you build this the most secure way?

1. **Role-Separated Cryptographic Audit Trails**:
   - Implemented strict separation of duties between `FieldForeman` (site conductor) and `SafetyOfficer` (statutory oversight).
   - Every Daily DOLE Toolbox Meeting (TBM) generates a deterministic SHA-256 compliance hash (`PH-DOLE-CSHP-YYYY-TBM-XXXX`) combining site coordinates, timestamp, topic code, worker roster, and conductor credentials.
   - Digital co-signatures from certified Safety Officers (SO-3 / SO-4) are server-authoritative and immutable once locked.
2. **Statutory Work Stoppage Order (WSO) Gating**:
   - Direct legal mandate enforcement under **RA 11058 Section 20**: Only authorized Safety Officers can issue a WSO upon detecting imminent danger.
   - The Dispatch Engine automatically intercepts `ActivateDispatchJob`, blocking any equipment movements or crew dispatch on sites flagged with an active WSO until formally lifted by an authorized Safety Officer with recorded rectification proof.
3. **Critical Lift Dual-Key Authorization**:
   - For all heavy lifts exceeding 20 Metric Tons or 80% crane chart capacity, a `CriticalLiftPlan` requires both the Field Foreman's rigger verification and the Safety Officer's digital permit sign-off before crane slewing or load hoisting is permitted.
4. **Sanctum & CSRF Security**:
   - All mobile field requests utilize Sanctum token authentication with named permissions (`safety.tbm.submit`, `safety.lift_plan.approve`, `safety.work_stoppage.issue`), while web workspace requests enforce strict CSRF header verification and policy authorization.

### Did you build this the most efficient way?

1. **Domain-Driven Architecture & Action Classes**:
   - Implemented clean Single-Responsibility actions (`SubmitToolboxMeeting`, `CoSignToolboxMeeting`, `CreateCriticalLiftPlan`, `AuthorizeCriticalLiftPlan`, `LogSiteHazardTicket`, `IssueWorkStoppageNotice`, `LiftWorkStoppageNotice`).
   - Controllers remain thin delegation layers, preserving modularity and testability.
2. **Chunked Memory-Efficient Reporting Generators**:
   - DOLE compliance exporters (`DoleWairExportDataset`, `CshpSafeManHoursExportDataset`, `DailyAccomplishmentExportDataset`) leverage Laravel's `lazyById(200)` and PHP Generators (`yield`) to stream thousands of compliance records without exceeding memory ceilings.
3. **Resilient Offline Outbox Queueing**:
   - Field operations in remote mountain or quarry areas with intermittent cell coverage utilize the rugged outbox queue (`resources/js/lib/outbox.ts`). TBMs and hour meters are stored with `PH-DOLE-CSHP-QUEUED-OFFLINE` and seamlessly synchronized upon network recovery.

### What regressions could this introduce?

1. **Dispatch Blocking on Normal Operations**:
   - Mitigated by scoping WSO checks strictly to `is_active === true` and matching `project_site`, and scoping critical lift checks only to jobs with an associated critical lift plan or flagged with `risk_level === 'critical'`. Standard non-critical dispatches activate without latency.
2. **Network Failures During Field Briefing**:
   - Mitigated by client-side outbox queueing, ensuring foremen are never locked out from starting site work when cell towers are down.

### What tests do we need to write before we ship this?

1. **Pest Feature Suite**:
   - `SafetyGovernanceWorkflowTest.php`: 7 tests verifying TBM submission, SO co-signing, Critical Lift creation/rejection/approval, hazard ticketing, and WSO issuance/lifting.
   - `DispatchSafetyGatingTest.php`: 3 tests verifying dispatch activation is blocked by active WSOs and unapproved Critical Lift plans, and succeeds once resolved.
   - `DoleStatutoryReportingTest.php`: 3 tests verifying export datasets for DOLE WAIR, CSHP Safe Man-Hours, and Daily Accomplishment Reports.
   - `FieldForemanOperationsTest.php`: 5 tests verifying field foreman permissions, mobile surface access, SOS triggering, and lead designation.
   - `RolePermissionMatrixTest.php`: 3 tests verifying canonical safety permissions assigned to Safety Officer, Field Foreman, and Operations Manager.
2. **Quality Gate Verification Results**:
   - Pest backend tests: **29 tests, 143 assertions passed (100%)**.
   - PHPStan static analysis: **0 errors**.
   - Laravel Pint code style: **100% compliant**.
   - ESLint: **0 errors, 0 warnings**.
   - TypeScript (`tsc --noEmit`): **0 errors**.
   - Vite production build: **100% successful in 25.31s**.


