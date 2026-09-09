# Phase 3 — Contracts and reliable integration (Plan A: Operations + Tracking)

Prerequisite: Phase 2 accepted; isolated Linux/PostgreSQL/Redis available. Follow shared envelope, authentication, and idempotency rules in architecture.md. RabbitMQ is eliminated.

## Batches

1. **Packages/Contracts Definition**: Add `packages/contracts` containing OpenAPI 3.1 specifications, JSON schemas, and synthetic payload examples for Tracking endpoints:
   - Telemetry ingestion (`POST /internal/v1/locations` and mobile `POST /v1/locations`).
   - Latest positions projection query (`GET /internal/v1/locations/latest`).
   - Historical location range query for compliance audit (`GET /internal/v1/locations`).
   - Generated transport DTOs for `packages/field-mobile`. Schemas are transport-only; runtime validation must be enforced on receivers.
2. **Idempotency & Command Receipts**: Create `command_receipts` migrations in Operations and Tracking:
   - Columns: `command_id` (UUID), `actor_id`, `action`, `payload_hash` (SHA-256), `response_body` (JSON), `status_code`, `created_at`.
   - Unique index on `(command_id, action)` enforces duplicate suppression. Replaying a matching command returns the stored response; mismatched payload returns HTTP 409 Conflict.
3. **Internal HTTP Client & Signed Authentication**: Implement secure inter-service communication between Operations BFF and Tracking:
   - Scoped signed assertions (HMAC-SHA256 with shared secret or short-lived asymmetric JWT over TLS): issuer `core2-operations`, audience `core2-tracking`, maximum 60-second validity (`iat`, `exp`, `jti`), HTTP method/path, and canonical payload SHA-256 digest.
   - Tracking middleware verifies assertions, rejects expired tokens, and enforces caller/action scope.
   - Operations BFF implements `TrackingClientInterface` with bounded exponential retry and jitter for transient network failures.
4. **Operations Internal Queue Worker Isolation**: Configure dedicated Laravel queue connections and worker pools backed by Redis:
   - Dedicated queues: `default` (operational workflows), `ai` (OpenRouter LLM calls), `reports` (compliance report exports).
   - Set `retry_after` strictly longer than job timeouts (`ai`: 120s timeout, 150s `retry_after`; `reports`: 300s timeout, 360s `retry_after`).
   - Standard dead-letter handling via Laravel's `failed_jobs` table with manual replay CLI.
5. **Observability & Health Checks**:
   - Add correlation ID (`X-Correlation-Id`) propagation across web, mobile, Operations BFF, internal queue workers, and Tracking.
   - Expose detailed readiness probes (`/up` and `/health`) checking PostgreSQL and Redis connectivity independently.
   - Guarantee that application logs redact raw GPS coordinates, authentication tokens, prompt bodies, and personal data.

## Contract Verification Before Extraction

Before extracting Tracking in Phase 5, all schemas, DTOs, and synthetic examples in `packages/contracts` must be validated against current Operations data shapes. A missing field mapping is a blocker, not permission to pass unvalidated Eloquent models. Provider and consumer contract tests must pass.

## Acceptance Tests

- Concurrent duplicate commands with identical payload return stored result (HTTP 200/201).
- Concurrent duplicate commands with altered payload return HTTP 409 Conflict.
- Signed assertion validation: expired assertion rejected (401), invalid audience rejected (403), tampered payload digest rejected (401), valid assertion accepted.
- Tracking outage resilience: Operations BFF gracefully handles Tracking 503/timeout without crashing or blocking dispatch/SOS transactions.
- Queue worker isolation: heavy tasks on `reports` or stalled requests on `ai` do not delay or block `default` queue job execution.
- Worker crash and recovery: killed worker reclaims locked jobs after `retry_after` without duplicate processing of completed work.
- Privacy compliance: coordinates older than 30 days are purged and never surfaced in contract test responses.
