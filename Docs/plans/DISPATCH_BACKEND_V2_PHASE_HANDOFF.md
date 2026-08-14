# Dispatch Backend V2 Phase 1 Handoff

## Objective

Complete Phase 1 from the Phase 0 branch by adding the additive canonical persistence foundation for handoffs, execution attempts, immutable plan versions, assignment offers and lead metadata, idempotency ownership, audit lineage, and resumable reconciliation. Legacy rows, columns, runtime reads/writes, and lifecycle values remain preserved and active.

## Dependency and branch

- Required Phase 0 starting point: branch `codex/dispatch-backend-v2-phase-0`, commit `1b96db43be0c05abfa938631179240bf25abe783`.
- Phase 1 branch: `codex/dispatch-backend-v2-phase-1`.
- `START_SHA`: `1b96db43be0c05abfa938631179240bf25abe783`.
- Phase 7 is approved in the graph after Phase 6; Phase 1 does not implement UI/UX and does not unlock Phase 7.

## Decisions and boundaries

- Added only new canonical tables and relationships; legacy tables and runtime behavior remain unchanged.
- One canonical handoff is linked to one preserved legacy dispatch job and has one initial execution attempt. Replacement attempts are represented by an explicit `replaces_attempt_id` lineage.
- Target attempt status is limited to `draft`, `dispatched`, `en_route`, `arrived`, `working`, `completed`, and `cancelled`. `accepted` exists only on assignment offers; `pending_approval`, `scheduled`, and `ready` remain compatibility/derived concepts. No `on_hold` was added.
- Plan versions are immutable by schema shape (`created_at` only), content-hashed, and approval history is preserved without a same-kind uniqueness constraint.
- Mandatory/optional offer and lead designation fields are persisted, but reconciliation never infers either property from legacy data.
- `workspace_key=operations` is an explicit compatibility scope for this single-workspace application; it is not treated as a new authorization boundary.
- Source links preserve the canonical source type/id/reference, use the full Sales reference where available, and record findings for asymmetry, duplicates, invalid sources, and invalid intervals. Legacy values are never silently coerced or deleted.
- Idempotency ownership is scoped by workspace, owner type/id, and key. Legacy command logs remain in place; audit events and command logs receive canonical lineage links when resolvable.
- Reconciliation is bounded, resumable, idempotent, observable, dry-run capable, and non-destructive. Findings use stable fingerprints and warning/blocker severity.
- PostgreSQL-only status/interval checks are guarded in the migration because the local environment has no PostgreSQL server; SQLite coverage verifies the portable schema and relationships.
- No V2 command handlers, adapters, API cutover, mobile changes, or lifecycle read/write switches were introduced.
- The approved graph amendment is documentation-only in this phase: the plan and executor prompts now include `P6 -> P7`, the Phase 7 prompt, and `READY_FOR_PHASE_7`/`READY_GRAPH_COMPLETE` handoff fields.

## Explicit legacy-to-target mapping

See [DISPATCH_BACKEND_V2_PHASE_1_LEGACY_MAPPING.md](DISPATCH_BACKEND_V2_PHASE_1_LEGACY_MAPPING.md). It covers dispatch jobs, source links and reverse links, long Sales references, schedule intervals, personnel assignments, approvals, audit events, command logs/idempotency, archive semantics, workspace scope, and invalid-row findings.

## Files changed

- `database/migrations/2026_08_14_130000_create_dispatch_v2_persistence_foundation.php`
- `app/Modules/Dispatch/Enums/DispatchAttemptStatus.php`, `DispatchAssignmentOfferStatus.php`, `DispatchPlanApprovalStatus.php`, `DispatchPlanVersionStatus.php`, `DispatchReconciliationFindingSeverity.php`, `DispatchReconciliationRunStatus.php`
- Canonical models under `app/Modules/Dispatch/Models/` plus the `DispatchJob::canonicalHandoff()` relationship
- `app/Modules/Dispatch/Services/DispatchV2Reconciliation.php` and `app/Modules/Dispatch/Console/Commands/ReconcileDispatchV2Command.php`
- `app/Modules/Dispatch/DispatchServiceProvider.php` command registration
- Characterization and persistence tests under `tests/Feature/Operations/DispatchV2*`
- `Docs/plans/DISPATCH_BACKEND_V2_PHASE_1_LEGACY_MAPPING.md`
- Updated execution plan, executor prompts, this durable handoff, and `.ai-reports/ai-verification-questions.md`.

## Verification completed

- Red-first evidence: focused tests initially failed on missing canonical tables/command and invalid target status representation before implementation.
- `php artisan test --compact tests/Feature/Operations/DispatchV2LegacySchemaCharacterizationTest.php tests/Feature/Operations/DispatchV2PersistenceFoundationTest.php`: PASS, 7 tests, 79 assertions.
- Relevant dispatch/source/rental/sales/idempotency suite: PASS, 109 tests, 794 assertions.
- Full backend suite `php artisan test --compact`: PASS, 540 tests, 6,805 assertions.
- `composer run lint:check`: PASS.
- `composer run types:check`: PASS, 0 PHPStan errors.
- `composer audit --locked --no-interaction`: PASS, no security vulnerability advisories.
- `npm ci --no-audit --no-fund`: PASS; existing npm deprecation notices only.
- `npm run build`: PASS; existing Vite large-chunk warnings only. Frontend source was not changed in Phase 1.
- Fresh/rollback/reapply SQLite migration rehearsal: PASS. All migrations applied; Phase 1 rolled back with `dispatch_jobs` preserved and canonical tables absent; reapply restored both legacy and canonical tables. Temporary database removed.
- PostgreSQL suite attempt: BLOCKED by external dependency; all 4 configured tests failed before execution because `127.0.0.1:5432` refused connections for `core2_rental_sales_test`. The migration defers PostgreSQL-only checks safely behind the `pgsql` driver.
- `git diff --check`: PASS at implementation and documentation closeout.

## Review and security checkpoint

- Read-only review covers the full phase diff for additive compatibility, FK/index/cardinality protections, owner scoping, raw SQL safety, reconciliation retry behavior, source symmetry, approval history, lead/mandatory inference, archive terminality, and absence of lifecycle command cutover.
- The review fixture initially violated the required legacy-job FK; it was corrected while retaining the constraint. No critical or high-confidence unresolved issue remains.
- Security review confirms no new authorization bypass or external write path: reconciliation only writes canonical/reconciliation tables, leaves legacy runtime paths active, and treats `workspace_key` as compatibility scope rather than authorization.
- Rollback is additive: the migration down path removes only Phase 1 tables/lead columns and leaves all legacy tables and data intact.

## Known blockers and unresolved findings

- PostgreSQL verification requires an available PostgreSQL server/database with the configured `core2_app` credentials; exact failure is recorded above.
- Existing untouched mobile quality debt remains outside Phase 1: full `npm run lint:check` reports 39 errors in `packages/field-mobile`; full `npm run format:check` reports 5 files (`HeavyCraneRouteCard.tsx`, `field-header.tsx`, `notifications-sheet.tsx`, `profile-sheet.tsx`, `AssignedJobsListScreen.tsx`).
- No phase-caused blocker remains for Phase 2.

## Closeout fields

- `PHASE_STATUS=complete`
- `READY_FOR_PHASE_2=yes`
- `READY_FOR_PHASE_7=no` (Phase 6 is still required)
- `READY_GRAPH_COMPLETE=no` (Phase 7 remains after Phase 6)
- `CONTEXT_SPLIT_REQUIRED=no`
- Phase 1 implementation SHA: `19ce0da480661ee3a12d85e4f61a51fa56864db8` (`feat(dispatch): add v2 persistence foundation`).

## Next action

Phase 2 may begin from the clean Phase 1 implementation commit `19ce0da4c7b4ab09ddaa66309827dfc7c1fcd3d0`. Phase 7 remains dependency-gated on Phase 6 and must use the approved UI/UX prompt.
