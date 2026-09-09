# Phase 4 — Extract AI generation

Prerequisite: integration foundation accepted. Operations recommendation acceptance stays transactional and authoritative.

## Source and ownership

Current source: app/Platform/Gpt (under apps/operations after relocation). BoundedContextBuilder and AcceptGptRecommendation remain Operations. OpenAiClientWrapper and generation execution move to apps/recommendations. Existing gpt_recommendations review state remains Operations; AI gets generation_requests, generation_runs and generation_results. Metrics are split by ownership, not dual-written as shared models.

## Contracts

Operations emits recommendation.generation.requested.v1 with request_id, recommendation_id, actor_id, dispatch_job_id, context_hash, automation_hash (nullable), bounded_context, input_references, requested_at and expires_at. Freeze bounded_context's explicit structure from BoundedContextBuilder into schema/examples; reject extra model/private fields rather than serializing Eloquent. Review that schema before provider code moves.

AI emits recommendation.generation.completed.v1 with request_id, recommendation_id, context_hash, generated_at, proposal, conflicts, response_summary and usage (input/output tokens, estimated cost, latency). proposal permits only the assignment fields accepted by the existing acceptance action; formalize their current enums and validation in the schema.
Failure emits recommendation.generation.failed.v1 with request_id, recommendation_id, stable error_code and retryable; no raw provider response/secrets.

## Batches

1. Define and test contracts against synthetic current builder/results. Create fresh AI schema/image and scoped queues. Unique request_id prevents duplicate generation execution where locally possible.
2. Replace Operations generation job with transactional request/outbox creation. AI consumes bounded input, runs the provider wrapper with existing guards, stores result/outbox atomically, and exposes health/metrics.
3. Operations consumes results into its own proposal/review record. Human acceptance rechecks current permissions, expiry, dispatch context and row locks, using the normal assignment action. A late result cannot reopen decided/expired work.
4. Remove provider credentials/network calls from Operations and update fixture generation/tests. Keep provider calls mocked in normal verification. Explicitly authorize any billable live-provider exercise separately.

## Failure/acceptance

AI outage leaves dispatch usable and proposals pending/failed. Timeout may have incurred provider cost: cap retries, record uncertain attempts, and do not claim exactly-once billing. Test duplicate request/result, delayed/stale/expired proposal, permission revoked during work, provider timeout, crash around result publication, and concurrent acceptance.

Run existing generation/error-handling/acceptance and Linux row-lock suites plus contract/integration checks. Stop if AI can assign resources or accesses Operations tables. Reviewer checks both services' credentials and the acceptance transaction boundary.
