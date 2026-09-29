# Defense presentation: BJ walkthrough

`DefensePresentationSeeder` prepares one live walkthrough. The Operations Manager (`manager`) turns a Core 1 service request into a dispatch, links BJ (username `operator`) and a crane, approves and activates it. BJ then completes the job in the field app. The seeder is opt-in and not part of `DatabaseSeeder`. It runs freely in local and testing; on a live server it needs `DEMO_SEED=true` (see [On the live site](#on-the-live-site-hostforge)).

## What the normal local seed already has

`php artisan db:seed` in the local environment (`DatabaseSeeder` → `LocalDevelopmentSeeder`) creates:

| Area | Records |
| --- | --- |
| Accounts | `admin` (System Administrator), `manager` (Operations Manager), `operator` (Operator, BJ). Names and emails come from the untracked `LOCAL_*_NAME` / `LOCAL_*_EMAIL` values in `.env`. |
| Operators | 11 Alibaton operators from `AlibatonPersonnelSeeder`, each with a username from their email (for example `ferdinand.macaraeg`) and credentials. |
| Fleet | 35 assets from `AlibatonCraneFleetSeeder`: 4 mobile cranes (`MOB-CRN-401` to `404`), 5 heavy equipment units (`HEQ-LG-*`) and 26 tower cranes (`PRJ-TWR-*`, `TWR-*`). |
| Sample jobs | `DSP-2026-0891` (from `OperationalTestSeeder`) and `DSP-PH-2026-001` (from `PhilippineSafetyOperationsSeeder`), both with BJ assigned and an open shift. |

The local seed has **no** Core 1 service requests, no asset inspections, no fleet documents, and no HR profile for BJ. Without these, **Incoming work** is empty and **Activate dispatch** is blocked. The defense seeder adds them.

## What the defense seeder adds

| Subsystem | Data |
| --- | --- |
| **Core 1** (orders) | Three routine service requests waiting in **Dispatch workspace → Incoming work** (`SR-C1-2026-1001` to `1003`), dated 08:00 Manila time on the next working morning. |
| **Core 3** (equipment) | A passing safety inspection for every asset that lacks one, so every unit can be linked and activated. |
| **Core 4** (documents) | Valid fleet permits for each asset's required categories (registration, insurance, emission, load test). Also 4 personal documents per operator (TESDA NC II, LTO professional licence, BOSH, medical). Every document gets a sample PDF watermarked as not valid. |
| **Core HR** (people) | An employee number and **available** status for BJ and the spare operators. |
| Spare operators | `operator1` to `operator5`. Their emails use plus-addressing on BJ's email (for example `name+operator1@gmail.com`), so any sign-in email reaches BJ's inbox. |
| BJ reset | Cancels the two sample jobs above, or any job still open for BJ or the spares, and ends their open shift. BJ's phone starts clean. |

## Run it

Rebuild the app image if it predates the seeder (`docker-up.local.bat`), then run:

```bash
docker compose exec --user www-data app php artisan db:seed --class='Database\Seeders\Development\DefensePresentationSeeder' --force
```

Run it again before each rehearsal and on the morning of the defense. Each run releases the demo operators, tops the Core 1 queue back up to three requests, and moves them to the next 08:00. It does not duplicate anything.

Do **not** run a plain `php artisan db:seed` afterwards. `OperationalTestSeeder` puts BJ back on job `DSP-2026-0891` with an open shift. If that happens, run this seeder again.

## On the live site (HostForge)

The live site has its own database. Nothing seeded on a laptop appears there. Outside local, the seeder is **off by default** and refuses to run until you turn it on. It writes sample records into that database (Core 1 requests, inspections, sample permits, spare operators), so use it only while the live site serves the capstone.

1. **Push** the code so HostForge redeploys it.
2. **Accounts:** in HostForge's environment variables, make sure these are set: `MANAGER_EMAIL`, `MANAGER_PASSWORD`, `OPERATOR_EMAIL` (BJ's email), `OPERATOR_NAME` (`BJ Bello`) and `OPERATOR_PASSWORD`. Passwords need 12+ characters; mark them Secret. Then run `php artisan db:seed --force` once in the HostForge console. Without this, the live site has no `manager` or `operator` account.
3. **Turn the demo on:** add `DEMO_SEED=true` and `DEMO_OPERATOR_PASSWORD` (12+ characters, Secret) to HostForge. The spare operators `operator1` to `operator5` use this password, never `password`. Redeploy or restart so the settings load.
4. **Seed the demo** in the HostForge console:

   ```bash
   php artisan db:seed --class='Database\Seeders\Development\DefensePresentationSeeder' --force
   ```

   If the live database has no Alibaton fleet, this first adds the same 35 assets as the local seed. Sample PDFs go to the configured attachment storage (R2), so they survive redeploys.
5. **Point the phone app at the live site** and sign in as `operator` with `OPERATOR_PASSWORD`.
6. **After the defense:** remove `DEMO_SEED` and `DEMO_OPERATOR_PASSWORD` from HostForge, and suspend `operator1` to `operator5` from **Users & access** if you no longer need them.

## Accounts

Locally, all accounts use the local development password. On the live site, `manager` and `operator` use `MANAGER_PASSWORD` and `OPERATOR_PASSWORD`, and the spare operators use `DEMO_OPERATOR_PASSWORD`.

| Username | Who | Where |
| --- | --- | --- |
| `manager` | Operations Manager: converts, links, approves, activates | Web |
| `operator` | BJ | Field app |
| `operator1` to `operator5` | Spare operators | Field app |

## Live script

1. **Web, as `manager`:** Dispatch workspace → **Incoming work** → open `SR-C1-2026-1001` → **Review** → **Check for duplicates** → set the dispatch reference and times → **Create draft dispatch**.
2. **Link the crew and the unit:** click **Assign resources**. Under People, **Select** BJ Bello. Under Assets, **Select** a mobile crane (for example `MOB-CRN-401`); this links the unit to the job. Then click **Assign selected resources**. Before this step, BJ's phone shows **No unit assigned**. That is expected.
3. **Approve:** saving the assignment creates an approval request. Every dispatch needs one. The Operations Manager can approve their own: **Approve request**.
4. **Activate:** **Review readiness and activate** → **Activate dispatch**.
5. **Phone, as `operator` (BJ):** Home now shows the linked crane instead of **No unit assigned**. **Hours of Service** → start shift → **Start Pre-Trip DVIR Inspection** → **Dispatch → Respond** → **Accept Dispatch** → hold **Start Transit** → hold **Arrived On Site** → **Begin Work** → **Complete Job** → client signs.
6. **Core 4 on the phone:** the **Documents** tile shows BJ's licences. After the crane is linked, it also shows that crane's permits.
7. **Web, as `manager`:** **Job reports** → **Approve Report**. The job moves to History.

See [click-by-click user flows](click-by-click-user-flows.md) for every button.

## Verification

`tests/Feature/Operations/DefensePresentationSeederTest.php` seeds the local development data and then this seeder. It checks that BJ is released, that the fleet and documents are complete, and that one manager can convert, link BJ and a crane, approve and activate. It also checks the spare-operator emails and that re-running does not duplicate records. For live servers, it checks that the seeder refuses to run without `DEMO_SEED`, rejects a weak `DEMO_OPERATOR_PASSWORD`, and gives the spare operators the configured password.
