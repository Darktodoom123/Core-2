# Core-2 microservice implementation handoff

Status: implementation specification; application extraction has not started.
Updated: 2026-09-08.

This is the authoritative pre-deployment restructuring plan. It supersedes the live-production cutover assumptions in the earlier migration plan. The user confirmed that the application is undeployed, existing development data must be preserved, and backend/mobile builds may be updated together.

## Read and execute in order

1. [Architecture and invariants](architecture.md).
2. [Progress and continuation checkpoint](progress.md).
3. [Phase 0: baseline](phase-00-baseline.md).
4. [Phase 1: Nx](phase-01-nx.md).
5. [Phase 2: repository and runtime](phase-02-runtime.md).
6. [Phase 3: service integration](phase-03-integration.md).
7. [Phase 4: AI generation](phase-04-ai.md).
8. [Phase 5: Tracking](phase-05-tracking.md).
9. [Phase 6: Reporting](phase-06-reporting.md).
10. [Phase 7: distributed verification](phase-07-verification.md).
11. [Phase 8: first deployment](phase-08-deployment.md).

## Execution agreement

3.8 Flash is the user's intended implementer; Astra reviews actual changes and evidence. Flash is not available through the authoring session's tools. These documents do not claim that Flash was launched or that later phases were implemented.

Implement one numbered batch at a time. Read applicable AGENTS.md and nearby conventions; fetch current framework/tool documentation through Context7 before version-sensitive implementation. Keep the existing stack and dependency locks unless the current batch specifically requires a change.

At each phase boundary, stop and record changed files, exact checks/results, unresolved failures, risks, and the next batch in progress.md. Astra inspects the diff and verification evidence; a worker's completion statement alone is not approval. Resolve review findings before advancing.

No automatic commits, pushes, PRs, deployment, destructive data operations, or usage-reset redemption. Existing development databases/files are preserved. No data import is authorized. Use synthetic fixtures and isolated resources.

Check usage at task boundaries. Stop new work before capacity becomes insufficient for a checkpoint, preserve unfinished changes, stop/drain only task-owned processes safely, and record their state. Resume after the user returns. Never claim an interrupted check passed.

## Completion means

Four independently deployable Laravel services with exclusive data ownership, working web/mobile workflows, verified failure behavior, reviewed security, and accurate operating documentation. Nx, containers, folders, or service scaffolds alone do not establish completion. First deployment requires separate authorization.

The phase briefs define implementation batches, not permission to bypass an unmet test or invent unsupported hosting capabilities.
