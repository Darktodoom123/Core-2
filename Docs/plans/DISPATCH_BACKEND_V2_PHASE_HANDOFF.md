# Dispatch Backend V2 Phase 0 Handoff

## Objective

Complete Phase 0 of the Dispatch Backend V2 redesign: establish the executable plan and domain contract, harden production/bootstrap seeding, add focused security coverage, and commit the phase without implementing V2 schema or lifecycle behavior.

## Decisions and boundaries

- The dirty Rental/Sales/Dispatch handoff was coherent and was committed separately before Phase 0 work.
- The working branch is `codex/dispatch-backend-v2-phase-0`.
- Baseline commit: `7e9dd0cdccd08666d20bdde713aa25f9cacf1d6e`.
- `Docs/` did not exist in the checkout even though README.md references it; Phase 0 will create the required plan and contract docs.
- Current runtime remains legacy. The target contract must not be represented as implemented behavior.
- No V2 tables, migrations, enums, lifecycle commands, API version changes, or frontend behavior are in Phase 0 scope.

## Files changed so far

- Baseline commit: the pre-existing Rental/Sales/Dispatch handoff and workspace files.
- Phase 0 working tree: `Docs/README.md`, the domain contract ADR, execution plan, executor prompts, this checkpoint, the three seeder classes, and `tests/Feature/Security/DatabaseSeederSecurityTest.php`.

## Verification completed

- `composer install --no-interaction --prefer-dist`: PASS; lockfile dependencies installed. Existing PSR-4 warnings concern helper classes embedded in `tests/Feature/Operations/ReportExportWorkflowTest.php`.
- `npm ci --no-audit --no-fund`: PASS; lockfile dependencies installed. Existing npm deprecation notices were emitted.
- `composer run lint:check`: PASS.
- `composer run types:check`: PASS, 0 PHPStan errors.
- `php artisan test` over all affected Dispatch/Rental/Sales handoff files: PASS, 258 tests, 1,577 assertions.
- `npm run build`: PASS; Vite manifest generated. Existing large-chunk warnings were emitted.
- Changed `resources/js` ESLint check: PASS.
- Changed `resources/js` Prettier check: PASS.
- `npm run types:check`: PASS.
- `composer audit --locked`: PASS, no security vulnerability advisories.
- `git diff --check`: PASS.
- `php artisan test tests/Feature/Security/DatabaseSeederSecurityTest.php`: PASS, 4 tests, 18 assertions.

## Known pre-existing blockers

- Full `npm run lint:check` fails in untouched `packages/field-mobile` files with 39 existing errors (React ref access, import ordering, constant conditions, and one unused variable).
- Full `npm run format:check` reports 5 untouched `packages/field-mobile` files: `HeavyCraneRouteCard.tsx`, `field-header.tsx`, `notifications-sheet.tsx`, `profile-sheet.tsx`, and `AssignedJobsListScreen.tsx`.
- These mobile issues are outside the baseline handoff diff and must not be mixed into Phase 0.

## Unresolved findings

- Full frontend lint/format blockers listed above remain outside Phase 0 scope.
- Phase 0 code review and security review are complete with no critical/high findings open.
- Phase 0 commit SHA is not yet assigned.

## Next action

Commit the reviewed Phase 0 scope separately, then record the final Phase 0 SHA and `READY_FOR_PHASE_1` decision in this checkpoint and the machine-readable plan.
