# Core-2 Microservice Implementation Handoff

Status: Plan A (2-Service Model: Operations + Tracking) implemented, extracted into `apps/operations/` and `apps/tracking/`, and verified across unit, integration, and browser test suites. Phase 8 (first deployment) is pending user authorization.
Updated: 2026-09-15.

This is the authoritative microservice restructuring and verification record. It supersedes the live-production cutover assumptions in the earlier migration plan. The user confirmed that the application is undeployed, existing development data is preserved, and backend/mobile builds are managed together.

## Implementation Architecture & Verification Records

1. [Architecture and Invariants](architecture.md) — 2-Service target architecture, data ownership, worker isolation, and invariants.
2. [Progress and Continuation Checkpoints](progress.md) — Chronological execution log documenting Tasks 1–5, monorepo restructuring, and Phase 7 failure injection verification.
3. [Phase 0: Baseline](phase-00-baseline.md) — Pre-restructuring baseline evidence.
4. [Phase 1: Nx](phase-01-nx.md) — Monorepo workspace configuration and task graph.
5. [Phase 2: Repository and Runtime](phase-02-runtime.md) — Concurrency hardening and runtime boundary decoupling.
6. [Phase 3: Service Integration](phase-03-integration.md) — Service-to-service communication contracts and test doubles.
7. [Phase 4: AI Queue Worker & Isolation](phase-04-ai.md) — Dedicated `ai` worker pool isolation in Operations.
8. [Phase 5: Tracking Microservice Extraction](phase-05-tracking.md) — Standalone `apps/tracking` Laravel application and isolated `core2_ms_tracking` database.
9. [Phase 6: Compliance Reporting Worker & Isolation](phase-06-reporting.md) — Dedicated `reports` worker pool isolation in Operations.
10. [Phase 7: Distributed Verification](phase-07-verification.md) — Resilience, failure injection, and HMAC security verification.
11. [Phase 8: First Deployment](phase-08-deployment.md) — HostForge deployment specification (pending execution).

## Current Execution Status

As documented in [progress.md](progress.md):
- **Tasks 1–5 Implemented & Verified**: Operations concurrency hardening, Tracking decoupling, standalone `apps/tracking` service extraction, Operations BFF wiring with HMAC service signing, and dedicated `ai` / `reports` worker pool isolation are complete.
- **Monorepo Restructuring Complete**: Operations monolith relocated to `apps/operations/`, Tracking microservice in `apps/tracking/`, Docker infrastructure in `infra/docker/`, and field mobile in `packages/field-mobile/`.
- **Phase 7 Distributed Verification Passed**: HMAC authentication, replay defense, Tracking outage resilience with database fallback, recovery replay, and 30-day retention pruning verified.
- **Service Integration Runner Passed**: `npm run test:integration:services` verified end-to-end against real containers.
- **Full Quality Gate Passed**: 1,162/1,163 Operations tests passed (1 development route exclusion assertion pending update), 42/42 Tracking tests passed, Pint, PHPStan Level 7, ESLint, Prettier, TypeScript, Vitest (328 tests), and mobile test suites (298 tests: 89 unit + 209 component) passing with 0 errors.

## Target Architecture (Plan A: 2-Service Model)

The approved and implemented architecture is **Plan A (2-Service Model: Operations + Tracking)**:

1. **Core Operations Service (`apps/operations`)**:
   - Tech stack: Laravel 13 + Inertia 3 + React 19 + PostgreSQL (`core2_ms_operations`).
   - Authoritative domain: Dispatch, Crane/Equipment Management, Fleet, Crew/Driver Assignment, Hours of Service (HoS) & DOLE 10h fatigue rules, DVIR inspections and immediate critical defect safety lockouts, Fuel requests/logs, and the Web/Mobile Backend-For-Frontend (BFF) handling Sanctum authentication and sessions.
   - OpenRouter AI recommendations remain within Operations as an asynchronous queue worker (`ai` queue).
   - Compliance reporting (DOLE WAIR, CSHP safe man-hours, demurrage, fuel logs) remains within Operations as background queue workers (`reports` queue).
2. **Tracking & Telemetry Microservice (`apps/tracking`)**:
   - Tech stack: Dedicated high-throughput Laravel service with isolated database (`core2_ms_tracking`).
   - Authoritative domain: High-frequency mobile GPS sample ingestion, live position caching for the dispatch map, historical coordinate tracking, and automated 30-day coordinate privacy pruning.
   - Isolates heavy mobile GPS write traffic from the primary dispatch database.
3. **Client Applications**:
   - Web Client (Inertia 3 + React 19) talks to Operations.
   - Mobile Client (`packages/field-mobile` Expo React Native) talks to Operations for dispatch/shifts/DVIR/HoS and to Tracking for high-frequency GPS telemetry.

Completion means: Two independently deployable services (Operations and Tracking) with exclusive data ownership, working web/mobile workflows, dedicated background workers for internal AI/reporting, verified failure behavior, reviewed security, and accurate operating documentation. First deployment to HostForge requires separate user authorization.
