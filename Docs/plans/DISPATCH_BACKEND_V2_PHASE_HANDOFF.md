# Dispatch Backend V2 Phase 5 Handoff

## Phase 5 Closeout — 2026-08-14

Phase 5 is complete on `codex/dispatch-backend-v2-phase-5`, starting exactly from `9ffcee5d766556b7060b0bc308ac7a3bfadc89b5` (the Phase 4 handoff commit). All web, API, and mobile client adapter migrations have been implemented and verified. No push, deployment, PR, or Phase 6 work has been started.

### Implemented Phase 5 Scope

1. **Canonical `/api/v2` REST API Endpoints**:
   - `GET /api/v2/dispatch-jobs`: Paginated listing filtered by caller's visibility and open offers.
   - `GET /api/v2/dispatch-jobs/{id}`: Detailed resource projection with designated lead, active plan version, offers, and computed capabilities.
   - `GET /api/v2/dispatch-jobs/{id}/readiness`: Evaluated readiness projection with blocker breakdown and plan status.
   - `POST /api/v2/dispatch-jobs/{id}/dispatch`: Activation of ready execution attempts.
   - `POST /api/v2/dispatch-jobs/{id}/progress`: Forward-only execution attempt lifecycle progression (`en_route -> arrived -> working -> completed`).
   - `POST /api/v2/dispatch-jobs/{id}/cancel`: Cancellation of active execution attempts with reason tracking.
   - `POST /api/v2/dispatch-jobs/{id}/reopen`: Monotonic attempt creation for cancelled jobs.
   - `POST /api/v2/dispatch-jobs/{id}/archive`: Archival of cancelled/completed execution attempts.
   - `POST /api/v2/dispatch-jobs/{id}/offers`: Propose assignment offer.
   - `POST /api/v2/dispatch-jobs/{id}/offers/{offerId}/accept`: Actor-scoped offer acceptance.
   - `POST /api/v2/dispatch-jobs/{id}/offers/{offerId}/reject`: Rejection of offer with mandatory reason.
   - `POST /api/v2/dispatch-jobs/{id}/offers/{offerId}/withdraw`: Dispatcher withdrawal of pending offer.
   - `POST /api/v2/dispatch-jobs/{id}/offers/{offerId}/expire`: Expiration of stale offers.
   - `POST /api/v2/dispatch-jobs/{id}/lead`: Designation of lead driver.
   - `POST /api/v2/dispatch-jobs/{id}/plan/submit`: Submission of plan version for approval.
   - `POST /api/v2/dispatch-jobs/{id}/plan/approve`: Independent Operations Manager approval.
   - `POST /api/v2/dispatch-jobs/{id}/plan/reject`: Rejection of plan version.
   - `POST /api/v2/dispatch-jobs/{id}/emergency-override`: Propose emergency override.
   - `POST /api/v2/dispatch-jobs/{id}/emergency-override/{overrideId}/decision`: Decide emergency override.

2. **`/api/v1` Compatibility Bridge & Deprecation Headers**:
   - `FieldDispatchJobController` & `AssignmentResponseController` bridge `/api/v1` operations to `DispatchV2Commands` when V2 execution attempt/offers exist, with robust fallback to legacy actions for legacy records.
   - Legacy `status: 'accepted'` request payload translates to offer acceptance for the caller without corrupting the job attempt execution status.
   - RFC 8594 deprecation headers returned on all `/api/v1` responses:
     - `Deprecation: @1755129600` (August 14, 2025)
     - `Sunset: Sun, 14 Feb 2027 00:00:00 GMT`
     - `Link: </api/v2/dispatch-jobs/{id}>; rel="successor-version"`

3. **Web Workflow Controller Migration**:
   - `DispatchWorkflowController` routes `activate`, `cancel`, `reopen`, `archive`, and `transition` through `DispatchV2Commands` for V2-managed jobs while maintaining full backwards compatibility for legacy jobs.
   - `ApprovalRequestController` bridges plan approvals to `DispatchV2Commands::approvePlan` / `rejectPlan`.
   - `ApprovalRequestPolicy` updated to authorize `plan_version` and `plan_approval` kinds.

4. **Mobile Client Adapter**:
   - `FieldApiClient` (`packages/field-mobile/src/services/apiClient.ts`) extended with typed V2 methods: `fetchAssignedJobsV2`, `fetchJobDetailV2`, `fetchReadinessV2`, `dispatchJobV2`, `progressJobV2`, `cancelJobV2`, `reopenJobV2`, `archiveJobV2`, `acceptOfferV2`, `rejectOfferV2`, `withdrawOfferV2`, `designateLeadV2`.
   - TypeScript interfaces (`DispatchJobV2`, `DispatchAssignmentOfferV2`, `DispatchPlanVersionV2`, `DispatchReadinessV2`) added to `packages/field-mobile/src/types/index.ts`.
   - Windows-compatible Jest configuration updated in `packages/field-mobile/jest.config.cjs`.

### Exact Verification State

- **Backend V2 API Contract Tests**:
  - `php artisan test --compact tests/Feature/Api/V2/DispatchV2ApiContractTest.php` — PASS (14/14 tests, 70 assertions).
- **Backend V1 Compatibility Tests**:
  - `php artisan test --compact tests/Feature/Api/V1/DispatchV1CompatibilityTest.php` — PASS (4/4 tests, 28 assertions).
  - `php artisan test --compact tests/Feature/Api/V1/FieldDispatchJobTest.php` — PASS (10/10 tests, 61 assertions).
- **Web Workflow Adapter Tests**:
  - `php artisan test --compact tests/Feature/Operations/DispatchV2WebAdapterTest.php` — PASS (5/5 tests, 12 assertions).
- **Regression Suite Across Foundations (Phases 1–4 & Phase 2 End-to-End)**:
  - `php artisan test --compact tests/Feature/Api/V2/DispatchV2ApiContractTest.php tests/Feature/Api/V1/DispatchV1CompatibilityTest.php tests/Feature/Api/V1/FieldDispatchJobTest.php tests/Feature/Operations/DispatchV2WebAdapterTest.php tests/Feature/Operations/DispatchV2Phase4Test.php tests/Feature/Operations/DispatchV2Phase3Test.php tests/Feature/Operations/DispatchV2CommandLayerTest.php tests/Feature/Operations/DispatchV2PersistenceFoundationTest.php tests/Feature/Operations/Phase2EndToEndDispatchLifecycleTest.php` — PASS (66/66 tests, 466 assertions).
- **Code Quality & Static Analysis**:
  - `composer lint:check` (Pint) — PASS (0 errors).
  - `composer types:check` (PHPStan 512M) — PASS (0 errors).
  - `npm run format:check` (Prettier) — PASS (All matched files formatted).
  - `npm run types:check` (TypeScript frontend) — PASS (0 errors).
  - `npm run types:check:mobile` (TypeScript mobile) — PASS (0 errors).
  - `npm run test:mobile` (Mobile tests) — PASS (34 integration/unit tests + 37 component tests = 71/71 tests passing).
- **Security & Authorization Review**:
  - Optimistic locking enforces `VersionConflictException` with 409 JSON snapshot.
  - Idempotent command processing enforces actor-scoped deduping across network retries.
  - Role-based authorization verified for all V2 endpoints (Dispatcher, Operations Manager, Driver/Operator, System Admin).

`PHASE_STATUS=complete`
`READY_FOR_PHASE_6=yes`
`CONTEXT_SPLIT_REQUIRED=no`

---

## Phase 4 closeout — 2026-08-14

Phase 4 is complete on `codex/dispatch-backend-v2-phase-4`, starting exactly at `55ad79f620aab2cd9bc806f30f7c85d68f8b41e7` (the Phase 3 handoff commit). Ancestry was verified before implementation. The implementation/test commit is `bc4014fd67c4c222de8ed2a1e94f73aa50785db8`.
