# Core Transaction 2 — Roadmap

**Last updated:** 2026-08-02  
**Planning rule:** Use outcome gates instead of calendar promises until team
capacity and rollout dates are known.

The active, session-level execution sequence for the remaining roadmap work is
maintained in the [Capstone Completion Plan](./plans/CAPSTONE_COMPLETION_PLAN.md).

**Current implementation note:** Sessions 1 and 2 are complete for the accepted
Android-phone scope. Secure logout retains a failed revocation only in a
SecureStore revocation-only slot, clears local identity state, blocks new
login, and retries on demand or cold start. Clean native builds and complete
Detox acceptance pass 5/5 on Android API 30 and API 36, including SecureStore
restart, role/job isolation, logout, token-reuse rejection, suspension,
revocation, and second-user isolation. Ten-source redacted log/APK scans pass
on both emulator targets. An Infinix X6815B running Android 12/API 31 also
passes the supported physical-phone Maestro journey. The active native release
targets Android 11+ phones; iOS, tablet applications, EAS, Apple credentials,
and macOS acceptance are outside scope. The actor-scoped durable SQLite outbox,
reconnect replay, exactly-once defense, and explicit conflict recovery pass
focused package and API 30/API 36 Detox coverage. Device GPS integration remains
Session 3 work.

## Delivered foundation

- Internal authentication, verification, suspension checks, and recovery
- Six canonical roles, permission catalog, policies, and scoped queries
- User provisioning, personnel profiles/credentials, and session revocation
- Client and service request persistence
- Dispatch creation, resource assignment, approval, activation, field status,
  cancellation, controlled reopen, and archive/restore backend
- Asset register, inspections, maintenance, and safe release backend
- Fuel submission, forwarding, decision, verification, final logging, and receipt evidence
- Own location updates and restricted operations-wide feed
- OpenStreetMap tracking map/list, freshness polling, browser location outbox,
  idempotent command logging, and scheduled 30-day coordinate pruning
- Private job reports/attachments, queued notifications, asynchronous GPT
  recommendation lifecycle, and focused Pest coverage for these slices

## Accepted module structure

Delivery work is organized around five top-level business modules:

1. Dispatch Job and Scheduling
2. Driver/Operator and Equipment Assignment
3. Fleet Management
4. Crane and Equipment Management
5. Fuel Management

Identity, tracking, records, notifications, reports, attachments, GPT, and
mobile delivery are shared platform services that enable these modules.

## Phase 0 — Baseline decisions

### Outcomes

- Adopt progressive convergence of the richer role-adaptive prototype onto the
  existing live Inertia route.
- Adopt Laravel backed-enum machine values as canonical; prototype-only labels
  cannot become persisted states without an explicit domain decision.
- Adopt amber as the brand primary and require a distinct warning/conflict
  palette.
- Adopt Inertia redirects, validation error bags, and typed flash for browser
  writes; reserve versioned JSON for mobile.
- Adopt a managed single-region Laravel web/worker and Supabase PostgreSQL
  topology with private object storage.
- Adopt responsive web and the focused mandatory React Native field application
  as parallel capstone workstreams.
- Record the accepted uptime, RPO/RTO, location retention/freshness, offline
  duration/conflict policy, attachment limits, and GPT cost/latency limits in
  [phase-0-baseline.md](./phase-0-baseline.md).

### Exit gate

Architecture decisions are recorded, genuinely undecided provider/policy values
are explicit, and each capability is marked live backend/UI, partial, prototype,
or planned.

## Phase 1 — Parallel client foundations

### Outcomes

- Reconcile backend and prototype status labels into canonical typed view models.
- Converge the richer role experience onto live server data slice by slice.
- Replace browser JSON response mismatches with the accepted Inertia mutation
  contract.
- Define the React Native package/repository boundary, `/api/v1` authentication,
  and idempotent command envelope in parallel.
- Complete permission-filtered navigation and loading/empty/error/stale states.
- Add frontend integration and critical browser/API contract tests.

### Exit gate

The first live dispatch slice has no fixture-only writes, browser mutations use
the tested Inertia contract, and the mobile foundation has a reviewed versioned
contract without duplicating domain logic.

### Session 2 implementation evidence

- The first routed live dispatch slice now uses explicit server-mapped view
  models and contains no fixture/reducer write.
- Laravel enum machine values and labels feed the live TypeScript contract;
  prototype label unions are explicitly fixture-only.
- Live dispatch, fuel, approval, and location browser writes use redirects,
  validation error bags, and typed flash.
- Navigation/action visibility is server capability-driven and adapts labels
  for field roles.
- The accepted amber tokens, separate warning palette, responsive shell, and
  loading/empty/validation/error/stale/disabled states are implemented.
- The planned `apps/field-mobile/` boundary, revocable Sanctum authentication,
  and idempotent versioned command envelope are reviewed in
  [API.md](./API.md); no mobile feature endpoint was added.

The Phase 1 exit gate is not yet fully closed: browser E2E evidence and
remaining unrouted JSON write convergence remain. The `/api/v1`
authentication foundation mentioned in this historical note has since been
implemented.

## Phase 2 — Complete dispatch lifecycle across clients

### Outcomes

- Web client/service request UI, schedule board, assignments, and conflict review
- Assignment accept/reject, reassignment/end, cancellation, and controlled reopen/archive
- Priority approval, activation, optimistic conflict refresh, and assigned field progression
- React Native assigned-job, assignment-response, and forward field progression
  backed by `/api/v1`

### Exit gate

The web and versioned API dispatch slices pass verified end-to-end coverage
across the Dispatcher → Manager → Field Worker journey, including
authorization, conflict, rejection, retry, isolation, and stale-version paths.
The full React Native capstone gate remains open until device GPS integration
and its complete field journey are delivered. The native shell and durable
offline storage are complete.

### Phase 2 end-to-end verification evidence

- The complete Dispatcher → Manager → Field Worker lifecycle is proven end to end across Web and API (`/api/v1`) boundaries in `tests/Feature/Operations/Phase2EndToEndDispatchLifecycleTest.php`.
- Dispatcher client/service-request intake, draft conversion, resource staffing, and priority/emergency manager approval are fully verified and integrated.
- Manager approval and rejection enforce audit trail recording and prohibit requester self-approval.
- Field-worker assignment accept, reject (with mandatory reason and closed active interval), and step-by-step status progression (`dispatched` → `accepted` → `en_route` → `arrived` → `working` → `completed`) are verified via both web interface and versioned, idempotent `/api/v1` mobile endpoints.
- Safety and integrity controls fail closed: rejection without reason returns validation errors, out-of-order transitions return 422, stale optimistic versions return 409 conflicts on API and session errors on web, and unassigned workers are strictly isolated with 404/empty responses.
- Reassignment, cancellation, reopen, archive, and restoration workflows preserve atomic transaction semantics and complete audit trail attribution. Database trigger failure forces total transactional rollback.

### Session 4 implementation evidence

- The canonical live web workspace now creates active clients, selects them
  during service-request intake, and captures schedule, priority,
  requirements, location, and notes.
- Authorized dispatchers can convert a request into distinct draft dispatches.
  The documented one-to-many cardinality is preserved for staged, retried, and
  rescheduled work.
- Conversion locks the request and atomically commits the draft,
  `submitted` → `dispatching` state change, and audit records. Linked request
  fields are server-derived, and duplicate references or invalid request state
  are rejected.
- Focused Pest coverage defines authorization, validation, state, cardinality,
  audit, rollback, and meaningful failure behavior. The remaining Phase 2
  outcomes are schedule-board conflict review and the `/api/v1` React Native
  field journey.

### Session 5 implementation evidence

- Each visible dispatch now opens a live Inertia detail workspace. Users with
  assignment-wide visibility can review server-derived personnel availability,
  account state, credential validity, asset readiness, blocking maintenance,
  and schedule conflicts; assigned field users only receive current job
  resources.
- Authorized dispatchers can assign drivers, crane operators, field
  technicians, trucks, cranes, and equipment. Blocked candidates remain
  visible with an understandable reason and cannot be selected.
- Confirmation reauthorizes and revalidates the complete batch inside one
  transaction after deterministic job and resource row locks. Duplicate,
  overlapping, unsafe, unqualified, unavailable, suspended, stale-snapshot, or
  kind-mismatched selections do not leave partial assignments, approvals, or
  audit events.
- Assignment success uses the accepted Inertia redirect/typed-flash contract;
  validation conflicts return to the detail workspace through Laravel's error
  bag. Focused Pest coverage defines success, authorization, credential,
  availability, asset safety, maintenance, overlap, duplicate, rollback,
  candidate scoping, concurrency-sensitive revalidation, and audit behavior.
- Remaining Phase 2 outcomes are activation and field-progression UI,
  schedule-board expansion, and the `/api/v1` React Native field journey.

### Session 6 implementation evidence

- Operations Managers now receive pending priority/emergency requests in the
  canonical live workspace with requester identity, dispatch schedule, site,
  status/version, site notes, and the named personnel/assets in the proposed
  change. Approval and rejection both require an auditable reason.
- Decision authorization is enforced per request. A requester remains able to
  review their request but cannot decide it, even when they otherwise hold the
  approval permission; the decision policy is rechecked after the approval row
  is locked.
- Authorized Dispatchers now have activation readiness and activation controls
  in the live dispatch detail workspace. The server requires active personnel
  and asset assignments, requires the latest exceptional request to be
  approved, locks and revalidates asset readiness and blocking maintenance, and
  records both the activation attempt and successful state change.
- Stale optimistic versions return to the dispatch detail workspace with an
  explicit refresh-and-review action. Rejection, missing assignments, pending
  approval, unsafe assets, unauthorized access, and stale versions fail closed
  without activating the dispatch.
- Focused Pest coverage defines routine activation, priority/emergency
  approval, rejection, required reasons, self-approval prevention,
  unauthorized access, stale versions, changed asset safety, manager/dispatcher
  UI contracts, and audit history.
- Remaining Phase 2 outcomes are schedule-board expansion,
  and the `/api/v1` React Native field journey.

### Session 7 implementation evidence

- Drivers, Crane Operators, and other permitted assigned field users now receive
  a focused `Today's work` surface backed by active-assignment scoping. Job
  links open a touch-first detail with schedule, site notes, current assets,
  requirements, and a color-independent canonical progress sequence; another
  worker's assignment record is not included.
- The server supplies only the immediate valid action for
  `dispatched → accepted → en_route → arrived → working → completed`. The UI
  names the consequence, requires explicit confirmation, locks repeated
  submission while processing, restores keyboard focus, and handles success,
  recoverable error, stale refresh, waiting, and completed states.
- The status command now follows the accepted browser Inertia contract. It
  locks the job and actor assignment, reauthorizes in the transaction, rejects
  stale versions separately from invalid skips/reversals, increments the
  version, and atomically records `dispatch.status_updated` with a
  server-generated request correlation ID.
- Assigned collection/detail responses use explicit whitelisted view models and
  active-assignment relationship constraints. Focused Pest coverage defines
  assigned-only visibility, all five valid transitions, skips/reversals,
  unauthorized and former workers, stale conflicts, audit attribution, and
  rollback when audit persistence fails.
- The complete live web journey now reaches
  Dispatcher staffing/activation → Operations Manager exceptional decision
  when required → assigned field-worker completion. The Phase 2 exit gate
  remains open for explicit assignment accept/reject and reassignment/end,
  schedule-board expansion, and the `/api/v1`
  React Native acceptance/retry journey.

### Session 8 implementation evidence

- Assigned field workers can accept or reject their own pending personnel assignment in the live web application.
- Rejection requires a mandatory reason, records `responded_at` and `response_reason`, updates `response_status` to `rejected`, sets `active_until` to close the active interval, and records a `dispatch.assignment_rejected` audit event without cancelling the dispatch job.
- Closing the active interval removes active-job visibility for the worker (`scopeVisibleTo` and `DispatchJobPolicy`) while keeping the job intact for dispatch operations.
- Acceptance updates `response_status` to `accepted`, records `responded_at`, increments the job's optimistic version, and logs a `dispatch.assignment_accepted` audit event.
- The live Inertia detail workspace presents capability-driven Accept and Reject actions for pending assignments, including a required reason form with validation error handling.
- Focused Pest coverage defines worker acceptance, rejection with reason, missing reason validation, cross-worker isolation, repeated response prevention, stale-version failure, and transactional audit recording.

### Session 3 implementation evidence

- Authorized dispatchers and operations managers can cancel eligible jobs with a
  required reason; cancellation closes active personnel and asset assignment
  intervals, increments the optimistic version, and records actor/reason audit
  history inside one transaction.
- Operations managers and administrators can reopen cancelled jobs to `draft`;
  archive-management users can soft-delete eligible jobs and restore archived
  jobs while preserving their lifecycle status. Archive/restore increments the
  version and records actor/reason audit history.
- Archive locks the job and active assignment rows, closes assignment intervals
  before soft deletion, and rolls back all state when audit persistence fails.
  Archived jobs remain excluded from normal operational views.
- The live dispatch detail exposes capability-driven cancellation, reopen, and
  archive controls with typed flash, inline validation, stale-version refresh,
  and accessible reason fields. Restore remains an authorized backend action
  without an archived-record management surface.
- Focused Pest coverage defines cancellation authorization, required reason,
  terminal-state rejection, stale versions, assignment closure, reopen and
  restore authorization/state, soft-delete visibility, and archive rollback.

The remaining Phase 2 capstone work is device GPS integration and the complete
native field journey; the native shell, durable offline storage, and versioned
API acceptance/retry boundary are now covered.

### Session 2 implementation evidence

- Authorized dispatchers can end active personnel or asset assignments without
  deleting history, or submit replacement resources through the existing
  server-side eligibility and conflict service.
- Reassignment uses required optimistic versions, deterministic row locks, one
  transaction, terminal-job guards, and attributable audit events. Direct
  changes increment the dispatch version; stale, duplicate, unsafe, and
  cross-job changes fail without partial assignment state.
- Post-activation and non-routine changes create a `reassignment_override`
  approval. An independent assignment approver sees the full end/replace
  payload, revalidates it at decision time, and applies it atomically with
  requester/approver attribution.
- Focused Pest coverage covers direct ending, eligibility, replacement,
  stale-version, authorization, terminal jobs, approval application, stale
  approval rollback, and unscheduled replacement rejection.

## Phase 3 — Fleet, crane/equipment, maintenance, fuel, and records

### Outcomes

- Asset registration/status, inspection, work orders, release, parts, and next-due UI
- Complete fuel logging and receipt metadata
- Job report submission, private attachments, and notification delivery
- Scoped reports and asynchronous exports

### Current implementation evidence

- Asset registration, status, inspections, maintenance work orders (defect logging, parts usage, work performed, next due scheduling, post-repair inspection verification), and safe release are available in the backend/UI.
- Final fuel logging (`submitted` → `forwarded` → `approved`/`rejected` → `verified` → `logged`), cost calculations, odometer/hour-meter recording, receipt attachments, report submission/review, private attachment upload/download, notification listing/read, and daily summary/GPT lifecycle routes are server-backed.
- Asynchronous export workflows and complete routed UI for the shared record services remain open, so the Phase 3 exit gate is not closed.

### Exit gate

Safety and segregation-of-duties workflows pass E2E tests; downloads and exports are independently authorized and audited.

## Phase 4 — Field resilience and tracking

### Outcomes

- Durable client outbox with command UUID/idempotency and retry policy
- Version-aware conflict UI and explicit queued/sync/failed states
- Enforce the accepted 8-hour offline, 30-day precise-location retention, and
  freshness contract
- Polling-based live view with a synchronized list alternative; assess WebSockets/SSE only after measurement

### Current implementation evidence

- The browser tracking surface now provides an OpenStreetMap map, synchronized
  list, freshness filters, measured 15-second polling, and location sharing.
- Browser location commands persist locally, replay with idempotency keys, and
  record payload hashes; the scheduled prune command removes precise
  coordinates older than 30 days.
- Native actor-scoped SQLite commands survive the accepted eight-hour boundary
  and restart, replay exactly once after reconnect, expose retry/discard and
  explicit version-conflict actions, fail closed after token revocation, and
  isolate subsequent users. Focused API 30/API 36 Detox journeys pass.
- Device-backed location collection and production monitoring remain open, so
  the complete Phase 4 exit gate is not closed.

### Exit gate

Offline/reconnect tests prove no duplicate command or silent overwrite, and one worker cannot access another worker's jobs, files, fuel, location, or reports.

## Phase 5 — Explainable GPT assistance

### Outcomes

- Asynchronous, role-scoped recommendation generation
- Bounded/redacted context, hash, expiry, reasons, assumptions, conflicts, and model metadata
- Review/accept/reject lifecycle with revalidation
- Cost, latency, failure, and audit controls

### Current implementation evidence

- Authorized bounded context, asynchronous queue processing, model/usage/cost
  metadata, 15-minute expiry, human accept/reject, and audit events are
  implemented in the Laravel boundary.
- The routed workspace still needs a complete recommendation review surface,
  and production latency/cost/retention proof remains open.

### Exit gate

GPT cannot perform operational writes; stale recommendations cannot be silently confirmed; every accepted proposal identifies the human actor and normal domain action.

## Phase 6 — Production hardening and rollout

### Outcomes

- Remove development-only routes, role switching, and fixture write paths
- Deploy the accepted single-region PostgreSQL configuration, queue worker, and
  private versioned object storage
- Monitoring/alerts, backup/restore, security review, load tests, accessibility review, and dependency audit
- Staged rollout by role with support, incident response, and rollback runbooks

### Exit gate

CI-equivalent validation passes, critical flows meet WCAG 2.2 AA,
restore/rollback is rehearsed, and owners verify access, emergency escalation,
GPS retention, and GPT policy enforcement.

## Deferred unless justified

- Customer portal/public registration
- A native client beyond the focused mandatory field application
- Microservice decomposition
- Autonomous dispatch
- Billing, payroll, procurement, or accounting suites
- Public/external API contracts

## Risk register

- **Dual frontend drift:** Converge on one live shell and shared contracts.
- **Parallel client drift:** Publish canonical states and versioned contracts;
  keep policies and domain actions in Laravel.
- **Offline conflicts:** Require idempotency, versions, conflict UX, and integration tests.
- **Assignment concurrency:** Preserve transaction/locking checks and add load/concurrency tests.
- **Location privacy:** Define consent, minimal scope, retention, and audit.
- **GPT staleness/overreach:** Use bounded context, expiry, revalidation, human confirmation, and clear copy.
- **Private files:** Authorize every download and use short-lived access.
- **Queue retries:** Make handlers idempotent and monitor failed jobs.
- **Unmeasured scale:** Set targets before adding distributed infrastructure.
