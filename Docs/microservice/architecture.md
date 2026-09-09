# Target architecture and shared invariants

Status: target specification, not current deployment. Updated: 2026-09-08.

## Ownership

| Service | Authoritative data and behavior |
| --- | --- |
| Operations | Users, permissions, Sanctum tokens, dispatch/planning/approvals, personnel and asset assignments, assets/reservations, fleet/equipment, fuel, Rental/Sales, HoS/DVIR, safety/SOS, business attachments, field job reports and meter updates, recommendation review/application, operational audit |
| Recommendations | Generation requests/runs, bounded input, immutable proposal results, provider usage/cost and generation audit |
| Tracking | Location samples, per-user sharing state, latest-location projection, captured/received times, retention, ingestion command receipts and local audit |
| Reporting | Analytical projections, source checkpoints, export requests/status, private export artifacts and export audit |

Operations remains the public backend for Inertia web and mobile. It authorizes current user actions and calls internal services. Reverb remains an Operations runtime receiving authorized presentation updates. Weather lookup can remain an Operations adapter; it is not another service.

Current evidence: asset availability locks the shared operational asset row; AcceptGptRecommendation locks/revalidates before assignment; SubmitJobReport updates asset meters in its transaction. Those operations stay local to Operations. Current Tracking validation queries dispatch/personnel/asset assignments, and current export datasets query multiple domains; moving their controllers unchanged would violate the target boundaries.

## Repository and data

Target layout: apps/operations, apps/recommendations, apps/tracking, apps/reporting; packages/field-mobile stays in place. packages/contracts contains integration schemas and generated transport types only. infra/compose contains the isolated local topology. No shared Eloquent/domain models or cross-service PHP job serialization.

Each service has its own Composer manifest/lock, migrations, image, app key, database role and credentials. Initial local PostgreSQL databases: core2_ms_operations, core2_ms_recommendations, core2_ms_tracking, core2_ms_reporting. Test databases add _test. The isolated Compose project is core2-ms. A shared local PostgreSQL server is permitted; service roles cannot access another service's database. No cross-database foreign keys or SQL joins.

Never point new services at existing core2 databases or copy their credentials. Create task-local credentials through a runtime secret facility; commit placeholders only. No automatic imports. Keep all original data, including uploads, untouched. Fresh schemas/fixtures replace live-production migration machinery.

Operational entity IDs remain the current integer IDs and travel as scalar references; generation requests, exports and integration events use UUIDs. Dates are UTC RFC3339 strings. Keep existing public field names when practical; no requirement to keep old development mobile builds working. Coordinate any changed transport types with rebuilt mobile.

## Communication

Clients -> Operations -> scoped internal HTTP for immediate requests.
Services -> local transactional outbox -> RabbitMQ -> consumer inbox/local transaction for asynchronous facts and generation work.
Reporting reads its own projections. Reverb is not the durable event bus.

Shared envelope fields: event_id (UUID), type (versioned name), schema_version (1), producer, occurred_at, correlation_id, causation_id (nullable), aggregate_type, aggregate_id (string), aggregate_version (positive integer), payload (schema-validated object). Command IDs are stable UUIDs across transport retries. Unknown schema versions are quarantined, not guessed.

Delivery is at least once. Persist domain changes and outbox together; publish persistent messages with confirmations and unroutable-return handling; persist inbox ID plus local effect together before acknowledging. Enforce uniqueness on producer/event_id per consumer. Reusing a command ID with a different canonical payload returns conflict. Payload hashing must use one deterministic documented representation, not incidental JSON key order.

Retries are bounded and use backoff; quarantine has alerts and operator-controlled replay. Per-aggregate versions prevent old events overwriting newer projections. No exactly-once provider or transport promise.

## Authorization and privacy

Keep login, session/CSRF, mobile tokens and permission decisions in Operations. Never distribute APP_KEY, users/token tables, or broad user bearer tokens to internal services.

Phase 3 uses asymmetric signed short-lived request assertions over TLS with a maintained JWT implementation: issuer Operations, exact service audience, subject user ID, action/resource scope, iat/exp (maximum 60 seconds), jti, HTTP method/path and canonical payload digest. Pin algorithms and trusted keys, rotate by key ID, strip externally supplied identity headers, and reject expired/wrong-audience/mismatched-body requests. Receivers enforce allowed caller/action/resource combinations. Retry deduplication is distinct from replay protection: a repeated valid command must return its stored result, never repeat the effect.

Service-originated calls use distinct service identities with narrow endpoints; user-scoped asynchronous export actions revalidate current access through Operations. Broker ACLs bind producers/consumers to their allowed routes. Never authorize from a claimed actor ID alone.

Precise location coordinates expire after 30 days measured from captured_at, including projections and replay. Sharing-off must suppress current display and delayed location events cannot turn sharing back on. Logs contain correlation IDs and redacted metadata, not credentials, raw GPS or prompt bodies. Private artifacts require current download authorization; a guessed path or possession of a stale status event grants no access.

## Failure boundaries

AI/Tracking/Reporting unavailability must not block dispatch/reservations/field reports/SOS. Use explicit unavailable/pending/stale UI states. Location submission does require durable Tracking acceptance; an uncertain result is retried by command ID, never written to a fallback Operations table.

Operations owns recommendation decisions atomically with assignments. AI results are inert proposals. Reporting owns export execution, while field reports remain Operations writes. Export completeness is stated through per-source watermarks; stale/incomplete projections cannot silently produce a report marked complete.

## Reference guidance

[Nx incremental adoption](https://nx.dev/docs/kb/adding-to-existing-project), [Docker container concerns](https://docs.docker.com/build/building/best-practices/), [transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html), [RabbitMQ confirms](https://www.rabbitmq.com/docs/confirms). These explain tooling/patterns; project-specific acceptance comes from the phase briefs.
