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
