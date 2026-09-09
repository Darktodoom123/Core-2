# Phase 2 — Repository layout and runtime separation

Prerequisite: Phase 1 accepted. Preserve original checkout/databases; all changes stay in migration worktree.

## Batches

1. Inventory every path-dependent script/config before moving. Move Laravel-owned app, bootstrap, config, database, routes, resources, public, storage, artisan and Composer files into apps/operations. Relocate relevant PHP test/tool configuration with the service; retain root orchestration and mobile package. Keep root Composer/npm entry points as forwarding wrappers without duplicate authoritative dependency manifests.
2. Update Vite/Wayfinder generation, TypeScript aliases, PHP tooling, browser tests, mobile API helpers, Docker contexts, CI and documentation atomically. Root npm workspaces add apps/*; do not move packages/field-mobile. Reserve `apps/tracking` as the only secondary service directory under Plan A.
3. Build immutable Operations image; run separate HTTP, dedicated queue workers (default, `ai` for OpenRouter LLM, and `reports` for compliance exports), scheduler and Reverb roles. Nginx/PHP-FPM may be separate containers of one logical HTTP concern. Static assets must match the PHP release. Put isolated topology in infra/compose and keep root developer commands forwarding to it.
4. Provision only core2-ms task resources and per-service database roles (`core2_ms_operations` and `core2_ms_tracking`) plus Redis. No published database administration ports by default; RabbitMQ is eliminated. Commit placeholders; generate secrets locally. Add private persistent attachment/export storage and task-only scratch paths.
5. Fix worker/redelivery/drain mismatch: inventory all job timeouts, set retry_after strictly longer than the largest job timeout plus safety margin, and termination/drain grace beyond that execution window. Test actual worker crash/recovery. Migrations run as one explicit setup/release job, not every application replica startup.
6. Schedule one execution per due job via singleton scheduler plus appropriate locks. Add separate liveness/readiness checks and verify optional downstream outages do not restart Operations.

## Acceptance

Original and Nx commands work from repo root. Run relevant PHP/web/mobile checks and build; inspect generated paths and final diff for accidental deletions. Linux container tests verify queue shutdown, scheduling, persistence after container replacement, and inability of service roles to access other databases.

No application-level service extraction yet. No edits to existing database schemas or uploads outside the isolated stack. Stop on unresolved path/permission regressions or inability to demonstrate isolation.

Reviewer accepts moved-file mapping, root compatibility, image build, worker timing evidence and storage/secret boundaries before Phase 3.
