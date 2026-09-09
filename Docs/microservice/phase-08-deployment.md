# Phase 8 — First deployment readiness

Prerequisite: Phase 7 accepted. Application is currently undeployed. HostForge is the chosen target, not a verified capability claim.

## Batches

1. Obtain authoritative platform/account evidence for independent HTTP/worker services, private networking, scoped secrets, persistent storage, RabbitMQ durability, database roles/backups/PITR, health probes, migration jobs, draining and rollback. Public page retrieval has not established these features. Do not substitute documentation from similarly named providers.
2. Produce a costed topology using Phase 7 workload evidence. Confirm operational owner, capacity budget, recovery targets, credentials/rotation, monitoring and alerts. If HostForge lacks a required capability, stop and present the specific gap; do not silently select another platform.
3. Rehearse backups/restores and cross-service reconciliation in isolated resources. Record times and data loss window; verify 15-minute RPO/four-hour RTO target feasibility. Document any shared-server/failure-domain limitations.
4. Prepare immutable image digests, environment placeholders, one-time migration jobs, synthetic staging provisioning and a release/rollback runbook. No demo defaults or test credentials in production.
5. Obtain explicit authorization before external staging deployment; then verify web and rebuilt mobile against staging and record results. Obtain separate explicit authorization before production deployment.
6. After authorized first deployment, verify critical workflows, health, queue lag, error rates and alerts. Record deployed digests and operational handover. No automatic old database/file deletion.

## Stop/acceptance

Missing hosting evidence, ownership/budget, failed restore drill, release-blocking advisory, or missing deployment authorization stops the affected external action. Local preparation can remain complete without claiming deployment.

Success means approved topology, verified staging, recoverable release, private data protection and operating runbooks. First deployment is a separate authorized action; this document itself does not authorize it.
