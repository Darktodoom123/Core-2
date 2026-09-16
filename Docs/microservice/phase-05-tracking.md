# Phase 5 — Extract Tracking & Telemetry microservice (Plan A: apps/tracking)

Prerequisite: Phase 4 reviewed and integration contracts stable. Existing development location data is not imported or deleted.

## Source and Domain Ownership

- **Target Service**: `apps/tracking` (standalone high-throughput service).
- **Target Storage**: `core2_ms_tracking` (isolated storage using Redis for live position cache and partitioned PostgreSQL or TimescaleDB for telemetry history).
- **Source Relocation**: Move location ingestion, `location_samples` persistence, latest-location projections, and 30-day coordinate pruning from `app/Platform/Tracking` into `apps/tracking`.
- **Weather Decoupling**: `LocationWeatherController` and `LocationWeatherService` remain within Operations (`app/Platform/Workspace/` or `app/Platform/Weather/`) as external weather API adapters, decoupling weather lookups from telemetry ingestion.
- **Relational Decoupling**: Remove cross-database Eloquent relationships (`belongsTo` User, DispatchJob, OperationalAsset) from Tracking. Operational entities travel as scalar integer IDs (`user_id`, `dispatch_job_id`, `operational_asset_id`) with b-tree indexes.

## Endpoints and Contracts

1. **Direct Mobile Telemetry Ingestion (`POST /v1/locations`)**:
   - High-throughput endpoint consumed directly by `packages/field-mobile`.
   - Authenticated via scoped mobile telemetry token issued by Operations upon shift start.
   - Body: `command_id` (UUID), `dispatch_job_id` (nullable integer), `operational_asset_id` (nullable integer), `latitude`, `longitude`, `accuracy_metres`, `sharing_enabled` (boolean), `captured_at` (UTC RFC3339), `remarks` (optional bounded string).
   - Writes directly to Redis (latest position) and appends to partitioned PostgreSQL (`location_samples`), bypassing Operations database write load.
2. **Operations Internal Ingestion (`POST /internal/v1/locations`)**:
   - Fallback ingestion from Operations BFF for browser workspace updates or synchronized offline batches.
   - Authenticated via signed assertion (HMAC-SHA256 or short-lived JWT).
3. **Latest Locations Query (`GET /internal/v1/locations/latest`)**:
   - Consumed by Operations BFF to hydrate the dispatch workspace live map.
   - Fetches cached current positions directly from Redis / latest projections. Operations hydrates entity names (asset code, operator name) in memory.
4. **Historical Range Query (`GET /internal/v1/locations`)**:
   - Consumed by Operations Compliance Reporting (`LocationAuditExportDataset`) with bounded pagination and time filters.

## Batches

1. **Service Scaffolding & Database Partitioning**:
   - Scaffold standalone Laravel service in `apps/tracking` with dedicated `composer.json`, `artisan`, and environment config.
   - Create migrations in `core2_ms_tracking` for `location_samples`, `latest_locations`, and `command_receipts`.
   - Implement PostgreSQL table partitioning by month on `location_samples(captured_at)` to optimize high-throughput write performance and enable efficient 30-day retention pruning.
2. **High-Throughput Ingestion & Redis Caching**:
   - Implement `POST /v1/locations` and `POST /internal/v1/locations` with `command_receipts` duplicate suppression.
   - Store latest position in Redis with key `tracking:latest:{user_id}` and `tracking:asset:{operational_asset_id}`.
   - Replay protection: enforce monotonic timestamp validation so an older replayed GPS sample cannot overwrite a newer position.
   - Sharing state control: explicit sharing-off (`sharing_enabled = false`) instantly deletes the Redis latest-position key; delayed or replayed samples cannot turn sharing back on.
3. **Operations BFF Integration & Decoupling**:
   - Implement `HttpTrackingClient` in Operations implementing `TrackingClientInterface`.
   - Update `OperationsWorkspaceController` and `OperationsWorkspaceViewModel` to fetch live map markers from `HttpTrackingClient::getLatestLocations()` instead of querying the primary database.
   - Operations broadcasts `WorkspaceUpdated` on Reverb upon receiving confirmed telemetry from Tracking.
   - In test environments, bind `FakeTrackingClient` in Operations service container to keep existing Operations test suites passing without requiring an active Tracking daemon.
4. **Mobile Client Dual-Target Routing**:
   - Update `packages/field-mobile/src/services/apiClient.ts` to route dispatch, shifts, DVIR, and HoS calls to Operations, and GPS telemetry updates (`sendLocationUpdate`) to the Tracking service URL.
   - Maintain offline queuing in mobile SQLite: buffered samples are sent in batches to Tracking when network connectivity is restored.
5. **Automated 30-Day Coordinate Privacy Pruning**:
   - Implement `location:prune` console command in `apps/tracking`.
   - Schedule daily execution at 02:15 UTC. Nulls or truncates coordinates older than 30 days (`captured_at < NOW() - INTERVAL '30 days'`) while preserving anonymized audit timestamps.

## Phase 2 Modernization: Asynchronous Redis Streams & Read Replicas

### 1. Asynchronous Telemetry Ingestion (Redis Streams)

To decouple mobile response latencies from database write locks during peak morning dispatch bursts, telemetry ingestion transitions to a durable, message-driven stream architecture:

- **Stream Definition**:
  - Stream Key: `telemetry.gps.v1`
  - Consumer Group: `tracking-ingest-workers`
  - Dead Letter Queue (DLQ): `telemetry.gps.dlq`
  - Stream Capping: `MAXLEN ~ 100000` (bounded memory footprint in Redis 7)
- **Operations Publishing Flow (`POST /api/v1/locations`)**:
  - Sanctum token authentication and role/permission verification (`tracking.share_own`).
  - Strict input validation and active dispatch job / asset assignment boundary checks.
  - Generates canonical HMAC-SHA256 signature over sorted payload: `STREAM\n{stream_key}\n{timestamp}\n{digest}`.
  - Appends to `telemetry.gps.v1` via `XADD` with max length capping (`MAXLEN ~ 100000`).
  - **Network I/O Boundary**: Stream publishing occurs strictly outside database transactions.
  - **Client Response**: Returns HTTP `202 Accepted` acknowledging durable queuing. If Redis is unavailable, returns HTTP `503 Service Unavailable`, prompting `packages/field-mobile` to retain samples in its persistent SQLite outbox.
- **Tracking Ingestion Daemon (`tracking:consume-telemetry`)**:
  - Resilient CLI daemon reading via `XREADGROUP` into the `tracking-ingest-workers` group.
  - Processes batches inside ascending user ID row locks (`LatestLocation::lockForUpdate()`) to prevent deadlock contention across concurrent workers.
  - Strict idempotency via `tracking_command_receipts` table on `command_id` with payload SHA-256 conflict detection.
  - Acknowledges processed messages via `XACK`.
  - **Pending Entries List (PEL) & DLQ**: Inspects pending unacknowledged entries via `XPENDING` / `XCLAIM`. Samples exceeding 3 delivery attempts are automatically routed to `telemetry.gps.dlq` and acknowledged on the primary stream.
  - **Security & Privacy Guardrails**: Validates HMAC signatures; immediate coordinate nullification on delayed offline samples older than 30 days (`[COORDINATES_PURGED_RETENTION_EXPIRED]`); sanitized logs omit coordinates, tokens, and secrets.
- **Process Topology**:
  - Configured in `infra/docker/tracking-supervisord.conf` with 2 parallel consumer worker processes (`[program:tracking-telemetry-consumer]`).

### 2. Database Read Replicas for Fleet Dispatch

- **Configuration**:
  - Configured in `apps/tracking/config/database.php` on the `pgsql` connection with separated `read` and `write` host pools (`DB_READ_HOST` / `DB_HOST`).
  - Configured with `'sticky' => true` to guarantee immediate read-after-write consistency within the same request lifecycle.
- **Query Routing**:
  - High-frequency live dispatch reads (`GET /internal/v1/locations/latest` and `GET /internal/v1/locations/history`) query read replicas.
  - Ingestion writes (`LocationController::ingest` and `TelemetryIngestService`) strictly target the primary database via `onWriteConnection()` and transactions.
  - **Bounded Response Guarantees**: Enforces limits (default 250, capped at 1,000) on latest positions and paginated boundaries on historical track logs.

