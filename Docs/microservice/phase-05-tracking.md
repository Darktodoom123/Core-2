# Phase 5 — Extract Tracking

Prerequisite: Phase 4 reviewed and integration tests stable. Existing development location data is not imported or deleted.

## Source and proposed contract

Move LocationUpdate persistence, location pruning and current-location/sharing projections from Operations Platform/Tracking into apps/tracking. Keep active dispatch/personnel/asset authorization in Operations. Remove Eloquent user/job/asset relationships from Tracking; scalar IDs reference Operations.

Internal POST /internal/v1/locations requires scoped signed assertion and stable command_id. Body: command_id, user_id, dispatch_job_id (nullable integer), operational_asset_id (nullable integer), latitude/longitude/accuracy_metres (nullable numeric), sharing_enabled (boolean), captured_at (UTC), remarks (nullable bounded string), source (field-mobile or browser). Reuse current validation bounds. Operations supplies actor/source from trusted context, never trusts a different client user_id.

Success returns 201 with data containing id, user_id, dispatch_job_id, operational_asset_id, latitude, longitude, accuracy_metres, sharing_enabled, captured_at, received_at, remarks. Matching retry returns the stored response; different payload with same scoped ID returns 409. Invalid input returns 422, invalid identity/scope 401/403, unavailable service 503 through the public adapter. Never return success for an uncommitted sample.

GET /internal/v1/locations and /internal/v1/locations/latest accept only authorized scoped filters and bounded pagination. Preserve current public /api/v1/locations shape through Operations unless a coordinated client change is reviewed.

## Batches

1. Create fresh location_samples, sharing_states, latest_locations, command receipts, audit/outbox/inbox tables. Preserve both timestamps and existing freshness thresholds; order current state deterministically so older captures cannot overwrite newer state.
2. Implement transactional persistence, response receipts and location.recorded/sharing.changed events. Sharing state has a server-issued monotonic version; replayed location samples cannot enable sharing. Explicit user sharing changes, not delayed sample arrival, control the sharing state.
3. Replace Operations storage calls with authenticated adapters; keep current assignment/resource checks before forwarding. Update workspace/realtime consumers to authorized projections/query results and remove raw-history reads from Operations.
4. Implement 30-day coordinate pruning across data/projections/replay; reject or scrub expired coordinates when replayed. Preserve allowed audit metadata. Use synthetic mobile offline batches and update transport types together.

## Failure/acceptance

An uncertain HTTP result is retried with the same command ID; no fallback local write. Tracking outage shows unavailable/stale map state without blocking dispatch/SOS. Keep pending client commands until definitive response according to the existing outbox lifecycle.

Test current location API/privacy/retention/workspace and mobile lifecycle suites plus concurrent duplicates, old captures, sharing-off/reconnect, asset/job mismatch, stale permissions, deletion replay and burst load. Review stale-state rules explicitly; stop if sharing-off can be reversed by delayed events or if coordinates leak into logs/expired exports.
