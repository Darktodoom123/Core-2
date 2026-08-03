# Core Transaction 2 — Phase 2 Dispatch Lifecycle Session Plan

**Last updated:** 2026-07-26  
**Purpose:** Copy-pasteable implementation prompts for closing the Phase 2
dispatch lifecycle gate.

## Overall objective

Complete the Dispatcher → Manager → Field Worker journey across the live web
workspace and the versioned mobile boundary, including assignment responses,
reassignment, cancellation, stale-version handling, authorization, audit
history, and focused acceptance coverage.

The current baseline is recorded in [Roadmap](../Roadmap.md),
[features](../features.md), [business rules](../business_rules.md), and the
[HTTP API contract](../API.md).

## Operating rules for every session

- Read `AGENTS.md` and the relevant product documentation before editing.
- Inspect current code, tests, migrations, and nearby conventions first.
- Work in one shared workspace, sequentially; never run two editing agents at once.
- Implement only the stated session scope and preserve unrelated user changes.
- Use Laravel TDD: focused Pest coverage for externally visible behavior.
- Keep Laravel policies, actions, validation, transitions, and audit rules authoritative.
- Do not commit, push, or open a pull request unless explicitly requested.
- Update affected product/API/feature documentation in the same implementation session.
- Report changed files, tests/checks run, checks that could not run, open decisions,
  and remaining risks at the end of every session.

## Session 0 — Read, baseline, and prepare

Copy this into the first session:

```text
Objective:
Prepare and verify the implementation baseline for the Phase 2 dispatch lifecycle.

Read the repository instructions and all relevant product documentation,
including the documentation index, roadmap, feature catalog, business rules,
architecture, Phase 0 decisions, and HTTP API contract.

Inspect:
- current git status and branch
- migrations, models, enums, policies, actions, requests, routes, and controllers
- existing dispatch view models, Inertia pages, TypeScript types, and Pest tests
- current assignment response, activation, and field progression behavior

If the local project is not initialized, verify or run:

composer install
npm install
php artisan migrate --seed

Do not reset the database or overwrite unrelated user changes.

Deliver:
- what is already implemented
- what is missing for Phase 2
- impacted files and tests
- required authorization/state/concurrency rules
- unresolved product or architecture decisions
- recommended implementation order

Do not edit application code, create migrations, or commit.
```

### Session 0 success criteria

- The current repository state is understood and documented.
- Existing behavior is distinguished from prototype or planned behavior.
- Any unresolved assignment-response or lifecycle decisions are identified.
- The environment is ready for implementation.

## Session 1 — Assignment response

```text
Objective:
Complete the assignment accept/reject workflow for the live web application.

Scope:
- Allow an assigned field worker to accept or reject their own pending assignment.
- Require a reason when rejecting.
- Preserve assignment response history and timestamps.
- Rejected assignments must no longer grant active-job visibility.
- Do not cancel the dispatch job when an assignment is rejected.
- Use optimistic version checking, transactions, authorization, and audit events.
- Connect the workflow to the live Inertia detail and field-work surfaces.
- Add focused Pest coverage.

Success criteria:
- Only the assigned active worker can respond.
- Invalid, repeated, stale, unauthorized, and cross-worker requests fail safely.
- Rejection requires a reason and closes the assignment’s active interval.
- Successful responses create the correct audit event.
- UI uses redirects, validation errors, typed flash, and capability-driven actions.

Out of scope:
- Reassignment, cancellation, archive/restore, mobile API, and React Native.

Read the repository instructions and relevant product documentation before editing.
Inspect existing assignment enums, models, policies, actions, controllers,
view models, routes, UI, and tests. Follow Laravel TDD. Do not commit.
Run focused Pest tests and relevant frontend checks.
```

## Session 2 — Reassignment and assignment ending

```text
Objective:
Complete safe assignment ending and reassignment for dispatch jobs.

Scope:
- Allow authorized dispatchers to end active personnel or asset assignments.
- Create replacement assignments through existing eligibility and conflict rules.
- Preserve historical assignment records.
- Require approval for post-activation, exceptional, or override changes where required.
- Use deterministic row locks and one transaction for the complete operation.
- Add Inertia controls and focused Pest coverage.

Success criteria:
- Old assignments are ended without deleting history.
- Replacement assignments are fully revalidated server-side.
- Duplicate, stale, unavailable, unsafe, overlapping, and unauthorized changes fail closed.
- No partial assignment or audit state remains after failure.
- Approval and audit behavior is explicit and test-covered.

Out of scope:
- Cancellation/reopen/archive, mobile API, and React Native.

Read the repository instructions and current dispatch documentation first.
Reuse existing assignment actions and policies where possible. Do not commit.
Run focused Pest tests and relevant lint/type checks.
```

## Session 3 — Cancellation, reopen, and archive

```text
Objective:
Complete the controlled cancellation, reopen, and archive lifecycle for dispatch jobs.

Scope:
- Add cancellation with a required reason.
- End active assignments safely during cancellation.
- Prevent invalid cancellation of completed or already-cancelled jobs.
- Add controlled administrative reopen/restore behavior.
- Add archive controls using the existing soft-delete model.
- Record actor, reason, timestamps, and audit events.
- Connect authorized controls to the live Inertia UI.

Success criteria:
- Cancellation is authorized, transactional, and auditable.
- Invalid lifecycle transitions fail without partial writes.
- Reopen/restore is restricted to the correct administrative capability.
- Archived records are excluded from normal operational views.
- Focused Pest tests cover authorization, state transitions, restore rules, and rollback.

Out of scope:
- Mobile API, React Native, exports, and unrelated UI redesign.

Read the business rules and document the canonical restore target before coding.
Do not commit. Run focused backend and frontend validation.
```

## Session 4 — Live schedule board

```text
Objective:
Move the schedule and conflict-review experience from prototype behavior onto the live routed workspace.

Scope:
- Use server-derived dispatch data and conflict information.
- Remove fixture-only writes from the implemented surface.
- Add permission-filtered actions.
- Support loading, empty, error, stale, and conflict states.
- Preserve responsive behavior and accessibility.
- Add focused browser/UI verification.

Success criteria:
- The schedule board reflects authoritative server data.
- Users cannot view or mutate jobs outside their scope.
- Conflict states explain the required action.
- Browser mutations use the accepted Inertia contract.
- No prototype reducer or fixture is used as a production write path.

Use the impeccable skill for this interface work.
Read the repository instructions and relevant design documentation first.
Do not commit. Run frontend checks and browser verification.
```

## Session 5 — `/api/v1` mobile foundation

```text
Objective:
Establish the versioned Laravel API foundation required by the React Native field application.

Scope:
- Add versioned `/api/v1` routing.
- Implement revocable Sanctum device authentication.
- Add login, logout, and current-user endpoints.
- Define explicit API Resources or DTOs.
- Define stable JSON error responses.
- Add idempotency-key handling for replayable commands.
- Add expected-version conflict responses.
- Add appropriate throttling and focused API tests.
- Record token lifetime or device-binding decisions in the documentation.

Success criteria:
- Active, verified users can authenticate through the mobile boundary.
- Revoked tokens cannot access protected resources.
- API responses do not accidentally expose raw Eloquent structures.
- Replayed commands are safe and conflicting payloads are rejected.
- Authorization, validation, throttling, and conflict behavior are tested.

Out of scope:
- React Native screens and mobile feature endpoints beyond the foundation.

Do not duplicate domain logic from existing Laravel actions or policies.
Do not commit. Run focused Pest tests and API/type validation.
```

## Session 6 — React Native field workflow

```text
Objective:
Implement the first React Native field workflow against the versioned Laravel API.

Scope:
- Create the focused field-mobile package.
- Add assigned-job list and detail screens.
- Add assignment accept/reject.
- Add forward-only field progression.
- Add queued, syncing, failed, and conflict states.
- Add retry-safe command handling.
- Add own-location sharing only where the server contract supports it.
- Keep all authorization and state transitions server-authoritative.

Success criteria:
- A field worker sees only their active assignments.
- Accept/reject and progression use the API command contract.
- Retries do not duplicate commands or overwrite newer state silently.
- Conflict responses are visible and actionable.
- The mobile package does not import web fixtures or Laravel implementation code.

Read the API contract and product documentation before editing.
Do not commit. Run mobile package checks and API integration tests.
```

## Session 7 — Phase 2 validation

```text
Objective:
Prove and harden the complete Phase 2 dispatch lifecycle across web and mobile boundaries.

Scope:
- Verify dispatcher assignment and activation.
- Verify manager approval for exceptional changes.
- Verify field-worker acceptance and rejection.
- Verify reassignment and cancellation.
- Verify stale-version and retry behavior.
- Verify worker isolation and authorization.
- Verify audit completeness.
- Add browser/API acceptance coverage.
- Update roadmap and feature status documentation with evidence.

Success criteria:
- The dispatcher → manager → field-worker journey passes end to end.
- Rejection, reassignment, cancellation, retry, and stale-version paths fail safely.
- No user can access another worker’s jobs or records.
- Critical writes are attributable and transactional.
- Phase 2 exit criteria are met or remaining gaps are explicitly documented.

Run:

composer ci:check
npm run lint:check
npm run format:check
npm run types:check
npm run build

Do not commit unless explicitly requested.
```

## Luna Max review prompt

After each implementation session, run this prompt in the review session before
starting the next implementation session. Replace `[SESSION]` with the completed
session number and name.

```text
You are reviewing the implementation from [SESSION 7].

Objective:
Determine whether the completed work is correct, secure, authorized,
transactional, documented, and ready for the next session.

Inspect the complete git diff and all changed files. Do not assume the previous
agent’s implementation is correct and do not merely confirm it.

Review:
- objective and success criteria from the session prompt
- authorization and worker-scope isolation
- validation and canonical state transitions
- transactions, row locks, stale versions, and rollback
- audit events and actor attribution
- Inertia redirects, error bags, typed flash, and TypeScript contracts
- API Resources/DTOs, JSON errors, idempotency, and rate limits where applicable
- accessibility, loading, empty, error, stale, and conflict states where applicable
- documentation and feature-status accuracy
- unintended scope expansion, fixture-only behavior, or security regressions

Run the focused tests and relevant checks yourself. If you find a high-confidence
issue, fix it directly without reverting valid work or broadening the scope.
Do not commit.

Report:
1. tests and checks run
2. findings grouped by severity
3. fixes made
4. remaining risks or blocked checks
5. whether the next session may begin
```

## Handoff requirement

The implementation agent must end with this summary:

```text
Session: [number and name]
Objective: [completed objective]
Changed files: [list]
Tests/checks run: [list and results]
Checks not run: [list and reason]
Documentation updated: [list]
Open decisions: [list or none]
Known risks: [list or none]
```

## Execution order

Run one session at a time:

1. Session 0 — read, baseline, and prepare
2. Session 1 — assignment response
3. Luna Max review and focused validation
4. Session 2 — reassignment
5. Luna Max review and focused validation
6. Continue through Session 7

The development server is not required for backend-only work. Start
`composer dev` when validating routed UI, browser flows, or queued notifications.

## Start here

1. Run Session 0 with Gemini in Antigravity.
2. Review Session 0’s baseline summary here with Luna Max.
3. Start Session 1 only after the baseline and environment are confirmed.
4. After every implementation session, run the Luna Max review prompt.
5. Continue only when the reviewer confirms that the next session may begin.
