# Continuous Integration

Last reviewed: 2026-09-28.

Core-2 has one GitHub Actions workflow, [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml). Shared PHP, Composer, and Node setup lives in [`.github/actions/setup`](../../.github/actions/setup/action.yml).

## When it runs

| Trigger | Lanes |
| :--- | :--- |
| Pull request into `main` | Only the lanes the changed paths touch |
| Push to `main` | Every lane |
| Nightly, 02:00 Asia/Manila | Every lane on `main` |
| Manual (`workflow_dispatch`) | Every lane |

Pushes to `main` never skip lanes, so a small commit cannot report green while an untouched area is broken.

## Lanes

| Job | Checks |
| :--- | :--- |
| PHP quality | `composer validate --strict`, Pint (`composer lint:check`), PHPStan (`composer types:check`), `composer audit` |
| Web quality | Prettier, ESLint, `tsc`, Vitest, `npm audit --omit=dev`, image-size hardening |
| Build web assets | `npm run build` once; the result is shared with the test lanes |
| Operations tests | Operations Pest suite on SQLite |
| Tracking tests | Tracking Pest suite |
| PostgreSQL security & concurrency | Migrations apply, fully roll back, and re-apply; row-lock concurrency suite; RLS and grant suite |
| Browser acceptance & accessibility | Playwright accessibility smoke test and acceptance suite |
| Mobile package & bundling | Mobile typecheck, unit and component tests, Expo Doctor, Android bundle export |
| Docker build & service integration | Dockerfile check, production and Tracking images, frontend build verification, service integration contract, Compose smoke test |
| `ci-gate` | Passes only when every lane passed or was skipped |

`ci-gate` is the single required status check on `main`.

## Running the same checks locally

Run from the repository root:

| Scope | Command |
| :--- | :--- |
| Quality, backend, and mobile lanes | `composer run ci:check` |
| Browser lane | `npm run build`, then `npm run test:a11y` and `npm run test:e2e` |
| Docker lane | `npm run test:integration:services` |

The PostgreSQL concurrency suite needs the POSIX PCNTL extension, so it only runs on Linux (CI or the Docker `test-runner` image). On Windows, check the migration round trip against a scratch PostgreSQL database:

```bash
php apps/operations/artisan migrate:fresh --force --database=pgsql
php apps/operations/artisan migrate:reset --force --database=pgsql
php apps/operations/artisan migrate --force --database=pgsql
```

Point `DB_DATABASE` at a throwaway database first; these commands drop every table.

## Keeping CI green

- A migration that drops tables cannot be reversed, so earlier migrations' `down()` methods must check `Schema::hasTable()` before touching those tables. The PostgreSQL lane's round trip catches this.
- Git does not track empty directories. A test that reads a directory must not depend on one that only exists locally.
- Dependabot opens grouped weekly updates for npm, Composer (`apps/operations`, `apps/tracking`), Docker, and GitHub Actions. Merge them only when `ci-gate` passes.
