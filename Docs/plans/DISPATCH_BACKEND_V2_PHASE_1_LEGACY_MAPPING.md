# Dispatch Backend V2 Phase 1 Legacy-to-Target Mapping

## Scope

This mapping is the Phase 1 compatibility boundary. It describes the additive
foundation only; legacy reads and writes remain active until a later adapter
phase. No legacy column, enum value, audit event, or client-side outbox record
is deleted or rewritten.

The current application has one operational workspace and no persisted tenant
or workspace owner relation. New canonical rows therefore carry
`workspace_key = operations` as an explicit compatibility scope. This value is
not an authorization boundary; later work must introduce and enforce a real
workspace owner relation before multi-workspace behavior is enabled.

## Legacy inventory

| Legacy surface | Current identity and semantics | Phase 1 target | Preservation rule |
| --- | --- | --- | --- |
| `dispatch_jobs` | Job identity, legacy lifecycle (`draft`, `pending_approval`, `scheduled`, `dispatched`, `accepted`, `en_route`, `arrived`, `working`, `completed`, `cancelled`), schedule, optimistic `version` | One `dispatch_handoffs` row and one `dispatch_execution_attempts` row per legacy job | Keep the job and all legacy columns active. Store the original status and job id on the canonical rows. |
| `dispatch_jobs.source_type/source_id` and `service_request_id` | Directional polymorphic/source link; source id can be absent or inconsistent | `dispatch_handoffs.source_type/source_id/source_reference` plus `legacy_dispatch_job_id` | Prefer the source record's current reference, retain the legacy job reference in the snapshot, and create a finding for invalid, duplicate, asymmetric, or mismatched links. |
| `rental_reservations.dispatch_job_id`, `sales_orders.dispatch_job_id` | Source-side back-reference for rental/sales dispatch | Same canonical handoff, with source-side back-reference checked for symmetry | Never update source back-references during reconciliation. A mismatch is a finding. |
| `sales_orders.reference` | Sales references are currently up to 64 characters while legacy dispatch source references are only 48 | Canonical handoff `source_reference` is 128 characters | Read the source record directly so a long reference is not copied from a truncated legacy dispatch column. |
| `dispatch_jobs.scheduled_start/scheduled_end` | Legacy timestamp window; existing rental handoff uses an end-of-day boundary | Attempt and plan-version timestamp windows | Preserve valid intervals. Invalid or reversed intervals remain in the legacy snapshot, canonical window fields are null, and a blocker finding is recorded. |
| `dispatch_personnel_assignments` | Job-scoped personnel assignment with `pending/accepted/rejected`, nullable active interval, response metadata | `dispatch_assignment_offers` scoped to attempt and plan version | Map response status explicitly; do not infer mandatory or lead from assignment type or job status. Keep the legacy assignment id. Asset assignments remain separate and are not offers. |
| `approval_requests` | Polymorphic job approval/override history | `dispatch_plan_approvals` bound to one immutable plan version | Copy every dispatch-job approval without changing the legacy request. Non-dispatch approval subjects remain legacy-only and are not silently treated as plan approvals. |
| `audit_events` | Polymorphic audit history with request/correlation metadata | `dispatch_audit_lineage` links legacy events to canonical handoff/attempt/plan/offer/idempotency rows where possible | Audit rows are immutable source history. Unrelated legacy audit rows receive an explicit out-of-scope lineage record rather than being dropped. |
| `command_logs` | User-scoped UUID idempotency ownership and cached response | `dispatch_idempotency_keys` with explicit workspace/owner/key identity | Copy ownership, action, payload hash, expected version, status, response, and legacy log id. The existing service remains the runtime path. |
| `packages/field-mobile` command outbox | Durable client-side retry queue; no server table | No new server outbox in Phase 1 | Preserve the client protocol and only inventory its idempotency key as a future source of canonical ownership. |
| `dispatch_jobs.deleted_at` | Legacy archive/soft-delete behavior allowed on non-terminal statuses | Attempt `archived_at` only for terminal legacy rows; retain non-terminal deletion in compatibility metadata | Do not turn a non-terminal legacy archive into a V2 terminal archive. Record a finding for that conflict. |

## Legacy status mapping

The original value is always retained as `legacy_status` on the attempt.

| Legacy status | Canonical attempt status | Compatibility state |
| --- | --- | --- |
| `draft` | `draft` | `legacy_direct` |
| `pending_approval` | `draft` | `legacy_pending_approval_derived` |
| `scheduled` | `draft` | `legacy_scheduled_derived` |
| `dispatched` | `dispatched` | `legacy_direct` |
| `accepted` | `dispatched` | `legacy_job_accepted_derived` |
| `en_route`, `arrived`, `working`, `completed`, `cancelled` | Same value | `legacy_direct` |
| null or an unknown value | `draft` | `legacy_invalid_status` plus a blocker finding |

`accepted` never becomes an attempt state or a job-level V2 meaning. An
accepted legacy job is represented as a dispatched attempt while its original
value remains visible in `legacy_status`; assignment-offer acceptance is
copied only from the legacy assignment response.

## Reconciliation guarantees

- Each batch is ordered by legacy primary key and records a per-source
  checkpoint in `dispatch_reconciliation_runs`.
- Canonical identity is keyed by the legacy dispatch job, assignment,
  approval, command-log, and audit-event ids; reruns use those keys and do not
  create duplicates.
- The command accepts a bounded limit and can resume a running run. It never
  deletes legacy or canonical rows.
- Findings are stable by source/entity/code fingerprint. Invalid or
  unexplained records are reported with evidence and are never silently
  coerced into a valid source, interval, lead, or approval.
- The canonical lead pointer starts empty unless an explicit legacy lead fact
  exists. Phase 1 does not infer a lead from a role, assignment type, or first
  acceptance.
