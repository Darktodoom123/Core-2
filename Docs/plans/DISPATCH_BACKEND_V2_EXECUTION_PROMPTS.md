# Dispatch Backend V2 Executor Prompts

These prompts are reusable handoffs for the later phases of the Dispatch Backend V2 graph. Each prompt is self-contained enough to execute from a clean worktree after its dependency commit. The executor must preserve unrelated user work, use TDD, and stop before widening scope.

## Common contract for every phase

You are implementing one dependency-gated phase of Dispatch Backend V2 in the Core-2 Laravel 13 modular monolith. Read `AGENTS.md` if present, `Docs/README.md`, `Docs/plans/DISPATCH_BACKEND_V2_EXECUTION_PLAN.md`, `Docs/architecture/ADR-DISPATCH-BACKEND-V2-DOMAIN-CONTRACT.md`, the durable phase handoff, and all relevant existing docs before editing.

The accepted target semantics are mandatory:

- Execution is `draft -> dispatched -> en_route -> arrived -> working -> completed`, plus `cancelled`.
- `accepted` exists only on an assignment offer, never on a job/dispatch execution lifecycle.
- `pending_approval`, `scheduled`, and `ready` are derived plan/readiness conditions, not execution statuses.
- Every mandatory offer must be accepted before dispatch, except an explicitly approved, scoped, audited emergency override.
- Every attempt has exactly one designated accepted lead. Only that lead or an authorized override progresses global execution. Emergency override never bypasses the lead or asset safety.
- Archive is orthogonal and terminal-record-only.
- One dispatch is one execution attempt linked to one canonical handoff; a handoff may have multiple policy-approved attempts.
- Web and mobile reuse the same domain commands. Breaking mobile semantics use `/api/v2` and a temporary tested `/api/v1` compatibility path.
- State and audit writes are atomic; slow side effects happen after commit.
- Do not add `on_hold` until stakeholders approve a new contract defining its semantics.

For the assigned phase, prove red with focused tests, implement green, then refactor. Run the phase test gate, `git diff --check`, static/security checks proportionate to risk, code review, and security review. Resolve all critical/high findings. Record exact commands and results in `Docs/plans/DISPATCH_BACKEND_V2_PHASE_HANDOFF.md` and the execution plan. Do not push, open a PR, deploy, or mutate external systems. Commit only the assigned phase with `<type>: <user-visible outcome>`.

## Phase 1 prompt — canonical schema foundation and preservation

**Dependency:** Phase 0 commit is complete and `ready_for_phase_1: yes`.

**Objective:** Add the additive persistence foundation for canonical handoffs, execution attempts, immutable plan versions, assignment offers/lead metadata, idempotency keys, and audit lineage while preserving all existing rows and legacy runtime behavior.

**Scope:**

- Inventory current dispatch, assignment, approval, source/handoff, asset, audit, idempotency, and mobile outbox tables and their constraints.
- Write characterization tests and an explicit legacy-to-target mapping before migrations.
- Add only expand/contract migrations and model relationships/casts required by the approved schema design.
- Make backfill/reconciliation resumable, idempotent, bounded, observable, and non-destructive.
- Represent one attempt to one canonical handoff, plan-version identity, offer state, designated lead, optimistic version, and idempotency ownership without deleting legacy columns yet.

**Do not:** implement new lifecycle commands, switch adapters, remove legacy accepted/pending/scheduled values, add `on_hold`, or silently rewrite user history.

**Surfaces:** `database/migrations`, `app/Modules/Dispatch/Models`, approved additive `Enums`, explicit reconciliation tooling, `tests/Feature/Operations`, `tests/PostgreSQL`, and focused unit tests.

**Verification:** fresh and upgrade migrations on supported databases; schema constraints/indexes/foreign keys; backfill retry/resume and row-count tests; zero unexplained fixture rows; existing backend suites; lint/types/audit/diff checks. Review data retention, tenant/workspace isolation, authorization ownership, and rollback before commit.

**Rollback:** demonstrate reverse or additive rollback, a feature-flagged legacy path, and a reconciliation checkpoint. If any migration is destructive or any legacy row is unexplained, stop and report the blocker.

**Handoff:** update the plan YAML with Phase 1 SHA and exact results; set Phase 2 to unblocked only after all gates pass.

## Phase 2 prompt — shared lifecycle commands and readiness

**Dependency:** Phase 1 commit and migration/backfill evidence are complete.

**Objective:** Implement the shared domain command/query layer and the separated execution, assignment, and plan/approval concepts behind adapters.

**Scope:**

- Implement atomic commands for create/submit/approve/dispatch/progress/cancel/reopen/archive using expected-version checks.
- Implement the target execution transitions only: `draft`, `dispatched`, `en_route`, `arrived`, `working`, `completed`, `cancelled`.
- Implement deterministic readiness projection with typed blocker codes/evidence; keep pending approval, scheduled, and ready derived.
- Record state and audit changes in one transaction and defer notifications/broadcasts/slow work until after commit.
- Add authorization policies inside command boundaries and preserve object/tenant scope.
- Keep legacy translation/feature flags available; do not move web/mobile adapters yet.

**Do not:** create a job-level accepted transition, bypass mandatory acceptance/lead rules, add `on_hold`, or allow controllers to mutate lifecycle directly.

**Surfaces:** `app/Modules/Dispatch/Actions` or `Commands`, lifecycle value objects, readiness evaluator/blocker objects, policies, audit/event writer, and feature/unit tests.

**Verification:** complete transition matrix; invalid terminal/stale-version/unauthorized cases; deterministic blocker ordering and evidence; atomic rollback of state plus audit; after-commit side-effect timing; legacy characterization and handoff suites; static/security/diff checks.

**Rollback:** command feature flag off preserves legacy behavior; no partial state/audit write; adapter switch remains disabled. Review confused-deputy and information-leak risks before commit.

**Handoff:** record exact test counts, review findings/fixes, rollback check, commit SHA, and unlock Phase 3 and the Phase 4 prerequisite.

## Phase 3 prompt — offers, lead, eligibility, assets, and approvals

**Dependency:** Phase 2 command/readiness commit is complete.

**Objective:** Enforce assignment offers, mandatory acceptance, designated lead, eligibility/asset safety, and plan-version approval supersession before dispatch.

**Scope:**

- Implement assignment offer transitions `proposed -> offered -> accepted/rejected/withdrawn/expired`.
- Require all mandatory offers accepted and exactly one designated accepted lead before dispatch.
- Make lead designation/replacement explicit, authorized, versioned, and auditable.
- Evaluate personnel qualifications/availability and asset availability/inspection/maintenance safety as blocking readiness facts.
- Bind approvals to immutable plan versions; material changes create a new version and supersede old approval.
- Implement emergency override only as an explicit, scoped, approved, audited exception; never bypass lead or safety.

**Do not:** infer acceptance from job status, auto-accept offers, delete historical offers/audit, or add `on_hold`.

**Surfaces:** `app/Modules/Assignment`, dispatch approval/readiness services, fleet/equipment/credential/inspection integrations, authorization matrix tests, and focused concurrency tests.

**Verification:** offer response/reassignment/expiry cases; one-lead concurrency; double-dispatch prevention; mandatory versus optional acceptance; override approval/audit/expiry; asset safety and eligibility conflicts; plan supersession; actor/object-scope authorization; static/security/diff checks.

**Rollback:** preserve legacy assignment rows and history; failed approval/override cannot leave a dispatchable plan; policy feature flag remains reversible. Review lead spoofing, confused-deputy, replay, and override abuse.

**Handoff:** record Phase 3 SHA and evidence; unlock Phase 4 only when both Phase 2 and Phase 3 gates are complete.

## Phase 4 prompt — handoffs, attempts, retry, idempotency, audit, side effects

**Dependency:** Phase 2 and Phase 3 commits are complete.

**Objective:** Connect Rental/Sales/Service canonical handoffs to shared commands and make attempts, retries, replacement lineage, idempotency, and post-commit effects safe.

**Scope:**

- Make each attempt link to exactly one canonical handoff with stable correlation/idempotency ownership.
- Route source adapters through the shared domain commands; they must not write execution status directly.
- Retry the same operation/side effect on the same attempt and key when no new execution attempt is intended.
- Create a new monotonic replacement attempt only when policy permits; retain terminal predecessor and lineage.
- Keep state plus audit atomic and run notifications, broadcasts, and slow jobs after commit.
- Preserve mobile outbox/retry semantics and optimistic conflict evidence.

**Do not:** duplicate attempts on retry, mutate completed/cancelled attempts, silently change source links, or bypass the readiness/lead/safety rules.

**Surfaces:** Rental/Sales/Service actions, dispatch handoff/attempt services, idempotency handling, events/listeners/jobs, audit snapshots, reconciliation tooling, and integration/concurrency tests.

**Verification:** create/retry/cancel/complete/replacement/source-mismatch tests for each source; duplicate web/mobile command tests; one audit event per mutation; post-commit failure/retry; concurrency and supported-database checks; static/security/diff checks.

**Rollback:** source adapter feature flags restore legacy path without deleting lineage; post-commit retry is safe; orphan/multiply linked reconciliation is clean. Review idempotency ownership, replay, source authorization, and audit integrity.

**Handoff:** record exact source test counts and Phase 4 SHA; unlock Phase 5 only after compatibility and rollback evidence is attached.

## Phase 5 prompt — web/API/mobile adapters and compatibility

**Dependency:** Phase 4 command/handoff/idempotency commit is complete.

**Objective:** Move web, API, and mobile adapters onto shared query/command contracts without breaking installed mobile clients.

**Scope:**

- Add or revise `/api/v2` routes, requests, resources, controllers, and exception mappings for V2 semantics.
- Keep web/Inertia adapters thin and command-backed.
- Add a temporary tested `/api/v1` compatibility translator for breaking mobile changes.
- Update `packages/field-mobile` API client/outbox/retry/response mapping only as needed; preserve idempotency and conflict behavior.
- Expose blocker evidence and lead/offer facts without presenting job-level accepted.
- Document compatibility window, telemetry, and sunset criteria.

**Do not:** bypass commands from an adapter, silently break V1 clients, remove the compatibility path before evidence, or add `on_hold`.

**Surfaces:** `routes/api.php`, API controllers/requests/resources, web controllers/Inertia view models, mobile API/outbox code, contract tests, Playwright/native tests as applicable.

**Verification:** web feature, `/api/v2` contract, `/api/v1` compatibility, mobile unit/integration/outbox retry, authorization, stale-version, and readiness tests. Run relevant npm lint/format/types/build checks and broader tests proportionate to changed surfaces.

**Rollback:** route/feature flags restore legacy adapters while preserving V2 records; mobile has a tested fallback and telemetry. Review API authorization, payload validation, replay, conflicts, and leakage before commit.

**Handoff:** record client/version test evidence, compatibility sunset owner, Phase 5 SHA, and unlock Phase 6.

## Phase 6 prompt — rollout, reconciliation, hardening, closeout

**Dependency:** Phase 5 adapters and compatibility evidence are complete.

**Objective:** Roll out by bounded cohort, reconcile legacy and V2 records, verify rollback, and close the graph only with operational evidence.

**Scope:**

- Add bounded tenant/workspace/cohort rollout controls, metrics, alerts, and runbooks.
- Reconcile handoffs, attempts, offers, lead assignments, approvals, assets, audit rows, and mobile outbox outcomes.
- Rehearse backup/restore, feature-flag rollback, reverse/reconciliation commands, and ownership escalation.
- Remove legacy compatibility only after documented sunset criteria and zero active legacy clients.
- Keep archive terminal-only and require a new ADR for any future `on_hold` decision.

**Do not:** delete history, silently coerce unexplained rows, remove V1 early, or mark the project complete without exact evidence.

**Surfaces:** deployment/configuration flags, reconciliation commands, monitoring/runbooks, compatibility translators, deprecation notices, and full backend/frontend/mobile/security verification.

**Verification:** production-like dry run, restore/rollback rehearsal, full proportionate suites, security review, migration report, no unexplained duplicate/orphan/stale/unaudited records, and clean diff.

**Rollback:** every cohort has a verified owner, backup, flag, restore/reconcile path, and preserved audit/attempt lineage. Predictable fixture seeders remain blocked in production.

**Handoff:** record final SHA, rollout evidence, unresolved low-risk issues, compatibility sunset, and set `ready_for_phase_1` to `no` because the graph is complete; mark all phases complete only when the closeout review passes.
