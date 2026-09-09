# Phase 7 — Verify the 2-service distributed application (Plan A)

Prerequisite: All preceding phases reviewed and implemented. This gate cannot pass on SQLite or unit tests alone; it requires verification in the isolated Linux/PostgreSQL/Redis multi-container topology.

## Batches

1. **Environment Provisioning & Database Isolation**:
   - Provision fresh synthetic isolated Linux/PostgreSQL/Redis environment (`core2-ms`) with explicit connection parameters and dedicated service database roles (`core2_ms_operations` and `core2_ms_tracking`).
   - Verify that the Tracking service role cannot connect to or query `core2_ms_operations`, and Operations cannot access `core2_ms_tracking` directly.
   - Run concurrency suites requiring Linux `pcntl`: HoS active shift row locks, DVIR inspection safety lockouts, and dispatch resource assignment row locks.
2. **End-to-End Workflow Verification**:
   - Run complete suite of checks per service:
     - Operations: PHP lint (`composer lint:check`), PHP types (`composer types:check`), Pest tests (`php artisan test`), web lint/format/types/unit/build.
     - Tracking: PHP lint/types/tests and ingestion benchmarks.
     - Field Mobile: `npm run types:check:mobile` and `npm run test:mobile`.
   - Execute distributed end-to-end integration tests:
     - Dispatch job creation & equipment reservation.
     - Operator HoS shift start and duty status transitions.
     - Mobile DVIR walkaround inspection with immediate defect lockout.
     - Direct mobile GPS telemetry streaming to Tracking and real-time live map display in Operations web workspace via Reverb.
     - Asynchronous AI recommendation generation on `ai` queue and transactional dispatcher acceptance.
     - Asynchronous compliance report generation on `reports` queue (DOLE WAIR and CSHP safe man-hours) fetching telemetry history from Tracking.
3. **Resilience & Failure-Injection Harness**:
   - Simulate Tracking service outage (HTTP 503 / network partition): verify Operations web map displays non-blocking stale warning, and mobile app buffers GPS samples locally in SQLite without crashing.
   - Simulate OpenRouter external LLM outage/timeout: verify `GenerateGptRecommendationJob` fails cleanly into `gpt_recommendation_metrics` without delaying dispatch operations or the `default` queue.
   - Simulate worker process SIGKILL during active compliance report generation: verify supervisor restarts the worker and jobs are safely handled without data corruption.
   - Test idempotency under duplicate delivery with identical and altered payloads.
4. **Performance & Synthetic Workload Measurement**:
   - Ingest high-throughput mobile GPS traffic (1,000+ points/sec) into Tracking to prove write isolation from the Operations database.
   - Measure queue lag across `default`, `ai`, and `reports` workers under concurrent execution.
   - Measure memory profiles of DOLE WAIR and large CSV report exports to ensure memory limits (512MB) are respected.
5. **Dependency Audit & Vulnerability Triage**:
   - Reassess all dependency advisories against actual production code paths.
   - Address release-blocking findings with targeted, reviewed fixes and re-run all affected test suites.
6. **Independent Deployment Readiness**:
   - Rebuild and release one service container (e.g., Tracking) while the other (Operations) continues operating without downtime or schema lockstep.

## Acceptance Evidence

- Comprehensive verification results reviewed by Astra: no lost acknowledged writes, no duplicate operational effects, no cross-database foreign key dependencies, and no leakage of coordinates older than 30 days.
- Concurrency suites pass under real PostgreSQL with row-level locks.
- Service resilience proven under simulated component outages.
- ai-verification checklist completed with specific test evidence.
