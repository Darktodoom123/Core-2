# Phase 8 — First deployment readiness (Plan A: 2-Service Model)

Prerequisite: Phase 7 accepted. Application is currently undeployed. HostForge is the proposed hosting target, not a verified capability claim.

## Batches

1. **HostForge Capability & Infrastructure Verification**:
   - Obtain authoritative platform/account evidence for running two independent containerized services (Operations and Tracking), private service networking, scoped secrets management, persistent volume storage for business attachments/exports, managed PostgreSQL databases (`core2_ms_operations` and `core2_ms_tracking`), managed Redis 7 instance, health probes (`/up`), one-off migration execution, graceful process draining, and rollback mechanisms. RabbitMQ is eliminated under Plan A.
   - Public landing page retrieval has not established these features; verify directly through platform account access before provisioning.
2. **Costed 2-Service Topology & Resource Budgeting**:
   - Operations Service sizing: CPU and memory allocation for Nginx, PHP-FPM, Reverb, default worker, `ai` worker (256MB), and `reports` worker (512MB).
   - Tracking Service sizing: High-throughput HTTP ingestion and Redis memory allocation for active fleet coordinate caching.
   - Database sizing: Storage and IOPS for primary relational database and partitioned telemetry database with automated 30-day retention drops.
   - Establish operational ownership, recovery targets (15-minute RPO, 4-hour RTO), secrets rotation runbooks, and telemetry alerts.
3. **Backup, Restore, and Disaster Recovery Drills**:
   - Rehearse independent backup and point-in-time recovery (PITR) for `core2_ms_operations` and `core2_ms_tracking` in isolated staging resources.
   - Measure actual restore times and verify recovery objectives.
4. **Release Packaging & Deployment Runbooks**:
   - Produce immutable image digests for `apps/operations` and `apps/tracking`.
   - Prepare clean environment configuration templates with strict placeholder validation (no demo defaults or test credentials).
   - Define one-time migration execution scripts per service, zero-downtime deployment order, and automated rollback triggers.
5. **Authorized Staging Deployment & Multi-Client Verification**:
   - Obtain explicit authorization before provisioning external staging resources.
   - Deploy staging topology; verify Web (Inertia 3) and mobile app (`packages/field-mobile`) against staging endpoints.
   - Verify that mobile telemetry streams directly to the Tracking staging endpoint while dispatch and shift commands reach Operations staging.
6. **Production Deployment & Operational Handover**:
   - Obtain separate explicit authorization before production deployment.
   - Execute production release, run database migrations, verify health probes, inspect queue lag across `default`, `ai`, and `reports`, and verify Reverb WebSocket connections.
   - Record deployed image digests, Git revisions, and operational handoff documentation.
   - Existing development databases and local files are never automatically deleted.

## Stop and Acceptance

- Missing hosting platform capabilities, lack of cost approval, failed restore drills, or absence of explicit authorization halts external deployment actions. Local restructuring remains complete and valid without deploying.
- Success means: verified 2-service containerized topology, validated staging runbooks, recoverable release pipeline, strict private data isolation, and accurate production operating documentation. First deployment is an independent authorized action; this document itself does not authorize deployment.
