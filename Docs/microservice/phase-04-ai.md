# Phase 4 — OpenRouter AI queue worker & isolation (Plan A: Operations Internal)

Prerequisite: Phase 3 contracts and integration accepted. Recommendation acceptance stays strictly transactional, authoritative, and local to Operations.

## Source and Ownership

- **Code Location**: `app/Platform/Gpt/` remains strictly within Core Operations (`apps/operations`). Separate microservice extraction is rejected under Plan A.
- **Components**: `BoundedContextBuilder`, `GenerateGptRecommendation`, `GenerateGptRecommendationJob`, `AcceptGptRecommendation`, `OpenAiClientWrapper`, `GptRecommendation`, and `GptRecommendationMetric`.
- **Architectural Rationale**: `OpenAiClientWrapper.php` is an external API wrapper around third-party OpenRouter LLM endpoints. Isolating an external API wrapper into a distinct microservice introduces unnecessary RPC network hops, inter-service serialization, and distributed failure states. The correct architectural solution is process and queue isolation within Operations.
- **Transactional Boundary**: AI generates inert proposals (`gpt_recommendations`). AI never mutates dispatch state directly. Human dispatchers review and accept proposals. `AcceptGptRecommendation` atomically acquires pessimistic row locks (`lockForUpdate()`) on `OperationalAsset` and `DispatchJob`, revalidates equipment availability and operator HoS duty status, and commits assignments in a single database transaction.

## Dedicated Queue Worker Isolation

- **Queue Channel**: All generation jobs (`GenerateGptRecommendationJob`) are explicitly routed to the dedicated `ai` queue (`onQueue('ai')`).
- **Worker Process**: Dedicated supervisor worker process (`php artisan queue:work --queue=ai --tries=3 --timeout=120`).
- **Workload Isolation**: Third-party LLM latency (often 5–30 seconds), OpenRouter 429 rate limits, and network retries are isolated to the `ai` queue worker. The primary operational queue (`default`) processing critical dispatch state changes, notifications, and webhooks is never blocked or starved by LLM calls.

## Bounded Context & Invariants

- `BoundedContextBuilder` constructs an explicit, sanitized payload from the dispatch job, candidate cranes/equipment, and operator qualifications.
- Sensitive credentials, billing details, and unrelated client information are strictly scrubbed before prompt assembly.
- A deterministic `context_hash` (SHA-256 of the normalized bounded context) prevents redundant generation calls for identical dispatch parameters.
- Token usage, estimated cost, latency, and status are recorded in `gpt_recommendation_metrics` without logging raw prompt bodies or API keys.

## Batches

1. **Queue Routing & Supervisor Configuration**:
   - Configure the `ai` queue connection in `apps/operations/config/queue.php`.
   - Update `GenerateGptRecommendationJob` to enforce `public $queue = 'ai'`.
   - Add supervisor configuration for the `operations-worker-ai` worker daemon with explicit timeout (120s) and memory limit (256MB).
2. **OpenRouter Client Hardening & Resiliency**:
   - Harden `OpenAiClientWrapper` with explicit HTTP client timeouts (30s connect/read), exponential backoff with jitter on 429/503 responses, and capped retries (maximum 3 attempts).
   - Capture structured failure reasons in `gpt_recommendation_metrics` (e.g., `rate_limited`, `timeout`, `provider_error`, `schema_mismatch`) without exposing provider secrets.
3. **Transactional Acceptance & Concurrency Hardening**:
   - Audit `AcceptGptRecommendation` to guarantee pessimistic row locks on candidate `OperationalAsset` records and target `DispatchJob`.
   - Revalidate operator Hours of Service (10h fatigue limits) and asset maintenance lockout status prior to assignment creation.
   - Verify that an expired or stale recommendation cannot overwrite a human dispatcher's manual assignment.
4. **Testing & Mock Isolation**:
   - Mock all external OpenRouter calls in unit and feature tests using `Http::fake()` or service mocks.
   - Live external LLM calls are disabled in CI and local test suites to prevent test flakiness and unintended API costs.

## Failure Boundaries & Acceptance

- **External Provider Outage**: OpenRouter unavailability or rate limiting marks the recommendation as `failed` with a user-friendly retry button on the dispatch UI. Dispatch job creation, editing, and manual assignments proceed completely unhindered.
- **Acceptance Tests**:
  - `GenerateGptRecommendationJob` executes on the `ai` queue without impacting `default` queue throughput.
  - Concurrency test: simultaneous acceptance of overlapping recommendations fails cleanly on the second attempt via row lock conflict detection.
  - Provider timeout test: 30s timeout is caught, recorded in metrics, and leaves the dispatch job unaffected.
  - Test suites: run `apps/operations/tests/Feature/Gpt/` and concurrency suites in isolated PostgreSQL.
