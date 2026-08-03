# Docker operations

**Last updated:** 2026-08-02

This guide covers the repository's Docker Compose stack for local evaluation and
self-hosted testing. The stack builds the Laravel/Inertia application, serves it
through Nginx, runs background processes, and provides PostgreSQL 16 and Redis 7.

## Stack layout

| Service | Container     | Purpose                                             | Host access                                                    |
| ------- | ------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| `app`   | `core2-app`   | Nginx, PHP-FPM, queue worker, scheduler, and Reverb | HTTP `${PORT:-8000}`, WebSocket `${REVERB_FORWARD_PORT:-8080}` |
| `db`    | `core2-db`    | PostgreSQL 16                                       | Internal Compose network only                                  |
| `redis` | `core2-redis` | Redis 7                                             | Internal Compose network only                                  |

The `app` image is a production-style multi-stage build. Composer installs
production PHP dependencies, Node builds the Vite assets, and Supervisor starts
the application processes in the runtime container. PostgreSQL, Redis, and
Laravel storage use named volumes so `docker compose down` does not delete their
data.

Redis is available to the application, but the default Compose configuration
continues to use the file cache, database queue, and file sessions unless those
drivers are explicitly changed.

## Prerequisites

- Docker Desktop, or Docker Engine with Docker Compose v2
- Git
- Free host ports `8000` and `8080`, or alternate values configured in `.env`

PHP, Composer, Node.js, PostgreSQL, and Redis do not need to be installed on the
host for this workflow.

## First-time setup

### 1. Create the environment file

Copy the example file without committing the resulting `.env`:

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

### 2. Set the required Docker values

Generate a Laravel application key using a temporary PHP container:

```bash
docker run --rm php:8.4-cli-alpine php -r "echo 'base64:', base64_encode(random_bytes(32)), PHP_EOL;"
```

Put the generated value in `APP_KEY`, then set at least these values in `.env`:

```dotenv
APP_ENV=production
APP_KEY=base64:replace-with-generated-value
APP_DEBUG=false
APP_URL=http://localhost:8000

DB_DATABASE=core2
DB_USERNAME=core2
DB_PASSWORD=replace-with-a-strong-password

REVERB_APP_ID=core2-local
REVERB_APP_KEY=core2-local-key
REVERB_APP_SECRET=replace-with-a-random-secret

VITE_REVERB_HOST=localhost
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

`REVERB_APP_KEY` is embedded in the browser bundle and is not a secret.
`DB_PASSWORD`, `APP_KEY`, and `REVERB_APP_SECRET` must remain private. A random
secret can be generated with:

```bash
docker run --rm php:8.4-cli-alpine php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
```

When changing the host ports, keep the public URLs aligned:

```dotenv
PORT=8001
APP_URL=http://localhost:8001
REVERB_FORWARD_PORT=8081
VITE_REVERB_PORT=8081
```

The internal database, Redis, and Reverb hostnames and ports are supplied by
Compose. Do not replace `DB_HOST`, `REDIS_HOST`, or the server-side Reverb host
with host-machine addresses for this stack.

### 3. Validate and start the stack

Validate interpolation and the final Compose model before building. The output
contains resolved environment values, so do not publish it:

```bash
docker compose config --quiet
docker compose up -d --build
```

Compose waits for healthy database and Redis services before starting `app`.
The application entrypoint then creates runtime directories and runs
`php artisan migrate --force` by default. Set `RUN_MIGRATIONS=false` only when
migrations are managed separately.

### 4. Check readiness

```bash
docker compose ps
docker compose logs --tail=100 app
curl --fail http://localhost:8000/up
```

On Windows PowerShell, the equivalent health request is:

```powershell
Invoke-WebRequest http://localhost:8000/up
```

Open [http://localhost:8000](http://localhost:8000). Reverb is exposed at
`ws://localhost:8080` with the default settings.

### 5. Seed optional development data

```bash
docker compose exec --user www-data app php artisan db:seed
```

Seeding creates development data and should be reviewed before it is run in a
shared or production-like environment.

## Common operations

```bash
# Follow all service logs
docker compose logs -f

# Follow only the application processes
docker compose logs -f app

# Run Artisan inside the application container
docker compose exec app php artisan about

# Rebuild after application or dependency changes
docker compose up -d --build

# Stop containers while preserving named volumes
docker compose down
```

Changes to `VITE_*` variables require an image rebuild because they are compiled
into the frontend bundle. Runtime-only environment changes require the `app`
container to be recreated:

```bash
docker compose up -d --force-recreate app
```

## Data and reset behavior

The stack creates these named volumes:

- `core2_postgres-data` for PostgreSQL
- `core2_redis-data` for Redis
- `core2_storage-data` for Laravel runtime storage

`docker compose down` preserves them. To remove the containers, network, and all
three named volumes, use the following destructive reset only when the stored
data is no longer needed:

```bash
docker compose down --volumes
```

This reset permanently removes the Compose-managed database, Redis data, and
Laravel storage. It cannot be undone unless those volumes were backed up.

## Troubleshooting

### Compose reports a required variable is missing

Run `docker compose config --quiet` and add every reported value to `.env`. The
Compose file intentionally requires the application key, PostgreSQL credentials,
and Reverb credentials rather than silently using unsafe defaults.

### A host port is already in use

Set `PORT` or `REVERB_FORWARD_PORT` in `.env`. Also update `APP_URL` or
`VITE_REVERB_PORT` as shown in the first-time setup so browser traffic continues
to use the published ports.

### The browser uses stale frontend settings

Rebuild the image after changing any `VITE_*` value:

```bash
docker compose build --no-cache app
docker compose up -d app
```

### The application container is unhealthy or restarts

Inspect its recent output and resolved service state:

```bash
docker compose ps
docker compose logs --tail=200 app
```

Common causes are an invalid `APP_KEY`, unavailable host ports, incorrect
database credentials with an existing PostgreSQL volume, or a failed migration.

## Production boundary

This Compose stack does not by itself provide TLS termination, secret management,
off-host backups, high availability, autoscaling, or monitoring. Use it as a
local/self-hosted baseline. The accepted production topology remains the managed
single-region deployment described in [Architecture](./Architecture.md).
