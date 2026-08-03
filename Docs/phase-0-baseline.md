# Core Transaction 2 — Phase 0 Baseline Decisions

**Status:** Accepted product and architecture baseline  
**Decision date:** 2026-07-23  
**Scope:** Documentation decisions only; no feature implementation is implied

This record resolves the Phase 0 decisions that govern the active product
documents. It is authoritative until a later recorded decision supersedes it.
Current capability claims still come from the application, migrations, tests,
and [feature catalog](./features.md).

## Accepted decisions

### Canonical frontend

The canonical product experience is the richer role-adaptive interface,
progressively connected to live Laravel data on the existing Inertia
application route.

- `resources/js/pages/workspace.tsx` remains the current routed, server-backed
  production page while convergence is in progress.
- `resources/js/pages/operations.tsx` and its role surfaces are design and
  interaction source material, not a second production application.
- Each migrated slice must replace fixtures and reducer-only writes with typed
  server-provided view models and authoritative Laravel commands before it is
  presented as live.
- Production routes must never expose fixture-only operational writes.
- The end state is one permission-adaptive shell, not two maintained web
  frontends.

### Canonical status vocabulary

Laravel backed-enum machine values are canonical. Clients may format labels but
must not define new persisted states.

- Dispatch uses `draft`, `pending_approval`, `scheduled`, `dispatched`,
  `accepted`, `en_route`, `arrived`, `working`, `completed`, and `cancelled`.
  Prototype “In progress” maps to `working`; “En route” maps to `en_route`.
  Prototype “On hold” is not a canonical persisted state and remains a UX
  concept until a domain transition is approved.
- Fuel uses `submitted`, `forwarded`, `approved`, `rejected`, `verified`, and
  `logged`. Prototype “Pending” and “Dispensed” must not be persisted without an
  explicit mapping to the ordered server workflow.
- Operational assets use `available`, `assigned`, `working`,
  `under_inspection`, `under_maintenance`, `awaiting_parts`,
  `ready_for_service`, and `unavailable`. Prototype “Maintenance” is a display
  simplification; prototype “Offline” is telemetry/connectivity and must not be
  silently treated as an asset lifecycle state.
- Approval uses `pending`, `approved`, and `rejected`.

Shared TypeScript/API contracts must derive from or explicitly mirror these
values, and presentation labels are tested separately from machine values.

### Brand direction

Amber is the primary brand color for actions, selection, focus, and active
navigation. Cobalt is not the primary brand direction.

Because amber previously represented both brand and warning semantics, the
implementation must establish a visually distinct warning/conflict palette and
must continue to pair semantic color with text and an icon or shape. Exact
production token values remain a design implementation task, not an open brand
decision.

### Browser mutation contract

Browser page mutations use the Inertia contract:

- Laravel session authentication and CSRF protection
- Redirect or `303 See Other` responses after successful non-GET requests
- Laravel validation error bags for invalid input
- Typed flash data for concise success or action-level feedback
- Inertia partial reloads or prop refreshes where appropriate

The current session-authenticated `/operations` controllers return JSON while
the routed page submits through Inertia helpers. That is an implementation gap,
not an accepted hybrid contract.

JSON is reserved for a deliberate, versioned `/api/v1` mobile boundary. The
browser and mobile adapters must call the same policies, validation rules, and
domain actions, but they do not need to share HTTP response shapes.

### Production topology

Production starts as a managed, single-region modular monolith:

- Persistent Laravel web service
- Separately managed Laravel queue worker using the database queue initially
- Managed Supabase PostgreSQL in the same region as application compute
- Direct PostgreSQL connection for persistent application services when IPv6 is
  available; Supavisor session mode when the runtime is IPv4-only
- Direct connection for migrations, dumps, and administrative operations
- Private, versioned S3-compatible object storage for attachments and generated
  records
- Server-only database access; browser and mobile clients receive no
  operational Data API table privileges
- Centralized logs, error reporting, health checks, queue monitoring, database
  monitoring, and alerting

The Laravel hosting provider, object-storage provider, monitoring vendor, and
final region are genuinely **UNDECIDED**. They must be selected together so
application compute, PostgreSQL, and storage meet the latency, residency,
availability, and recovery targets below. Serverless Laravel, read replicas,
Redis, WebSockets, and microservices require measured justification rather
than being baseline dependencies.

### Web and native mobile delivery

Responsive web and the mandatory React Native field application proceed as
parallel product workstreams.

- Responsive web remains required for office roles and usable field fallback.
- React Native is mandatory within the capstone MVP for Driver, Crane Operator,
  and Field Technician workflows.
- Parallel does not mean duplicated domain behavior: the Laravel server,
  canonical states, authorization, actions, and audit rules remain shared.
- Mobile implementation must begin with a versioned API/authentication contract
  and retry-safe command envelope before feature breadth.
- A mobile capability is not live until it has server-backed acceptance
  evidence; prototype mobile surfaces do not satisfy the capstone requirement.

This resolves the former PRD conflict: “responsive web” is no longer a reason
to exclude native mobile from the active capstone scope. It describes the web
delivery requirement, while the focused React Native field application is a
separate mandatory capstone deliverable.

## Reliability and recovery targets

- **Availability:** 99.5% monthly for critical authenticated operations,
  excluding announced maintenance.
- **RPO:** No more than 15 minutes of committed production data loss.
- **RTO:** Restore critical authenticated operations within 4 hours.
- Production must use recovery capabilities finer than daily backups for the
  relational database, versioning/recovery controls for private objects, and
  an independent scheduled logical backup.
- Restore and rollback procedures must be rehearsed before production
  acceptance. Backup existence alone is not acceptance evidence.

The measurement window, critical endpoints, maintenance notice process, and
incident ownership must be defined in the production runbook.

## Location and offline limits

### Collection and freshness

- Collect precise location only while an authenticated worker explicitly
  enables sharing and has active assigned work.
- Target capture interval: 30 seconds while moving in the foreground; 2 minutes
  while stationary or backgrounded, subject to operating-system limits.
- **Fresh:** received within 2 minutes.
- **Delayed:** more than 2 and up to 10 minutes old.
- **Stale:** more than 10 minutes old.
- **Offline:** the client reports no network, or no update is received for 30
  minutes.
- Interfaces must show capture time, receive time, sharing state, and freshness;
  they must never imply that stale or absent data is live.

### Retention

Precise coordinates are retained for 30 days and then deleted. Non-coordinate
audit facts—actor, sharing state, timestamps, and dispatch association—follow
the owning operational or audit record.

### Offline mobile contract

- Retryable field commands must support an 8-hour disconnected shift.
- Every replayable command carries a command UUID/idempotency key and expected
  record version.
- The server remains authoritative. A conflict cannot silently overwrite newer
  server state and must require explicit user resolution.

## Attachment limits

- Maximum 15 MiB per file and 10 files per owning record.
- Initial allowed types: JPEG, PNG, HEIC/HEIF, and PDF.
- Verify MIME type from content, reject executables and archives, record a
  SHA-256 checksum, and strip image metadata where feasible.
- Store objects privately and authorize every short-lived download.
- Attachment retention follows the owning operational record.

The exact retention/deletion schedule for operational records and their
attachments is genuinely **UNDECIDED** pending legal and business policy.

## GPT assistance limits

- Approved target model: OpenAI `gpt-5-mini` (GPT-5 mini).
- Do not enable production credentials or use a personal subscription. The
  bounded integration may exist behind the application credential boundary,
  but production use still requires product-owner-supplied authorization and
  configuration.
- Maximum 32,000 input tokens and 2,000 output tokens per recommendation.
- Estimated model-cost ceiling: USD $0.05 per completed recommendation.
- Asynchronous latency target: p95 completion within 30 seconds.
- Initial rate limit: 10 requests per user per hour and 100 requests system-wide
  per day; tune only from measured demand and cost.
- Recommendations expire after 15 minutes and must be revalidated through the
  normal domain action before acceptance.
- Failure is closed: no GPT error, timeout, or response may cause an operational
  mutation.
- Retain model, usage, estimated cost, context hash, source references, reasons,
  conflicts, decision, and redacted summaries for 90 days.
- Do not store raw prompts, raw responses, secrets, unnecessary personal data,
  or precise location.

Longer AI audit retention is genuinely **UNDECIDED** pending legal and business
policy.

## Session 0 Baseline Decisions & Recorded Architectural Choices

### Mobile runtime & platform targets
- **Runtime:** Expo development build (Expo SDK 52+ with prebuild and custom native module support). Preserves rapid development iteration while supporting custom native modules without raw native project file drift.
- **Supported OS versions:** Android phones running Android 11.0 (API level 30) or higher. iOS and tablet applications are outside the active release scope.
- **Physical device test target:** One Android smartphone running a supported OS version.
- **Mobile E2E runner:** Detox (with Jest test runner) for automated Android emulator UI testing; Maestro for physical Android phone user journey validation.

### Location collection, outbox & secure storage
- **Capture cadence & triggers:** 30 seconds while moving in the foreground; 2 minutes while stationary or backgrounded, strictly during active assigned dispatch shifts.
- **OS permission copy:**
  - *Foreground:* "Core Transaction 2 Field App requires your location while actively working on a dispatch job to update dispatchers and customer ETA."
  - *Background:* "Allow background location sharing so dispatchers receive real-time arrival and safety status even when your device screen is off or another app is open during active shifts."
- **Secure token storage:** Expo SecureStore backed by Android EncryptedSharedPreferences / KeyStore for Sanctum personal access tokens and device binding keys.
- **Durable offline outbox technology:** SQLite database store via `react-native-quick-sqlite` supporting an 8-hour disconnected shift with command UUID idempotency keys and version-conflict retry envelopes.

### Exports & dataset policy
- **Export datasets:** Operational Dispatches, Asset Inspection & Maintenance History, Fuel Logs & Expense Receipts, Location/Telemetry Audit Logs, System Audit Trail.
- **Formats:** CSV (comma-separated values) for structured data analysis; formatted PDF for operational reports and receipts.
- **Expiry & retention:** Temporary download links expire after 24 hours. Export files generated on object storage are automatically purged after 7 days via storage bucket lifecycle policies.

### Production hosting, providers & assigned owners
The following production provider selections are recorded with explicit assigned owners:
- **Application Compute Hosting:** AWS ECS (Fargate) or Fly.io (Dedicated Instance) in `ap-southeast-1` (Singapore region) — **Assigned Owner:** Lead DevOps Engineer.
- **Database & Object Storage:** Managed Supabase PostgreSQL + AWS S3 (Private Bucket with Object Lock and Versioning enabled) in `ap-southeast-1` — **Assigned Owner:** Database Administrator / Lead Architect.
- **Monitoring & Alerting:** Sentry (Error & APM) + Datadog / Better Stack (Application & Infrastructure Metrics) — **Assigned Owner:** Site Reliability Engineer (SRE).
- **Map & Routing Provider:** Mapbox GL JS (Web) and Mapbox Navigation SDK (Mobile) with OpenStreetMap dev fallback — **Assigned Owner:** Lead Frontend / Mobile Engineer.
- **Push Notification Provider:** Firebase Cloud Messaging (FCM) integrated via Expo Notifications — **Assigned Owner:** Mobile Team Lead.

### Retention schedules & assigned policy owners
- **Operational-record & attachment retention:** Operational dispatches, maintenance work orders, inspection logs, and fuel logs/receipts are retained for 7 years to satisfy statutory tax and regulatory audit requirements. Owner: **Legal & Compliance / Product Owner**.
- **AI retention beyond 90 days:** Raw GPT model context, prompts, and tokens are retained for 90 days for operational debugging. Recommendation decision summaries (who accepted/rejected which proposal) are archived into the System Audit Trail and retained for 3 years; raw AI payloads beyond 90 days are deleted. Owner: **Compliance & Product Owner**.
- **Mobile token lifetime:** Sanctum tokens persist per bound device for the duration of active deployment without forced session expiration during 8-hour shifts, but are immediately revocable upon user suspension or explicit device logout.

## Session 2 entry point

Session 2 starts Phase 1 with a contract-first implementation slice:

1. Implement the accepted canonical dispatch status mapping and typed view model
   used by both web and the planned `/api/v1` mobile adapter.
2. Convert **dispatch creation** on the routed web workspace from the current
   JSON response mismatch to the accepted Inertia redirect, validation-error,
   and typed-flash contract, with focused Pest and browser-facing coverage.
3. In parallel, specify the React Native repository/package boundary and the
   `/api/v1` authentication plus idempotent command envelope; do not configure
   GPT in this session.

This is the smallest starting slice that advances both approved workstreams
without duplicating domain rules.
