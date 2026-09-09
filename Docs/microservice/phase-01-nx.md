# Phase 1 — Add Nx in place

Prerequisite: Phase 0 local baseline reviewed. No application relocation or service extraction in this phase.

## Current wiring (2026-09-09)

Nx 23.2.0 is pinned. Project names are operations and field-mobile. Existing npm and Composer scripts remain unchanged; only explicit project.json tasks are exposed to Nx. Use npx nx run operations:web-types or npx nx run field-mobile:typecheck from the root. Operations targets also cover build, php-lint, php-types, php-test, web-lint, web-format, web-test, browser-test and a11y-test. Mobile exposes test and Android export build plus root-wide web-lint/web-format wrappers because those existing checks include mobile files.

The field-mobile project conservatively depends on Operations while API/configuration share the root. A PHP/root configuration change selects both; mobile changes select mobile, whose root-wide lint/format wrappers preserve coverage. If both projects are selected, those two checks may run twice; optimization is deferred until physical separation. No cache reuse is enabled, no Nx Cloud is configured, and run-command tasks are serial by default. Do not use affected selection as a substitute for the full phase review gate.

## Batches

1. Check current Nx docs via Context7 and npm package engine metadata. Select and pin a stable compatible Nx version and record it in progress before installation. Retain current npm workspaces. If existing Node cannot support the selection, use a compatible task runtime; do not silently upgrade unrelated dependencies.
2. Define explicit logical projects operations (root PHP/web application) and field-mobile (existing package). Use run-command targets for Composer/Artisan and existing npm scripts. Disable inferred duplicate tasks where they conflict. Do not fabricate empty service projects yet (under Plan A, only `tracking` will be added in Phase 5).
3. Expose Operations build, PHP lint/types/tests, web lint/format/types/unit checks, and mobile types/tests/build targets. Original root npm/Composer commands continue to work. Do not create recursive wrappers where an npm script invokes an Nx target that invokes that script.
4. Declare PHP/shared tool configuration and lockfiles as relevant inputs. Keep outputs unique. Until projects are physically separated, use conservative inputs: a broader rerun is safer than a missed dependency. Do not imply frontend/Composer import inference exists.
5. Ignore Nx local cache/state. Leave Nx Cloud unconfigured. Default targets uncached; enable only validated deterministic lint/type/build targets, excluding secrets, test data, logs and private exports from artifacts.

## Interfaces and acceptance

No public API, schema, UI or domain-type changes. Verify project listing, task graph, original-vs-Nx command equivalence, failure exit propagation and no test omission. Use temporary controlled edits restored afterward to prove affected selection and cache invalidation for PHP source, mobile source, root lockfile and shared configuration. Inspect restored status; never discard unrelated changes.

Run relevant existing lint/type/format/unit checks and production build after wiring. A baseline failure is documented and investigated, not hidden by changed target scope. Add a small task-configuration regression check only where it tests actual selection/exit behavior rather than mirrors JSON.

## Stop/review

Stop if engine compatibility requires unrelated upgrades, outputs leak private data, or affected tasks miss required consumers. Reviewer inspects dependency/lock diff, graph evidence, command equivalence and cache tests. No directory moves until accepted.
