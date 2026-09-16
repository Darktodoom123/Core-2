# Target architecture and shared invariants (Plan A: 2-Service Model)

Status: implemented 2-service architecture specification; local verification complete, production deployment pending. Updated: 2026-09-15.

## 1. Service Ownership & Boundaries

The approved architecture is **Plan A: The Pragmatic 2-Service Model**, comprising the **Core Operations Service** and the **Tracking & Telemetry Microservice**, with dedicated internal background queue workers for AI recommendations and compliance reporting.

| Service / Component | Authoritative Data & Domain Responsibilities |
| --- | --- |
| **Core Operations Service**<br>(`apps/operations`) | **Stack:** Laravel 13 + Inertia 3 + PostgreSQL (`core2_ms_operations`).<br>**Authoritative Domain:** Users, authentication (Sanctum tokens, sessions, CSRF), roles & permissions (Spatie), dispatch planning & approvals, crane and heavy equipment management, fleet assets, crew/driver assignments, Hours of Service (HoS) & statutory DOLE 10h fatigue rules, DVIR walkaround inspections & immediate critical defect safety lockouts, fuel requests & logs, rental agreements & reservations, sales orders, safety & SOS incidents, business attachments, field job reports and meter updates, operational audit, Web & Mobile Backend-For-Frontend (BFF), and Reverb real-time workspace updates.<br>**Internal Queue Workers:** Dedicated worker pools for OpenRouter AI recommendations (`ai` queue) and compliance reporting (`reports` queue). |
| **Tracking & Telemetry Microservice**<br>(`apps/tracking`) | **Stack:** Dedicated high-throughput service + isolated storage (Redis / partitioned PostgreSQL / TimescaleDB) (`core2_ms_tracking`).<br>**Authoritative Domain:** High-frequency mobile GPS sample ingestion, live position caching for dispatch maps, historical coordinate tracking, automated 30-day coordinate privacy pruning, ingestion command receipts, and local telemetry audit.<br>**Isolation Purpose:** Isolates heavy mobile GPS write traffic from the primary dispatch database. |

### Client Applications Topology

1. **Web Client (Inertia 3 + React 19)**: Talks directly to Operations for all authenticated operational workspace views, dispatch management, equipment tracking maps, and report generation.
2. **Mobile Client (`packages/field-mobile` Expo React Native)**:
   - Talks exclusively to **Operations BFF** for all actions: shift lifecycle, driver assignments, HoS status transitions, DVIR walkaround inspections, job execution, safety/SOS reports, and GPS telemetry submission (`POST /api/v1/locations`).
3. **Operations Backend-For-Frontend (BFF)**:
   - Authenticates mobile clients via Sanctum bearer tokens and validates shift/job assignments.
   - Forwards telemetry to Tracking via `TrackingClientInterface` (`HttpTrackingClient` when `TRACKING_SERVICE_DRIVER=http`).
   - Orchestrates operational live map views by querying Tracking's `GET /internal/v1/locations/latest` and broadcasting position updates to web clients over Laravel Reverb.

### Internal Worker Isolation Rationale (No 4-Service Overhead)

- **OpenRouter AI Recommendations**: `app/Platform/Gpt/Services/OpenAiClientWrapper.php` is an external API wrapper around OpenRouter LLM endpoints. Extracting AI into an isolated microservice would introduce unnecessary RPC latency, serialization overhead, and distributed failure modes for what is fundamentally an outbound third-party API call. Instead, AI generation remains within Operations on a dedicated asynchronous queue worker (`ai` queue). This isolates third-party LLM latency, timeouts, and rate limits from interactive dispatch operations while preserving transactional assignment row locking in `AcceptGptRecommendation`.
- **Compliance Reporting**: Compliance reports (DOLE WAIR, CSHP safe man-hours, demurrage, fuel logs, weekly fuel consumption, maintenance logs, daily accomplishment) require comprehensive relational joins across dispatch, equipment, crew, and safety tables. An isolated reporting microservice would necessitate synchronizing massive event projections or creating fragile cross-database queries. Instead, reporting runs within Operations on a dedicated background queue worker (`reports` queue). For coordinate audit datasets (`LocationAuditExportDataset`), Operations queries Tracking via internal HTTP API, ensuring transactional consistency and preventing memory-intensive report generation from starving interactive HTTP requests.

---

## 2. Repository Layout & Isolated Storage

### Monorepo Repository Layout

```
Core-2/
├── apps/
│   ├── operations/          # Core Operations Service (Laravel 13 + Inertia 3 + React 19)
│   └── tracking/            # Tracking & Telemetry Microservice (Laravel 13 API)
├── packages/
│   └── field-mobile/        # React Native / Expo field client
└── infra/
    └── docker/              # Multi-stage Docker Compose topology & configs
```

### Database Isolation & Schemas

- **Operations Database (`core2_ms_operations`)**: Dedicated PostgreSQL 16+ database housing all operational schemas (auth, dispatch, fleet, equipment, HoS, DVIR, fuel, safety, reports, gpt metadata, queue jobs).
- **Tracking Database (`core2_ms_tracking`)**: Dedicated database with isolated storage:
  - Redis 7 for high-speed latest-location lookups and geospatial caching.
  - Partitioned PostgreSQL (or TimescaleDB) for append-only `location_samples` with monthly partitions to support high-throughput ingestion and instant 30-day data drops.
- **Test Databases**: Suffix with `_test` (`core2_ms_operations_test`, `core2_ms_tracking_test`).
- **Isolation Invariants**:
  - Services access only their own database credentials. No shared database users, cross-database foreign keys, or cross-database SQL joins.
  - Operational entity references (`user_id`, `dispatch_job_id`, `operational_asset_id`) in Tracking travel as unconstrained scalar integers with local b-tree indexes.
  - Existing development databases and uploads are strictly preserved; fresh schemas and synthetic fixtures are used for development and testing.

---

## 3. Communication & Integration

### Communication Protocols

```
┌────────────────────────────────────────────────────────┐
│                      Web Client                        │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS (Inertia 3) / WSS (Reverb)
                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Core Operations Service                         │
│                           (apps/operations)                            │
│  ┌──────────────────────────┐            ┌──────────────────────────┐  │
│  │     AI Queue Worker      │            │   Reports Queue Worker   │  │
│  │       (queue: ai)        │            │     (queue: reports)     │  │
│  └────────────┬─────────────┘            └──────────────────────────┘  │
└───▲───────────┼────────────────────────────────────────▲───────────────┘
    │           │                                        │
    │ HTTPS     │ OpenRouter API                         │ Scoped Internal HTTP
    │ (Sanctum) │ (External LLM)                         │ (HMAC-SHA256 Signed)
    │           ▼                                        │ (/internal/v1/locations/*)
    │   ┌─────────────────────────┐                      │
    │   │     OpenRouter API      │                      │
    │   └─────────────────────────┘                      │
    │                                                    │
┌───┴───────────────────────┐                            │
│    Field Mobile Client    │                            │
│  (packages/field-mobile)  │                            │
│  (Offline SQLite Outbox)  │                            │
└───────────────────────────┘                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Tracking & Telemetry Microservice                    │
│                            (apps/tracking)                             │
│        ┌─────────────────────────┐     ┌───────────────────────┐       │
│        │    latest_locations     │     │   location_samples    │       │
│        │   (Current Positions)   │     │  (30-Day Retention)   │       │
│        └─────────────────────────┘     └───────────────────────┘       │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Client -> Operations**:
   - Web Client interacts via standard Inertia 3 requests over HTTPS and receives real-time UI pushes via Laravel Reverb WebSockets.
   - Mobile Client interacts via REST API over HTTPS authenticated with Sanctum bearer tokens for dispatch jobs, shift clocking, DVIR inspections, SOS alerts, and telemetry ingestion (`POST /api/v1/locations`).
2. **Operations BFF <-> Tracking Microservice**:
   - Telemetry ingestion is Operations-mediated: Operations validates driver shifts and active assignments before delegating to `TrackingClientInterface`.
   - Driver selection via `TRACKING_SERVICE_DRIVER`:
     - `http`: `HttpTrackingClient` transmits signed HMAC-SHA256 requests (`POST /internal/v1/locations`).
     - `database`: `DatabaseTrackingClient` executes queries against the local database for single-service topologies.
     - `fake`: `FakeTrackingClient` provides in-memory test doubles for deterministic automated testing.
   - Live map hydration: Operations BFF queries Tracking (`GET /internal/v1/locations/latest`) and broadcasts position updates via Reverb.
   - Compliance reporting: Operations queries Tracking (`GET /internal/v1/locations`) for coordinate audit datasets.
3. **Operations Internal Queues & Dedicated Worker Topology**:
   - Internal asynchronous tasks run on Laravel's queue system backed by PostgreSQL (`jobs` table) or Redis, split across isolated worker pools to guarantee starvation immunity:
     - `default` (`default,high`): Core operational dispatch transitions, resource assignments, transactional notifications (`SendQueuedNotificationJob`), and telemetry broadcasting.
       - Worker command: `php artisan queue:work --queue=default,high --sleep=3 --tries=3 --max-time=3600` (timeout: 60s, retry_after: 90s).
     - `ai`: Asynchronous GPT recommendations (`GenerateGptRecommendationJob`), proactive recommendation sweeps (`SweepProactiveGptRecommendationsJob`), and recommendation retention pruning (`PruneGptRecommendationsJob`).
       - Worker command: `php artisan queue:work --queue=ai --timeout=120 --tries=3 --sleep=3 --max-time=3600` (retry_after: 150s).
     - `reports`: Long-running CSV and mPDF dataset exports (`GenerateReportExportJob`, up to 300s runtime) and export retention pruning (`PruneExpiredExportsJob`).
       - Worker command: `php artisan queue:work --queue=reports --timeout=360 --tries=2 --sleep=3 --max-time=3600` (retry_after: 420s).
   - **Starvation Immunity Guarantee**:
     - Operational dispatchers, safety alerts, and telemetry updates are never delayed or blocked behind long-running mPDF PDF renders or external OpenRouter LLM timeouts. Each worker pool operates with dedicated timeouts and process boundaries.
   - RabbitMQ is eliminated. No external broker infrastructure is required.

### Idempotency & Command Receipts

- All mutating API endpoints require an `X-Command-Id` header (UUIDv4).
- Tracking and Operations maintain local `command_receipts` tables storing `(command_id, actor_id, action, payload_hash, response_body, created_at)`.
- Retrying with the same command ID and matching canonical payload hash returns the stored HTTP response (200/201).
- Submitting a conflicting payload with an existing command ID returns HTTP 409 Conflict.

---

## 4. Security, Authorization & Privacy

### Authentication & Authorization Authority

- Operations is the single source of truth for user identities, passwords, sessions, CSRF, Sanctum bearer tokens, and Spatie roles/permissions.
- APP_KEY and users/credentials tables are never shared with Tracking.
- Service-to-service internal requests between Operations and Tracking use signed request assertions (HMAC-SHA256) with:
  - Headers: `X-Service-Name: operations`, `X-Timestamp`, `X-Payload-Digest` (SHA-256 of raw body), `X-Signature`.
  - Timestamp validity window: 300 seconds.
  - Secret hardening: Development placeholder secrets (`test-tracking-service-secret`, etc.) and secrets shorter than 16 characters are rejected with HTTP 500 in production environments.
- Ingestion requests with future `captured_at` timestamps exceeding 300s clock drift tolerance are rejected with HTTP 422.

### Coordinate Privacy & Retention Rules

- Precise location coordinates expire **30 days** after `captured_at`.
- Tracking runs an automated daily pruning job (`location:prune`) at 02:15 UTC that nulls coordinates older than 30 days while preserving non-identifying audit metadata.
- Delayed offline samples older than 30 days have their coordinates redacted to null immediately upon ingestion.
- When an operator turns sharing off (`sharing_enabled = false`), the latest-position projection is immediately cleared. Replayed or delayed GPS samples cannot re-enable sharing; state transitions require an explicit user action with a monotonic server-issued timestamp.
- Application logs never contain raw GPS coordinates, authentication tokens, prompt bodies, or personal identifiers. Correlation IDs (`X-Correlation-Id`) are logged instead.

---

## 5. Failure Boundaries & Resiliency

1. **Tracking Outage & Zero Split-Brain Ingestion**:
   - Tracking unavailability must never prevent dispatch job creation, resource assignments, HoS shift operations, DVIR walkarounds, or emergency SOS incident dispatch.
   - Operations live map handles Tracking 503/timeout gracefully by displaying a non-blocking "Telemetry unavailable / showing cached positions" warning state.
   - **Zero Split-Brain Ingestion**: In production (`TRACKING_ALLOW_INGEST_FALLBACK=false`), Operations strictly prohibits falling back to secondary local database writes during Tracking outages. Dual authoritative writes are eliminated.
   - Operations returns `HTTP 503 Service Unavailable` with `Retry-After: 5`, allowing the mobile client to retain unacknowledged samples in its persistent SQLite outbox and retry with exponential backoff once Tracking recovers.
2. **OpenRouter External AI Outage**:
   - Outages, rate limits, or slow responses from OpenRouter do not impact dispatch workflows.
   - `GenerateGptRecommendationJob` runs on the isolated `ai` queue worker. Failures record an error code in `gpt_recommendation_metrics` and leave dispatch proposals in a pending/failed state.
   - Human dispatchers can manually override or assign resources without waiting for AI recommendations.
   - Assignment acceptance (`AcceptGptRecommendation`) atomically locks `OperationalAsset` and `DispatchJob` rows, preventing race conditions or stale recommendations from causing double bookings.
3. **Compliance Reporting Load Spikes**:
   - End-of-month or regulatory export spikes run strictly on the dedicated `reports` queue worker.
   - Heavy memory usage or long-running PDF/Excel renders cannot exhaust memory or CPU on HTTP web servers or the primary dispatch worker.

---

## 6. Reference Guidance

- [Nx Incremental Adoption](https://nx.dev/docs/kb/adding-to-existing-project)
- [Docker Multi-Service Best Practices](https://docs.docker.com/build/building/best-practices/)
- [Laravel Queue Workers & Supervisors](https://laravel.com/docs/12.x/queues)
- [PostgreSQL Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html)
- [TimescaleDB Hypertables for Telemetry](https://docs.timescale.com/use-timescale/latest/hypertables/)
