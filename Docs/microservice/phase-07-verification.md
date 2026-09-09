# Phase 7 — Verify the complete distributed application

Prerequisite: all extraction phases reviewed. This gate cannot pass on SQLite/unit tests alone.

## Batches

1. Provision fresh synthetic isolated Linux/PostgreSQL/RabbitMQ environment with explicit connection variables and scoped service roles. Run current reservation and AI row-lock concurrency suites; verify denied cross-service database connections.
2. Run complete PHP lint/static/tests per service, root web lint/format/types/unit/build, mobile types/tests/native checks, and relevant browser/a11y suites. Preserve command coverage through Nx. Add end-to-end tests for dispatch -> assignment -> mobile progress -> field report -> tracking display -> AI review -> exports.
3. Inject service outages and worker/broker crashes at documented acknowledgement boundaries. Verify Operations safety/dispatch invariants, eventual replay, idempotency, privacy, stale-data UI and traceability.
4. Measure representative synthetic workloads with recorded hardware/revision/data cardinality/concurrency/warm state. Report server/DB/browser time separately, GPS throughput/offline burst behavior, queue lag, export rows/time/memory and provider-mocked AI queue overhead. Provider latency/cost remains unverified without authorized measurement.
5. Triage all dependency findings against actual usage. Make targeted reviewed remediations and rerun affected tests; never force an audit downgrade or ignore a release-blocking finding merely to pass.
6. Exercise image rebuild/release of one service while compatible peers keep working; prove no shared source/DB schema deployment lockstep remains.

## Acceptance evidence

Astra reviews exact commands/results, failure injection traces and reconciliation totals. No lost acknowledged writes, duplicate operational effects, unauthorized reads, or replay resurrection of expired coordinates in tested scenarios. State test coverage limits honestly.

Existing proposed business targets are 99.5% monthly availability, 15-minute RPO and four-hour RTO; they are objectives, not observed facts. Production capacity/latency budgets require workload approval before Phase 8; local fixture timings cannot substitute.

Record remaining limitations and update required ai-verification answers for implemented major changes. Stop if any critical/high-confidence correctness/security finding remains unresolved. No live provider calls or external data operations without authorization.
