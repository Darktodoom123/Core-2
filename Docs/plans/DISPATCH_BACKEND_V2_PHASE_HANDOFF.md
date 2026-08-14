# Dispatch Backend V2 Phase 4 Handoff

## Phase 4 closeout — 2026-08-14

Phase 4 is complete on `codex/dispatch-backend-v2-phase-4`, starting exactly at `55ad79f620aab2cd9bc806f30f7c85d68f8b41e7` (the Phase 3 handoff commit). Ancestry was verified before implementation. The implementation/test commit is `bc4014fd67c4c222de8ed2a1e94f73aa50785db8`; this closeout is the documentation/verification handoff commit. No push, deployment, PR, or external-system mutation has occurred.

### Objective and decisions recorded so far

- Canonical handoffs now carry workspace, source-system/type/id, external reference, payload hash, inbound owner/key, timestamps, snapshot, and a composite workspace/source identity constraint. Legacy service, polymorphic source, Rental, Sales, and manual links are retained.
- Every new V2 attempt is created through the shared transaction envelope and links to one handoff. Source creation uses a transaction-aware command path so source locks, legacy compatibility rows, canonical state, audit lineage, idempotency receipt, and outbox intent share one transaction.
- Source retries use stable owner-scoped keys; payload, owner, action, workspace, and reference conflicts are rejected before operation writes. Service re-planning is explicit; cancelled replacement attempts are monotonic, linked to immutable predecessors, and completed attempts remain terminal.
- Durable outbox rows are deduplicated by command receipt/audit, queued through an explicit after-commit callback, and delivered with claim/process/fail/retry/delivered states. Delivery failure cannot roll back committed execution state or duplicate a delivered row.
- Rental/Sales delivery fulfillment now requires a linked, non-archived completed canonical attempt; pickup/non-delivery remains unaffected. Reconciliation includes orphan, workspace mismatch, asymmetric link, source hash/reference, duplicate attempt/handoff, and terminal delivery checks without deleting unexplained data.
- Manual canonical source resolution and source payload-hash drift detection were added during review. Service source retry lookup is conditional on an explicit idempotency key so the existing duplicate-conversion compatibility response remains intact.

### Files changed

Application changes are in `app/Modules/Dispatch/Actions/{ConvertServiceRequestToDispatch,CreateDispatchFromSource,CreateManualDispatchHandoff}.php`, `app/Modules/Dispatch/Contracts/{DispatchOutboxDeliveryHandler,DispatchOutboxRecorder}.php`, `app/Modules/Dispatch/DispatchServiceProvider.php`, `app/Modules/Dispatch/Data/DispatchV2Mutation.php`, `app/Modules/Dispatch/Enums/{DispatchSourceType,DispatchV2CommandCode}.php`, `app/Modules/Dispatch/Events/DispatchOutboxMessageDelivered.php`, `app/Modules/Dispatch/Http/Controllers/DispatchJobController.php`, `app/Modules/Dispatch/Jobs/DeliverDispatchOutboxMessage.php`, `app/Modules/Dispatch/Models/{DispatchExecutionAttempt,DispatchHandoff,DispatchOutboxMessage}.php`, `app/Modules/Dispatch/Services/{DispatchDeliveryAttemptGuard,DispatchOutboxDeliveryService,DispatchOutboxIntentRecorder,DispatchV2CommandService,DispatchV2Reconciliation,DispatchV2TransactionEnvelope,NullDispatchOutboxDeliveryHandler}.php`, `app/Modules/Rental/Actions/{CheckoutRental,CreateRentalDispatchHandoff}.php`, and `app/Modules/Sales/Actions/{CreateSalesDispatchHandoff,FulfillSalesOrder}.php`.

The schema change is `database/migrations/2026_08_14_150000_add_dispatch_v2_phase4_contract.php`. Tests changed/added include the Phase 4 focused suite, persistence foundation, source handoff, delivery, and stale delivery-fixture compatibility updates in the implementation commit. `vendor/` and generated build output are ignored dependency/build artifacts and are not committed.

### Exact verification state

- PASS: `php artisan test --compact tests/Feature/Operations/DispatchV2Phase4Test.php` — 6 tests, 46 assertions.
- PASS: `php artisan test --compact tests/Feature/Operations/DispatchV2CommandLayerTest.php tests/Feature/Operations/DispatchV2Phase4Test.php tests/Feature/Operations/DispatchSourceIntegrationTest.php tests/Feature/Operations/ClientServiceRequestWorkflowTest.php tests/Feature/Operations/RentalSalesDispatchHandoffTest.php` — 33 tests, 294 assertions.
- PASS: `php artisan test --compact tests/Feature/Operations/RentalSalesAuditTest.php tests/Feature/Operations/RentalSalesR6AuthorizationMatrixTest.php tests/Feature/Operations/RentalSalesR6StateAuditRollbackTest.php tests/Feature/Operations/RentalSalesStateSafetyTest.php tests/Feature/Operations/RentalSalesWorkflowTest.php` — 174 tests, 815 assertions.
- PASS: full backend `php artisan test --compact` — 563 tests, 7,387 assertions.
- PASS: PHP syntax checks for all changed PHP files; `composer run lint:check`; `composer run types:check` with 0 PHPStan errors; `composer audit --locked --no-interaction` with no security vulnerability advisories; `git diff --check`.
- PASS: `npm run build` and `npm run types:check`. No frontend/mobile source was changed. Full untouched repository mobile checks reproduce the known baseline: 39 ESLint errors and 5 Prettier format warnings in `packages/field-mobile`; these are not Phase 4 changes.
- PASS: isolated file-backed SQLite forward migration rehearsal; all migrations, including `2026_08_14_150000_add_dispatch_v2_phase4_contract`, applied and `migrate:status` reported all Ran. The temporary database was removed. Rollback is not claimed; the repository environment guard previously refused `migrate:rollback --step=1 --force` with `This command is prohibited from running in this environment`.
- BLOCKED exactly: `php artisan test --compact -c phpunit.postgresql.xml` — all 4 configured tests failed before assertions because PostgreSQL at `127.0.0.1:5432`, database `core2_rental_sales_test`, refused the connection. No PostgreSQL pass is claimed.

### Review, blockers, and next action

Architecture and security review covered source spoofing/IDOR and workspace isolation, idempotency owner/action/payload replay, canonical hash/reference preservation, duplicate/orphan attempts, deterministic lock ordering, audit payload minimization, outbox deduplication/retry/poison handling, terminal mutation, callback timing, and Rental/Sales fulfillment bypasses. No critical or high-confidence unresolved implementation issue remains. Known external/pre-existing blockers are the unavailable PostgreSQL service and untouched mobile quality debt recorded above. Phase 5 is unblocked for adapter work; it owns `/api/v2`, web/mobile cutover, and the existing mobile debt. `PHASE_STATUS=complete`, `READY_FOR_PHASE_5=yes`, and `CONTEXT_SPLIT_REQUIRED=no`.

## Phase 3 closeout

Phase 3 implementation is committed on `codex/dispatch-backend-v2-phase-3`, starting exactly from `c99c0c08b5fb2da920dfdeaaf9da879888f064be`. Focused, regression, affected, full-backend, static, audit, and diff checks are complete. No push, deployment, PR, adapter cutover, Phase 4 source-attempt integration, or external mutation has been performed.

### Implemented contract

- Typed offers implement `proposed -> offered -> accepted | rejected | withdrawn | expired`, with accepted history ending as `ended` where applicable. Responses are workspace/actor/object scoped, expected-version aware, idempotent, audited, and never infer acceptance from job status or cancel attempts.
- Mandatory/optional requirement slots, explicit lead designation/replacement, accepted-lead authorization, typed personnel/credential/account/availability blockers, and shared-asset status/inspection/maintenance/conflict checks are enforced under deterministic aggregate/personnel/asset lock ordering.
- Plan materiality is versioned; material changes supersede prior pending/approved approvals atomically. Approval request reason is distinct from decision reason and maker/checker separation is enforced.
- Emergency overrides are typed, scoped, plan-version bound, requester/decider separated, bounded, expiring, consumable, replay-owned, and audited. They may waive only approved soft blockers and never lead or hard safety blockers.
- `DISPATCH_V2_PHASE3_COMMANDS_ENABLED` preserves rollback. Existing web/mobile routes and adapters remain unchanged.

### Verification checkpoint

- `composer run lint:check`: PASS.
- `composer run types:check`: PASS, 0 PHPStan errors.
- Focused Phase 3 suite: PASS, 7 tests, 40 assertions.
- Phase 2 command/legacy/persistence plus Phase 3 regression suites: PASS, 24 tests, 183 assertions.
- Affected assignment/dispatch/asset/maintenance/shared-asset suites: PASS, 67 tests, 646 assertions.
- Full backend `php artisan test --compact`: PASS, 557 tests, 7,221 assertions.
- `composer audit --locked --no-interaction`: PASS, no security vulnerability advisories.
- `git diff --check`: PASS.
- `npm ci --no-audit --no-fund` and `npm run build`: PASS; frontend source untouched. Existing dependency/Vite/chunk warnings are informational.
- `php artisan test --compact -c phpunit.postgresql.xml`: BLOCKED exactly by connection refusal to `127.0.0.1:5432`, database `core2_rental_sales_test`; no PostgreSQL pass is claimed.
- Forward migration rehearsal on an isolated file-backed SQLite database: PASS; all migrations, including `2026_08_14_140000_add_dispatch_v2_phase3_contract`, applied and `migrate:status` reported all Ran. Required Phase 3 tables/columns were present. `migrate:rollback --step=1 --force` was refused by the repository environment guard (`This command is prohibited from running in this environment`), so rollback was not claimed as passed; the temporary database was removed.

### Review checkpoint and next action

IDOR/workspace scoping, lead spoofing, confused deputy paths, maker/checker separation, emergency scope/expiry, replay ownership/payload mismatch, audit minimization, duplicate events, rollback, optional-resource behavior, command-time eligibility, and deterministic lock ordering were reviewed. Two review findings were fixed before the final green run: optional asset conflicts no longer block readiness, and lead designation rechecks schedule conflicts under lock. No critical/high-confidence unresolved issue remains.

- `PHASE_STATUS=complete`
- `READY_FOR_PHASE_4=yes`
- `BRANCH=codex/dispatch-backend-v2-phase-3`
- `START_SHA=c99c0c08b5fb2da920dfdeaaf9da879888f064be`
- `IMPLEMENTATION_SHA=a2834099ba55792109b621abae9e2b6215733175`
- `HANDOFF_SHA=pending closeout commit`
- `CONTEXT_SPLIT_REQUIRED=no`

## Prior Phase 2 baseline

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

## Prior Phase 2 closeout fields

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

## Prior Phase 2 next action

Phase 3 may begin from the clean Phase 2 implementation plus handoff closeout on `codex/dispatch-backend-v2-phase-2`. Phase 4 remains dependency-gated on Phase 3. Do not switch web/mobile adapters until the Phase 3 offer/lead/eligibility/approval gates are complete.
