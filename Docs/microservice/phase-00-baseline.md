# Phase 0 — Preserve baseline and isolate resources

Prerequisite: read README, architecture and progress. Work only in the assigned migration worktree.

## Batches

1. Inspect git status/revision, applicable instructions, manifests and locks. Preserve the pre-existing deployment-document edit. Record existing public route/resource shapes, source table ownership, and available test evidence. Do not repeat verified passing tests without a relevant change.
2. Record undeployed status and remove claims of an already running production system from current deployment guidance. Keep HostForge as proposed hosting with unverified capabilities. Local preparatory phases do not require production account access.
3. Specify isolated database names (`core2_ms_operations` and `core2_ms_tracking`) / Compose project (`core2-ms`) from architecture.md and test environment values. Before any database command, verify APP_ENV, DB_CONNECTION, DB_DATABASE, DB_URL and host explicitly; no implicit inherited values. Current SQLite anchors use :memory:, array cache/session/mail and sync queues.
4. Record pending Linux/PostgreSQL concurrency, dependency advisories, capacity and recovery evidence. Configure isolated PostgreSQL resources in Phase 2, not by connecting to an existing local database.

## Evidence to preserve

Baseline revision caac3d40cbddd36f8b96a54bc7b79f189aa14aee.
PHP 8.4.22, Composer 2.9.2, Node 22.13.0, npm 10.9.2 were observed.
Composer installation completed before the resumed baseline.
122 selected SQLite tests initially yielded 120 pass / 2 fail (missing Vite manifest); after npm ci and build the two report normalization cases passed (20 assertions). Five workspace/candidate performance fixture tests then passed (104 assertions). This is not a fresh all-122 rerun or a production benchmark.
npm ci and build exited 0 without package/lock changes; Vite 8.2.0 built in 32.53 seconds.
A read-only audit reported six moderate and one high transitive finding (fast-uri); reassess current advisory status before remediation/release.

Selected suites: mobile lifecycle, location privacy/API, job reports, report exports, recommendation workflow/acceptance. Concurrency suites require Linux pcntl plus isolated PostgreSQL; Windows SQLite does not replace them.

## Acceptance and stop conditions

Baseline results are recorded honestly; existing databases/files remain untouched; future test connections are explicit. Missing hosting evidence blocks deployment, not local Nx work. Missing invariants or unsafe database isolation blocks the affected batch. Do not label Phase 0 production-ready.

Reviewer checks source ownership, preserved edits, no database mutations, and distinction between observed results and targets. Record the next batch in progress.md.
