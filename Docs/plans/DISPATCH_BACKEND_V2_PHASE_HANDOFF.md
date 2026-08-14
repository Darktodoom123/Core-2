# Dispatch Backend V2 Phase 2 Handoff

## Objective

Complete Phase 2 from the exact Phase 1 session head by adding the shared, typed V2 command/query layer for execution lifecycle and readiness. Existing web/mobile adapters and legacy runtime writes remain on their compatibility path; no adapter cutover is claimed.

## Dependency, branch, and commits

- Required Phase 1 source branch: `codex/dispatch-backend-v2-phase-1`.
- Required Phase 1 session head and `START_SHA`: `3f70d9c501c5c0bfbb4f445b286e08a1cbf4f63b`.
- Phase 2 branch: `codex/dispatch-backend-v2-phase-2`.
- `IMPLEMENTATION_SHA`: `b8a80257cc9751f83303e47a7651efb18c71e425` (`feat(dispatch): add v2 lifecycle commands and readiness`).
- `HANDOFF_SHA`: recorded by the closeout commit containing this handoff and the four AI verification responses.

## Decisions and boundaries

- Canonical execution state is limited to `draft`, `dispatched`, `en_route`, `arrived`, `working`, `completed`, and `cancelled`. No new job-level `accepted` or `on_hold` value exists.
- `DispatchV2Commands` and `DispatchV2CommandService` expose create, plan submit, plan approve, dispatch, progress, cancel, reopen, archive, and readiness operations. Progress accepts only `DispatchAttemptStatus`; assignment acceptance remains an offer concern.
- `DispatchV2TransactionEnvelope` performs feature-flag validation, workspace-scoped aggregate reload, handoff-then-attempt locking, command-boundary authorization, replay ownership/payload checks, expected-version checks, mutation, one audit row plus canonical lineage, one after-commit aggregate event, and idempotency completion in one database transaction.
- Replays are scoped by `workspace_key`, actor owner type/id, and key. The payload hash includes action, aggregate, expected version, reason, and command payload. A completed replay returns the original resource without a second mutation, audit row, lineage row, or event; mismatched reuse returns `idempotency_payload_mismatch`.
- Authorization is enforced inside the command boundary and policy. Cross-workspace or missing objects use the same safe `object_not_found` response. Progress requires the designated accepted lead or an authorized override with a reason; no actor is trusted from a caller-supplied user id.
- Readiness is a read-only projection with typed blocker codes, safe evidence, deterministic contract ordering, and derived `scheduled`, `awaiting_approval`, and `ready` labels. Dispatch reevaluates it while the aggregate and readiness children are locked.
- Reopen creates a new draft replacement attempt linked to the cancelled terminal attempt. Archive records orthogonal terminal metadata and never deletes or changes execution state.
- `DispatchExecutionTransitioned` implements `ShouldDispatchAfterCommit`; no notification, broadcast, queue, or slow side effect is delivered before commit.
- `dispatch.v2_commands_enabled` and `dispatch.legacy_path_enabled` preserve a rollback switch. No existing web/mobile adapter was changed to call the new commands.

## Files changed

- `app/Modules/Dispatch/Commands/DispatchV2Commands.php`
- `app/Modules/Dispatch/Data/DispatchReadinessBlocker.php`, `DispatchReadinessProjection.php`, `DispatchV2Mutation.php`
- `app/Modules/Dispatch/Enums/DispatchV2CommandCode.php`, `DispatchReadinessBlockerCode.php`, `DispatchReadinessSeverity.php`
- `app/Modules/Dispatch/Events/DispatchExecutionTransitioned.php`, `Exceptions/DispatchV2CommandException.php`
- `app/Modules/Dispatch/Policies/DispatchExecutionAttemptPolicy.php`
- `app/Modules/Dispatch/Queries/DispatchReadinessEvaluator.php`, `DispatchV2ReadinessQuery.php`
- `app/Modules/Dispatch/Services/DispatchV2Authorization.php`, `DispatchV2CommandService.php`, `DispatchV2TransactionEnvelope.php`
- Phase 1 dispatch models gained explicit cast/property metadata; `DispatchServiceProvider` registers the policy and audit recorder contract.
- `app/Platform/Audit/Contracts/AuditEventRecorder.php` and the existing recorder implementation contract.
- `config/dispatch.php`
- `tests/Feature/Operations/DispatchV2CommandLayerTest.php`
- This handoff, the execution plan status, and `.ai-reports/ai-verification-questions.md`.

## Verification completed

- Red-first/runtime-focused evidence: the new Phase 2 suite initially exposed readiness fixture assumptions, a dynamic Eloquent attribute accidentally being persisted, final-recorder test injection limits, and transaction cleanup after failed tests; each was corrected and rerun green.
- `php artisan test --compact tests/Feature/Operations/DispatchV2CommandLayerTest.php`: PASS, 10 tests, 64 assertions.
- `php artisan test --compact tests/Feature/Operations/DispatchV2CommandLayerTest.php tests/Feature/Operations/DispatchV2LegacySchemaCharacterizationTest.php tests/Feature/Operations/DispatchV2PersistenceFoundationTest.php`: PASS, 16 tests, 135 assertions.
- Full backend `php artisan test --compact`: PASS, 550 tests, 7,061 assertions.
- `composer run lint:check`: PASS.
- `composer run types:check`: PASS, 0 PHPStan errors.
- `composer audit --locked --no-interaction`: PASS, no security vulnerability advisories.
- `npm ci --no-audit --no-fund`: PASS; existing dependency deprecation warnings only.
- `npm run build`: PASS; existing Vite plugin timing and large-chunk warnings only. No frontend source was changed.
- `git diff --check`: PASS.
- PostgreSQL recheck `php artisan test --compact -c phpunit.postgresql.xml`: BLOCKED before execution; all 4 configured tests failed to connect to `127.0.0.1:5432` / `core2_rental_sales_test` with connection refused. PostgreSQL-only enforcement remains safely deferred rather than treated as passed.

## Review and security checkpoint

- Code and architecture review found no critical or high-confidence unresolved issue.
- Confused-deputy and IDOR review: actor capability is checked after a workspace-scoped aggregate reload; object-scope mismatch is indistinguishable from missing object; progress cannot name another lead.
- Replay review: owner/workspace/key uniqueness and action/aggregate/version/payload hashing prevent cross-owner and cross-command replay; a completed replay has no second side effect.
- Lock/atomicity review: handoff is locked before attempt, then plan/approval/offer readiness rows; state, audit, lineage, and idempotency completion share the transaction and rollback together.
- Audit review: before/after payloads contain only lifecycle/version and safe identifiers; one successful non-replay command creates one aggregate audit event and one after-commit domain event.
- Feature-flag review: existing adapters are unchanged and the V2 command path can be disabled without changing legacy records.
- The named Laravel pattern/TDD/security/verification skills were not installed in this session; Laravel 13 transaction, locking, and after-commit behavior was checked with Context7 official documentation, then verified by focused runtime tests and the repository gates.

## Known blockers and unresolved findings

- PostgreSQL verification requires an available configured PostgreSQL server/database; exact connection-refused output is recorded above.
- Existing untouched mobile quality debt remains outside Phase 2: Phase 1 recorded 39 `packages/field-mobile` lint errors and 5 format failures.
- No Phase 2-caused blocker remains.

## Closeout fields

- `PHASE_STATUS=complete`
- `READY_FOR_PHASE_3=yes`
- `READY_FOR_PHASE_4_PREREQUISITE=yes` (Phase 4 remains blocked on Phase 3.)
- `READY_FOR_PHASE_7=no`
- `READY_GRAPH_COMPLETE=no`
- `CONTEXT_SPLIT_REQUIRED=no`
- `BRANCH=codex/dispatch-backend-v2-phase-2`
- `START_SHA=3f70d9c501c5c0bfbb4f445b286e08a1cbf4f63b`
- `IMPLEMENTATION_SHA=b8a80257cc9751f83303e47a7651efb18c71e425`
- `HANDOFF_SHA=closeout commit for this handoff`

## Next action

Phase 3 may begin from the clean Phase 2 implementation plus handoff closeout on `codex/dispatch-backend-v2-phase-2`. Phase 4 remains dependency-gated on Phase 3. Do not switch web/mobile adapters until the Phase 3 offer/lead/eligibility/approval gates are complete.
