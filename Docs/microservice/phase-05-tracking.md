# Phase 5 — Extract Tracking & Telemetry microservice (Plan A: apps/tracking)

Prerequisite: Phase 4 reviewed and integration contracts stable. Existing development location data is not imported or deleted.

## Source and Domain Ownership

- **Target Service**: `apps/tracking` (standalone high-throughput API service).
- **Target Storage**: `core2_ms_tracking` (isolated storage using `latest_locations`, `location_samples`, and `command_receipts`).
- **Source Relocation**: Location ingestion, `location_samples` persistence, latest-location projections, and 30-day coordinate pruning are owned by `apps/tracking`.
- **Weather Decoupling**: `LocationWeatherController` and `LocationWeatherService` remain within Operations (`app/Platform/Weather/`) as external weather API adapters, decoupling weather lookups from telemetry ingestion.
- **Relational Decoupling**: Tracking maintains zero foreign keys to Operations. Operational entities travel as scalar integer IDs (`user_id`, `dispatch_job_id`, `operational_asset_id`) with b-tree indexes.

## Architecture & Telemetry Ingestion Flow

The telemetry flow is strictly **Operations-mediated**:
```
Field Mobile Client ──[HTTPS + Sanctum]──► Operations BFF (/api/v1/locations)
                                                 │
                                                 ▼ [TrackingClientInterface]
                                         ┌───────┴───────┐
                     TRACKING_SERVICE_DRIVER=http        TRACKING_SERVICE_DRIVER=database / fake
                                 │                               │
                                 ▼                               ▼
                      Tracking Microservice               Local Operations DB / Memory
                   (/internal/v1/locations)
```

1. **Client Telemetry Submission (`POST /api/v1/locations`)**:
   - `packages/field-mobile` submits location updates to Operations BFF.
   - Authenticated with Sanctum bearer token and `Idempotency-Key` (UUIDv4).
   - Operations validates driver authorization, active assignments, and shifts.
2. **Operations-to-Tracking Internal Ingestion (`POST /internal/v1/locations`)**:
   - Operations delegates telemetry ingestion via `TrackingClientInterface`.
   - When configured with `TRACKING_SERVICE_DRIVER=http`, `HttpTrackingClient` transmits the payload to Tracking signed with canonical HMAC-SHA256 (`X-Service-Name`, `X-Timestamp`, `X-Payload-Digest`, `X-Signature`, `X-Command-Id`).
3. **Latest Locations Query (`GET /internal/v1/locations/latest`)**:
   - Consumed by Operations BFF to hydrate dispatch workspace live map views.
   - Supports query filtering by `user_id`, `operational_asset_id`, and `dispatch_job_id` with bounded limits (default 500, max 1000).
4. **Historical Range Query (`GET /internal/v1/locations`)**:
   - Consumed by Operations Compliance Reporting (`LocationAuditExportDataset`) with bounded pagination and time filters.

## Deterministic Driver Selection

Operations resolves `TrackingClientInterface` through strict deterministic matching (`TRACKING_SERVICE_DRIVER`):
- `http`: Uses `HttpTrackingClient` to delegate telemetry and queries to `apps/tracking` over the network with HMAC-SHA256 signature verification.
- `database`: Uses `DatabaseTrackingClient` for single-service deployments, querying the local database.
- `fake`: Uses in-memory `FakeTrackingClient` for lightweight unit and feature testing without network or database dependencies.
- **Default Resolution**: Unset driver defaults to `fake` in testing environments and `database` in local/production. Unrecognized driver strings throw an immediate `InvalidArgumentException`.

## Outage Resilience & Zero Split-Brain Ingestion

- **No Split-Brain Ingestion**:
  - In production, secondary database fallback during Tracking outages is strictly prohibited (`TRACKING_ALLOW_INGEST_FALLBACK=false`).
  - Dual authoritative writes are eliminated: Operations never writes coordinates to local storage when the microservice is the authoritative target.
- **Outage Handling (HTTP 503)**:
  - If Tracking is unreachable or returns a server error, Operations catches `TrackingServiceUnavailableException` and immediately responds to the mobile client with `HTTP 503 Service Unavailable` and a `Retry-After: 5` header.
  - Audit logging and Reverb workspace broadcasts are cleanly bypassed on outage.
- **Mobile Offline Queue Preservation**:
  - Receiving HTTP 503 instructs `packages/field-mobile` to retain pending telemetry samples in its persistent SQLite outbox, retrying with exponential backoff once connectivity is restored.

## Coordinate Privacy & 30-Day Retention

- **Automated Retention Pruning (`location:prune`)**:
  - Scheduled daily in `apps/tracking`. Coordinates (`latitude`, `longitude`, `accuracy_metres`, `speed`) older than 30 days (`captured_at < NOW() - 30 days`) are nullified, while preserving non-coordinate audit metadata.
- **Delayed Offline Sample Redaction**:
  - When field devices reconnect after extended offline periods, samples where `captured_at` is already older than 30 days have their coordinates redacted to null immediately upon ingestion, upholding statutory data privacy while recording the audit event.
- **Clock Drift & Future Timestamp Validation**:
  - Ingestion requests with `captured_at` timestamps exceeding 300 seconds into the future are rejected with `HTTP 422 Unprocessable Entity`.

## Concurrency & Idempotency Guarantees

- **HMAC Request Verification**: Requests must provide `X-Service-Name`, `X-Timestamp` (within 300s window), `X-Payload-Digest` (SHA-256 of raw body), and `X-Signature`. Insecure placeholder secrets (`test-tracking-service-secret`, etc.) or secrets shorter than 16 characters are rejected with HTTP 500 in production.
- **Atomic Upserts & Duplicate Suppression**: Ingestion transactions in Tracking wrap command receipt creation and projection updates atomically. Concurrent delivery of identical `command_id` payloads rolls back on key collision and retrieves the cached receipt response, guaranteeing exactly-once persistence. Mismatched payloads with the same `command_id` return `HTTP 409 Conflict`.
