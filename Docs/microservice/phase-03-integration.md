# Phase 3 — Contracts and reliable integration

Prerequisite: Phase 2 accepted; isolated Linux/PostgreSQL/RabbitMQ available. Follow shared envelope/authentication rules in architecture.md.

## Batches

1. Add packages/contracts with JSON schemas/OpenAPI and synthetic examples. Schemas are transport-only; generated TypeScript types cannot replace runtime validation. Resolve and pin maintained PHP messaging/JWT dependencies compatible with the locked runtime using current documentation; record exact versions before implementing adapters.
2. Create service-local outbox and inbox migrations plus canonical command receipt persistence. Outbox: event UUID, aggregate/version, payload, created_at, lease/attempts/next_attempt_at, published_at. Inbox unique producer/event_id plus processed_at. Receipts unique actor/action/command_id with payload hash and persisted response. Database constraints arbitrate concurrent duplicates.
3. Publish persistent integration events through durable exchange/consumer queues, with confirmations AND unroutable-return handling. Mark sent only after success; recover expired publisher leases. Each subscriber gets its own queue. Process inbox and local effects in one transaction, acknowledge afterward.
4. Add bounded exponential retry with jitter, dead-letter/quarantine ownership and operator replay. Define payload retention per topic; do not retain GPS/prompt bodies indefinitely. Consumer version checks reject unknown schema and prevent stale projection overwrite; gaps trigger reconciliation instead of inventing state.
5. Implement signed request authentication and scoped service authorization from architecture.md. Prove token expiry/audience/body/action/resource enforcement and key rotation. Asynchronous sensitive work checks current access through Operations. Keep broker and DB credentials restricted per caller.
6. Add trace/correlation propagation, lag/error/quarantine metrics and failure-injection harness. No credentials or sensitive bodies in logs.

## Contract verification before extraction

For each later phase, implement its declared schemas and synthetic examples before moving the business code. A missing field mapping is a contract-review blocker, not permission to forward entire models. Changes must include provider and consumer tests.

## Acceptance tests

Concurrent command duplicates; mismatched payload same command; crash after domain commit/before publish; broker confirmation lost; unroutable destination; crash after consumer commit/before ack; duplicate/out-of-order/gapped events; expired/wrong-scope assertions; malformed payload; key rotation; broker outage/recovery; quarantine/replay; privacy expiry during replay.

No exactly-once guarantee. Provider effects require their own idempotency strategy or bounded uncertainty. Stop before extraction if any failure can lose an acknowledged domain write, duplicate an operational effect, or bypass authorization.
