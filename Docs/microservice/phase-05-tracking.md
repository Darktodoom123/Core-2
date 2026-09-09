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

## Failure Boundaries & Acceptance

- **Tracking Outage**:
  - Outage of Tracking does not block dispatch creation, asset scheduling, crew assignments, HoS shift changes, DVIR safety walkarounds, or SOS alerts in Operations.
  - Operations live map shows an explicit "Live telemetry currently unavailable — displaying last known positions" banner.
- **Acceptance Tests**:
  - High-frequency burst test: simulate 1,000 GPS points/sec into `POST /v1/locations`; verify Redis latest positions update instantly and PostgreSQL partitions absorb writes without lock contention.
  - Deduplication test: re-sending the same `command_id` returns HTTP 200/201 with identical payload without inserting duplicate rows.
  - Sharing-off test: toggling sharing off clears the active position immediately; replaying old samples with `sharing_enabled = true` is rejected.
  - 30-day retention test: verify coordinates with `captured_at` > 30 days are purged by `location:prune`.
  - Operations workspace test suite passes using mocked `TrackingClientInterface`.
