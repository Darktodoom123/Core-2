# Microservice restructuring progress

Updated: 2026-09-08. Status: handoff documentation prepared; application restructuring has not started.

## Workspace and execution

Worktree: C:/Users/User/.codex/worktrees/0be1/Core-2.
Baseline: caac3d40cbddd36f8b96a54bc7b79f189aa14aee (detached HEAD).
Original checkout/data must remain untouched.
Intended implementer: 3.8 Flash externally; reviewer: Astra. Flash is unavailable in this authoring session.
No commits, pushes, deployments, imports or database deletions performed.

## Completed evidence

- Composer installation succeeded before baseline continuation.
- Focused SQLite baseline: 122 selected tests, 120 passed and 2 failed due to missing Vite manifest; 618 assertions in that run.
- npm ci: exit 0, 1297 packages added; package/lock files unchanged.
- npm run build: exit 0, Vite 8.2.0, 2882 modules, 32.53 seconds.
- Targeted report-normalization rerun: 2 passed, 20 assertions.
- Workspace/candidate performance rerun: 5 passed, 104 assertions.
- These results cover the selected 122 cases across runs, not a fresh full-suite execution.
- Service/data ownership inventory completed. Field reports and AI acceptance remain Operations.
- User clarified undeployed status, preserve development data, rebuild mobile together, retain HostForge.
- New Docs/microservice package supersedes live-production cutover planning.

Ignored raw logs remain under storage/framework/testing: phase0-npm-ci.log, phase0-npm-build.log, phase0-report-export-rerun.log, phase0-performance-rerun.log. Historical baseline details were consolidated here; those logs are local evidence, not committed artifacts.

## Open gates

Phase 1 wiring batch (2026-09-09): Nx 23.2.0 installed with explicit Operations/mobile tasks, no existing dependency version changes, no source relocation, and caching disabled. Existing npm/Composer commands preserved. Graph discovery and affected selection checked for PHP, mobile and root files. Web/mobile type checks and web formatting passed through Nx. PHP lint failed identically directly and through Nx on unchanged SosIncidentLifecycleTest.php; web lint reported 17 errors/2 warnings in unchanged mobile files. These checks are not waived. Phase 1 is not accepted; cache validation, remaining test/build evidence and existing lint blockers require review before Phase 2. Original development data untouched.

2026-09-09 continuation: local baseline evidence reviewed; begin Phase 1 in place. Selected Nx 23.2.0 (current registry stable) for a pinned installation and runtime verification on Node 22.13.0. No other dependency upgrades authorized by this batch. Context7 unavailable; official Nx project/executor documentation used as fallback. Caching remains disabled for this first wiring batch.

- Phase 0 isolated service database configuration is specified, not provisioned. Configure/test it before DB-backed restructuring.
- Linux/PostgreSQL concurrency not run; Windows lacks required pcntl functions.
- Current npm audit reported fast-uri high advisory and six moderate transitive findings. No automatic fix applied; reassess and address before release.
- Build had a large-chunk warning; no performance claim follows from build success.
- HostForge capabilities, costed resources, production workload and restore evidence unverified.
- Nx task wiring is implemented as a first batch; Phase 1 acceptance is still open. Runtime relocation/integration/extractions/distributed checks/deployment are not implemented.
- Exact AI bounded-input/proposal schemas and all Reporting dataset mappings must be frozen/reviewed in their first batch before extraction.
- Existing deployment documentation edit predates this handoff; preserve its useful caveats while correcting undeployed status.

## Usage checkpoint and next action

The authoring session observed 93% of the five-hour usage window consumed after verifying this package. Stopped safely at this documentation boundary; preserve files and wait for the user's next execution/resume instruction. No reset credit was consumed.

Documentation verification: git diff --check passed; 13 new/index documents and 16 local links checked with no missing targets or conflict markers. The handoff folder and index are no longer Git-ignored. Application tests were not repeated for this documentation-only change. Changed tracked paths: .gitignore, Docs/architecture/docker.md, Docs/architecture/deployment.md; new trackable paths: Docs/README.md and Docs/microservice/. Historical ignored plans were marked superseded. Existing development data and the original checkout were untouched.

2026-09-09 checkpoint: Nx Operations build passed (43.75s Vite build); project discovery, PHP/mobile/root affected selection, web/mobile types and formatting passed. Existing PHP and mobile lint failures are recorded above. No application code or database changes. No task-owned commands remain running. Next: investigate the existing lint blockers and finish remaining Phase 1 unit/mobile verification before acceptance; do not begin relocation or enable caching yet. Nx 23.2.0 is pinned; 0 pre-existing locked dependency versions changed. Do not repeat passing checks without relevant changes.

For each future batch append: phase/batch, revision, files changed, commands with exit/results, failures/risks, reviewer decision, task-owned processes, and exact next action. Never mark a phase complete based solely on generated scaffolding.
