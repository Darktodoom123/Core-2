# Operational resource coverage

Implemented under **Dispatch workspace → Schedule → Resource coverage**. The
daily dispatch desk provides Incoming work, Schedule, In progress, and History.
Coverage links operating phases to ordinary dispatch jobs, keeping their existing
safety, acceptance, activation, cancellation, and reopening workflows. The legacy
Project plans URL remains compatible. See [the office workflow](dispatch-workspace.md).

## Ownership and current integration

Core 1 remains the project owner. A Core 2 plan records the Core 1 project reference, client, and site for operational planning; creating this record does not create or update a Core 1 commercial project.

Workforce Management owns corporate rosters, rotations, and leave. Core 2 assigns eligible personnel to shifts using currently recorded account status, personnel availability, qualifications, and dispatch commitments. The upstream roster synchronization described in [the workforce boundary](core-hr-workforce-boundary.md) and [integration contract](../architecture/hr-workforce-integration.md) is not implemented by this feature. Crew candidates currently use the application's user-linked personnel model, including riggers.

## Coordinator workflow

1. Open **Dispatch workspace → Schedule → Resource coverage** and add a local coverage record with the source project reference.
2. Add phases with dates and required operators, riggers, and drivers per shift. Expand a project on the Week, Month, or Quarter timeline and select a phase.
3. Reserve equipment for the phase and record maintenance windows. The asset may remain on site across many shifts. Editing an allocation, including the optional drag shortcut, requires reviewing the affected dispatches, conflicts, and approval consequence before confirmation.
4. Submit the baseline. A different authorized approver reviews it. The creator and submitter cannot approve their own baseline.
5. Generate up to seven daily shifts at a time, each no longer than 24 hours. Repeat for another shift pattern or week. Each shift links to its own existing dispatch job.
6. Select **Fill coverage**. Required roles appear above selected crew and eligible personnel. Search and inspect recorded commitments, select replacements, give a reason, and review before saving. Partial coverage remains visible and prevents activation.
7. Open a linked dispatch to execute the existing workflow. **Return to resource coverage** restores the coverage record, selected phase, scale, and timeline date range.

## Approval and readiness

- Phase or allocation changes return the entire project baseline to draft. Independent approval and crew reconfirmation are required for subsequent dispatch activation. Changes to a phase used by an active shift are rejected.
- Crew assignments made more than 24 hours before the scheduled start can inherit an approved baseline after eligibility checks. Within 24 hours, and for any already active shift, changes become pending exceptions requiring a different authorized approver.
- Pending exceptions do not overwrite the currently confirmed crew. Approval rechecks availability, qualifications, overlaps, and required coverage. An active shift cannot be left with an incomplete crew.
- Activation requires the approved baseline, crew confirmed against that baseline, complete coverage, asset reservation for the full shift, no intersecting maintenance, and the existing dispatch safety checks. The canonical dispatch attempt must match the confirmed project shift schedule and resources.
- Maintenance stays visible as an unavailable period and blocks affected shifts. Resolve those shifts through the existing dispatch workflow; recording maintenance does not silently cancel work.
- Cancellation releases operational assignments. Reopening retains the project link and requires coverage reconfirmation. Archived shifts remain readable history.

All mutations validate permissions and input on the server, use expected versions to reject stale changes, and record audit events. Reservation writes and approval rechecks acquire asset locks. Planning reservations participate in the shared availability checks used by other operational work.

The list is paginated at ten projects; candidate search at 25 people. A plan supports at most 32 phases and 1,000 linked shifts. These limits bound planning payloads and write batches. Timeline scales show four intervals: weekly boundaries, calendar months, or calendar quarters; labels and grid lines use the same dates.

## Installation and acceptance data

Apply the normal Laravel migrations to the intended environment before opening Resource coverage:

```powershell
php artisan migrate
```

The migration creates four planning tables. PostgreSQL tables enable row-level security and revoke public API roles' table and sequence privileges; application access remains through Laravel authorization. PostgreSQL-specific privilege statements require validation in the deployment environment.

`ProjectPlanningDemoSeeder` is opt-in, restricted to local/testing, and is not part of `DatabaseSeeder`. Use a disposable database, not operational records. This example prepares an isolated local SQLite preview without editing `.env`:

```powershell
$env:APP_ENV = 'local'
$env:DB_CONNECTION = 'sqlite'
$env:DB_DATABASE = Join-Path (Get-Location) 'storage/app/planning-preview.sqlite'
$env:CACHE_STORE = 'array'
$env:BROADCAST_CONNECTION = 'log'
if (-not (Test-Path -LiteralPath $env:DB_DATABASE)) {
    New-Item -ItemType File -Path $env:DB_DATABASE | Out-Null
}
php artisan migrate --force
php artisan db:seed --class=ProjectPlanningDemoSeeder
php artisan serve --host=127.0.0.1 --port=8001
```

Demo usernames: `demo.planner` and `demo.approver`. The seeder assigns synthetic local-only credentials and is idempotent once its demo project exists.

The scenario starts seven days after seeding: one crane reserved for 90 days, two rotating crews across the first seven days, one full maintenance day, and one operator vacancy. As the coordinator, locate the vacancy, assign Sam Cruz, review the inherited baseline approval, confirm, open the linked dispatch, and return to the same phase. The maintenance shifts remain flagged. Use a separate approver session to exercise baseline and locked exception decisions.

## Verification

Focused backend coverage is in `tests/Feature/Operations/ProjectPlanningTest.php`, alongside regression coverage in `DispatchV2CommandLayerTest.php` and `DispatchWorkflowTest.php` (46 tests, 382 assertions). Five React tests in `tests/React/Components/ProjectPlanning.test.tsx` cover first-phase creation, preserved editor state and expected versions, allocation preview invalidation, actionable maintenance/coverage gaps, and stale candidate prevention on role switches.

The acceptance browser walkthrough uses the isolated SQLite database. It does not validate live Core 1/WFM integration or deploy the schema to the configured operational PostgreSQL database.
