# Defense demo scenario

`DefenseDemoSeeder` is opt-in, restricted to local/testing, and is not part of `DatabaseSeeder`. It drives seven Core 1 service requests through the real dispatch actions and stops each one at a different lifecycle stage, so the full flow can be presented live.

It seeds into the normal local database and only adds records (`DEF-*` cranes, demo usernames, `SR-C1-2026-01xx` / `DSP-2026-01xx` references), so existing data is untouched.

## Seed

```bash
docker compose exec --user www-data app php artisan db:seed --class='Database\Seeders\Development\DefenseDemoSeeder' --force
```

If the app image predates the seeder, rebuild with `docker-up.local.bat` first. A second run is a no-op once the demo exists.

## Accounts

The demo accounts use the same local-only password as the default developer seed.

| Username | Role | Purpose |
|---|---|---|
| `dispatcher.linking` | Operations Manager | Presenter: converts Core 1 orders and links cranes and crew |
| `ops.approver` | Operations Manager | Second approver (self-approval is blocked) |
| `operator.rsantos`, `operator.jvillanueva` | Crane operator | Field app |

## Walkthrough

| Reference | Stage | Live step |
|---|---|---|
| `SR-C1-2026-0101` | New Core 1 order | Convert to a draft dispatch |
| `DSP-2026-0102` | Draft, nothing linked | Link a crane and crew (`DEF-CRN-5006`, `DEF-CRN-2507` are free) |
| `DSP-2026-0103` | Priority, approval pending | Approve as `ops.approver` |
| `DSP-2026-0104` | Dispatched for tomorrow | The local quick-login operator (`operator`) accepts in the field app |
| `DSP-2026-0105` | Crew on site | Shift, pre-trip DVIR, fuel request awaiting approval |
| `DSP-2026-0106` | Work finished | Review the job report; approval completes the job |
| `DSP-2026-0107` | Closed five days ago | Complete record: fuel logged, client sign-off, approved report |

## Verification

`tests/Feature/Operations/DefenseDemoSeederTest.php` seeds the scenario and asserts every stage, including that a second run changes nothing.
