# Operations Workspace Performance — AI Verification

## 1. Did you build this the most secure way?

Yes. Candidate discovery remains permission-gated by `AssignmentsViewAll`; assigned field users receive an empty candidate contract and execute no candidate read-model queries. Canonical assignment and activation authorization, validation, locking, and final eligibility revalidation remain unchanged. Telemetry records route/status/timings/counts/modes and bounded metadata only; it does not record SQL bindings, user data, credentials, or secrets. The migration uses PostgreSQL indexes only and adds no public Supabase views, RPCs, Data API grants, or connection-policy changes.

## 2. Did you build this the most efficient way?

Yes for the implemented scope. The workspace controller now sends a small shell and evaluates only the authorized initial section through deferred props; inactive sections use optional props and mapped partial visits. Dispatch candidate pages select bounded fields, paginate before evaluation, batch maintenance/inspection/dispatch/rental/sales evidence for the page, and never call `OperationalAssetAvailability::assess()` per row. The PostgreSQL migration adds only the read-model indexes used by these shapes, with a Laravel fallback for non-PostgreSQL test environments.

## 3. What regressions could this introduce?

The main risks are callers that assumed workspace or candidate arrays were present in the initial Inertia response, stale candidate results after a job version/schedule change, deployment plans that do not allow concurrent index creation, and query-plan differences between SQLite tests and representative PostgreSQL data. The UI preserves selection IDs and exposes retry/stale states, but production rollout still needs real PostgreSQL telemetry and conflict-equivalence review. The benchmark script has no baseline until it is run against an authenticated representative environment.

## 4. What tests do we need to write before we ship this?

Focused Pest coverage now exercises deferred shell/section contracts, authorization suppression, request bounds, payload shape, and fixed candidate query count as the asset pool grows from 5 to 200; existing assignment, rental, approval, activation, and workspace tests cover canonical behavior and were updated for explicit deferred loading. PostgreSQL-only index assertions are in `tests/PostgreSQL/DispatchCandidateQueryTest.php`. Before release, run the benchmark against staging PostgreSQL for p50/p95 timing, query headers, database time, and payload bytes; compare against a captured pre-optimization baseline, inspect `EXPLAIN (ANALYZE, BUFFERS)` for finalized shapes, and run browser accessibility/deferred retry/stale-selection smoke coverage.
