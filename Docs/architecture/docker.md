# Docker operations

## Scope

This repository uses one production-style application image. Supervisor keeps
Nginx, PHP-FPM, the Laravel queue worker, the Laravel scheduler, and Reverb in
that image; Compose supplies PostgreSQL 16 and Redis 7. This topology is kept
for the current application boundary. It is a local/staging reference, not a
complete production platform: production still needs an approved secret
manager, TLS/reverse proxy, backups, centralized logs/metrics, resource
limits, and an explicit deployment/rollback process.

## Prerequisites and setup

Use Docker Desktop with the Linux engine, Docker Compose v2, and BuildKit.
From the repository root:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Set these values in the untracked `.env` before running Compose:

```dotenv
APP_ENV=production
APP_KEY=base64:<generated-application-key>
APP_DEBUG=false
APP_URL=http://localhost:8000
DB_CONNECTION=pgsql
DB_HOST=db
DB_PORT=5432
DB_DATABASE=core2
DB_USERNAME=core2
DB_PASSWORD=<local-only-password>
REVERB_APP_ID=core2-local
REVERB_APP_KEY=<public-browser-key>
REVERB_APP_SECRET=<server-only-secret>
VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
# Public browser map configuration; these values are compiled into the bundle.
VITE_MAP_PROVIDER=stadia
VITE_MAP_PLAN=starter
VITE_MAP_USE_CASE=commercial
VITE_MAP_STYLE_URL=
VITE_MAP_ATTRIBUTION=
VITE_STADIA_MAPS_API_KEY=<public-browser-key>
RUN_MIGRATIONS=true
CACHE_CONFIG=true
```

Generate `APP_KEY` with `php artisan key:generate --show` after the PHP
dependencies are installed, or with an approved local key-generation process.
Do not commit `.env`, place server-only credentials in build arguments, or add
generated secrets to the Dockerfile. Every `VITE_*` value is public in the
browser bundle; the Stadia key is a public browser credential and should be
restricted by domain/referrer in the provider dashboard. `REVERB_APP_SECRET`,
database credentials, and `APP_KEY` remain runtime-only.

For the bundled services, keep `DB_HOST=db` and `REDIS_HOST=redis`. The
server-side Reverb process runs inside `app`, so Compose sets its host to
`127.0.0.1` and its internal port to `8080`; do not replace those with a
host-machine address. `APP_URL` and the public `VITE_REVERB_*` values must use
the published host ports. If `PORT` or `REVERB_FORWARD_PORT` changes, update
`APP_URL` or `VITE_REVERB_PORT` too.

Validate before starting the stack:

```bash
docker compose config --quiet
docker buildx build --check .
```

`config --quiet` is intentionally run with required values supplied but does
not print the resolved environment. The Dockerfile uses locked Composer and
npm dependencies, BuildKit cache mounts, and pinned official-image digests.
Dependabot updates Docker references weekly; review PHP, Alpine, PostgreSQL,
and Redis major-line changes separately.

## Services, ports, and persistence

| Service | Purpose | Host endpoint | Compose endpoint |
| --- | --- | --- | --- |
| `app` | Nginx, PHP-FPM, queue, scheduler, Reverb | `http://localhost:8000`, `ws://localhost:8080` | `app:80`, `app:8080` |
| `db` | Local PostgreSQL 16 | not published | `db:5432` |
| `redis` | Redis 7 | not published | `redis:6379` |

Set `PORT` and `REVERB_FORWARD_PORT` to change the two host ports. The named
volumes are:

- `storage-data` for Laravel storage and logs;
- `postgres-data` for PostgreSQL data;
- `redis-data` for Redis data.

With the default Compose project name, these are named
`core2_storage-data`, `core2_postgres-data`, and `core2_redis-data`; a custom
`-p` project name changes the prefix. `docker compose down` preserves these
volumes. Do not use `docker compose down --volumes` for this workflow: it
deletes the database, Redis, and Laravel storage data and is outside this
change.

For an external PostgreSQL service, set `DB_HOST`, `DB_PORT`, `DB_DATABASE`,
`DB_USERNAME`, `DB_PASSWORD`, and `DB_SSLMODE` in `.env`. The app uses those
values; it does not assume the database host is `localhost`. The bundled `db`
service remains available for local development and the test profile. The
concurrency profile is intended for a local database user that can create the
`core2_concurrency_test` database, or for an already-provisioned equivalent.

## Startup, permissions, and shutdown

The entrypoint requires `APP_KEY` and a supported `DB_CONNECTION`. Networked
database connections require the database host, database name, username, and
password. Reverb credentials are required when
`BROADCAST_CONNECTION=reverb`. Redis host/port are required when a Redis
cache, queue, or session driver is selected.

`RUN_MIGRATIONS` and `CACHE_CONFIG` accept only `true` or `false`. Migrations
default to enabled for the existing Compose behavior. In production mode,
configuration, route, and view caching defaults to enabled. Set either flag to
`false` deliberately when an external deployment process owns that step.

The named storage volume is initialized by the root entrypoint because Docker
creates an empty named volume with root ownership. It is then owned by
`www-data` with `0770` directories and `0660` files. No `chmod 777` is used.
Supervisor remains root only to prepare that volume and bind Nginx to port 80.
Nginx workers use `www-data`; the official PHP-FPM pool uses `www-data` for
workers; queue, scheduler, and Reverb are explicitly configured as
`www-data`. Supervisor program groups receive termination signals so
`docker compose down` can stop the long-running workers cleanly.

After startup, check readiness and recent application output with:

```bash
docker compose ps
docker compose logs --tail=100 app
curl --fail http://127.0.0.1:8000/up
```

In PowerShell, the health request is:

```powershell
Invoke-WebRequest http://localhost:8000/up
```

For local-only seed data, run the command as the application user and review
the seeders before using it against shared data:

```bash
docker compose exec --user www-data app php artisan db:seed
```

Changes to `VITE_*` values require an image rebuild because Compose forwards the
configured values to the frontend build stage and Vite compiles them into the
browser bundle. This includes the map provider, plan, use case, style URL,
attribution, and Stadia browser key. Runtime-only environment changes require
recreating the app container:

```bash
docker compose up -d --build
docker compose up -d --force-recreate app
```

## Concurrency test profile

The test target installs the locked development Composer dependencies without
application scripts before source is copied, then packages the source and
test-entrypoint into a self-contained image. It does not mount the host
working tree or use a host `vendor/` directory.

```bash
docker compose up -d --build
docker compose --profile test run --build --rm test
```

The test entrypoint waits for PostgreSQL, creates
`core2_concurrency_test` when needed, recreates that dedicated disposable
schema with `migrate:fresh`, and then executes the R6 file before the R3 file
from `phpunit.concurrency.xml`. R3 uses Laravel's migration-managed cleanup,
so this explicit order keeps R6's pre-migrated schema available. The R6 test
fixture uses pickup for its direct checkout race; delivery rentals still
require the normal dispatch handoff in application behavior. The test profile
uses a disposable test key and the Compose database credentials; no production
credentials are required in the image. Do not point this profile at a shared
or production database.

## CI and verification

`.github/workflows/docker.yml` checks the Dockerfile, runs quiet Compose
validation with dummy non-secret values, builds both the production and test
targets with official Docker Buildx actions, extracts the final production
bundle, verifies all six public map values are present, rejects the private
Reverb secret if it appears, and runs a bounded health/`/up` smoke check plus
the concurrency profile. The workflow always runs `docker compose down`
without `--volumes`.

For local image review after a successful build, confirm that the final image
does not contain a project `.env` or world-writable paths. The final stage
copies only application runtime paths, `vendor/`, and built assets; build-only
Composer/npm layers are not copied into it. Also run:

```bash
git diff --check
docker compose config --quiet
docker compose ps
curl --fail http://127.0.0.1:8000/up
```

If Docker Desktop's Linux engine is unavailable, static Dockerfile checks,
Compose validation, documentation, and repository checks can still run. Image
builds, container health, `/up`, the profile test, and image filesystem
inspection remain daemon-dependent and must be reported as blocked rather than
claimed as passed.

## Troubleshooting

- If Compose stops before creating containers, run `docker compose config
  --quiet` and check all required `.env` values.
- If `app` exits during startup, inspect `docker compose logs app`; migration
  failures and missing Reverb/database variables are intentional fail-fast
  conditions.
- If a host port is already in use, set `PORT` or `REVERB_FORWARD_PORT` and
  update the matching public URL variables in `.env`.
- If the browser cannot connect to Reverb, rebuild after changing the public
  `REVERB_APP_KEY`/`VITE_REVERB_*` values and verify the host port.
- If the browser uses stale frontend settings, rebuild the `app` image after
  changing any `VITE_*` value. The CI-equivalent bundle check is:

  ```bash
  node scripts/verify-frontend-build.cjs public/build
  ```

  when the six `VITE_*` values are set in the current shell.
- If ports are busy, set `PORT` or `REVERB_FORWARD_PORT`; fixed
  `container_name` values are intentionally not used, so Compose project
  names and scaling remain available.
- If local data must be retained, stop with `docker compose down` and do not
  remove the named volumes.
