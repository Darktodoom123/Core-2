# Core Transaction 2 — Requirements

**Last updated:** 2026-09-16  
**Legend:** Implemented means server-backed and covered by current code; Partial means only part of the behavior exists; Planned means the repository defines or prototypes the concept but does not complete it.

## Operational Architecture & Business Flows

Core 2 organizes its operational capabilities into **5 Main Operational Business Modules**:

1. **Dispatch Job and Scheduling (Real-Time Activation)** — client/service requests, multi-day project plans, jobs, schedules, approvals, activation, and field progression.
2. **Assign Driver/Operator and Equipment** — personnel and asset eligibility, qualification checks, conflict checks, worker response, and integrated Hours of Service (HoS) compliance.
3. **Fleet Management** — fleet vehicles, transport trucks, trailers, readiness, inspections, maintenance, GPS tracking, and integrated Driver Vehicle Inspection Reports (DVIR).
4. **Crane and Equipment Management** — mobile/tower heavy cranes and specialized equipment, certifications, readiness, load capacity verification, pre-use inspections, rigging gear inspections, and safe release.
5. **Fuel Management** — multi-step fuel requests, independent approvals, verification, burn rate monitoring, anomaly detection, and logging.

*(Note: DVIR inspections, Hours of Service compliance, Emergency SOS, and Statutory Safety Governance operate as sub-features and platform services embedded across these 5 modules and the mobile application).*

These 5 main operational engines execute and coordinate the **3 Tri-Modal Inbound Business Flows** received from Core 1:
- **Field Service Flow**: Client service requests converted into scheduled, dispatched field execution and project plans.
- **Rental Flow**: Rental reservations, equipment availability, checkout, operator assignment, return condition diffs (`apps/operations/app/Modules/Rental`).
- **Sales Flow**: Catalog inventory, sales quotes, order reservation, delivery transport, and ownership transfer (`apps/operations/app/Modules/Sales`).

Identity & RBAC, live tracking & telemetry, statutory safety governance (DOLE OSHS Rule 1410 & DO 198-18), SOS emergency response, audit trail, notifications, reports & attachments, data exports, and GPT assistance serve as shared cross-cutting platform services. See [Top-level modules](../architecture/modules.md).

Core 1 is the upstream commercial system containing Sales, CRM, Client, Job Order, Rental,
and Project Management. Core 2 receives three handoff types from Core 1:
service, rental, and sale. CT2 supports their operational processing, while
Core 1 remains authoritative for customer and commercial transactions and is
outside this repository's implementation scope. The Core 2 receiving adapter
and delivery/dispatch handoffs remain incomplete; Core 1 commercial screens,
contracts, payments, billing, and invoicing are not Core 2 deliverables. See
[Alibaton Business Context and CT2 Scope](./alibaton-business-scope.md) for Core 1 commercial boundaries.

## Functional requirements

### Identity and access

- Username login is canonical for web and new mobile builds. Each user has a
  unique normalized username in the documented safe format; existing users are
  backfilled deterministically from email local-parts without changing email,
  password, verification, session, or token data.

- **FR-007 — Implemented:** Each user has a unique, non-null normalized username. The boundary trims and lowercases it, then accepts only 3-50 ASCII characters matching the documented safe format. Existing users are backfilled in ascending `id` order from the email local-part with deterministic collision suffixes; email remains unchanged and unique.
- **FR-008 — Implemented:** Web login and new `/api/v1` mobile clients use username as the canonical credential. Older mobile clients may temporarily submit email through 2026-11-07 by default, while email remains the credential for verification, password reset, recovery, and notifications.

#### Username-login migration policy

Normalization is applied at the request boundary: trim surrounding whitespace
and lowercase using an ASCII-stable rule before validation, lookup, or
throttling. Usernames may contain only ASCII letters, numbers, `.`, `_`, and
`-`; they must be 3-50 characters and start and end with an ASCII letter or
number. Invalid input is rejected without querying or revealing account data.

The backfill processes users by ascending numeric `id`. It takes the email
local-part before `@`, lowercases it, replaces each run of disallowed
characters with `-`, trims non-alphanumeric separators from both ends, and
uses `user-{id}` when the result is empty or shorter than three characters.
Candidates are truncated as needed to leave room for a numeric suffix. If a
candidate is already reserved, suffixes `-2`, `-3`, and so on are selected in
order. This makes results deterministic, preserves every email address, and
ends with a non-null unique username column; the unique database constraint
is the final race-safety check.

Invalid credentials remain generic. Login throttling keys the normalized
username or legacy email identifier together with the client IP. Session
regeneration, active-account and suspension checks, verified-email gates,
Sanctum token handling, CSRF protection, and password hashing are unchanged.

- **FR-001 — Implemented:** The application shall require an authenticated, active internal account for operational routes.
- **FR-002 — Implemented:** The application shall require verified email before the operations workspace is available.
- **FR-003 — Implemented:** Login and password-reset requests shall be rate-limited and sessions regenerated or invalidated at access changes.
- **FR-004 — Implemented:** Each operational software user shall have one canonical role selected from the 3 defined system user roles (`system_administrator` [System Administrator], `operations_manager` [Operations Manager], `operator` / `crane_operator` [Operator]). Non-software field personnel (specifically **Riggers**) are maintained as employee records (`PersonnelProfile`) for crew assignment and safety compliance without holding interactive mobile or web software user accounts.
- **FR-005 — Implemented:** Laravel policies, permissions, and scoped database queries shall enforce access independently of the React interface.
- **FR-006 — Implemented:** The last active System Administrator shall not be suspended or demoted.

### Module 1: Dispatch Job and Scheduling (Real-Time Activation)

- **FR-009 — Implemented (transitional):** Authorized dispatch users can
  currently create active clients and record service requests with schedule,
  priority, requirements, location, and notes. This local intake remains a
  compatibility path until Core 2 has a receiving boundary for Core 1.
- **FR-010 — Implemented:** Authorized users shall create dispatch jobs
  directly or create multiple uniquely referenced drafts from an existing
  service request for staged, retried, or rescheduled work.
- **FR-011 — Implemented:** A job shall have a unique reference, valid schedule window, priority, status, requirements, and creator.

### Module 2: Assign Driver/Operator and Equipment

- **FR-012 — Implemented:** Operations managers shall assign zero or more personnel (Operators and Riggers) and assets using validated assignment types.
- **FR-013 — Implemented:** Operator and Rigger assignments shall require valid qualifications/credentials (e.g. LTO professional driver's license, TESDA Heavy Equipment Operator NC II, TESDA Crane Rigging NC II, DOLE-BOSH) at the scheduled start.
- **FR-014 — Implemented:** Inactive, suspended, unavailable, or on-leave personnel shall not be assignable.
- **FR-015 — Implemented:** Non-dispatchable assets, assets with an open blocking work order, and assets with overlapping active assignments shall not be assignable.
- **FR-016 — Implemented:** All dispatch assignments (routine, priority, emergency) across tri-modal streams shall create a pending Operations approval request.
- **FR-017 — Implemented:** A requester shall not decide their own exceptional
  approval, and every approval or rejection shall record a required reason.
- **FR-018 — Implemented:** The live Operations workspace shall activate only
  jobs with active personnel and asset assignments, use optimistic version
  checking with explicit refresh-and-review recovery, require the latest
  applicable Operations approval for all dispatches, revalidate asset safety, and audit
  every domain activation attempt.
- **FR-019 — Implemented:** Assigned field users shall see only their active
  jobs and own personnel assignment record, receive one confirmed next action,
  and progress only through the allowed forward status sequence with optimistic
  version checks, transactional reauthorization, and an audit event for every
  successful step.
- **FR-020 — Partial:** Assignment ending and reassignment are live through the session-authenticated Inertia workflow with server-side eligibility, conflict, approval, optimistic-version, transaction, and audit checks. Cancellation and controlled reopen/archive are live through the Inertia workflow with authorization, assignment closure, versioning, and audit checks; restore is backend-only until an archived-record management surface is added.

### External Core 1 handoff boundary

- **FR-021 — Planned:** Core 2 shall accept only the operational handoff types
  `service`, `rental`, and `sale` from external Core 1.
- **FR-022 — Planned:** Every received transaction shall retain its Core 1
  source reference, source timestamp, and an idempotency key so retries cannot
  duplicate operational records.
- **FR-023 — Planned:** Incoming Core 1 data shall pass Core 2 authentication,
  validation, authorization, availability, readiness, qualification, conflict,
  concurrency, and audit controls before affecting operational state.
- **FR-024 — Accepted boundary:** Building or maintaining Core 1 and its Sales,
  CRM, Client, Job Order, Rental, and Project Management interfaces is outside
  this repository's implementation scope.

### Module 3: Fleet Management & Module 4: Crane and Equipment Management

- **FR-030 — Implemented:** Authorized users shall register trucks, vehicles, cranes, and equipment with a unique code across Fleet Management (`truck`, `vehicle`) and Crane & Equipment Management (`crane`, `mobile_crane`, `equipment`).
- **FR-031 — Implemented:** Asset visibility shall be all-assets or active-assignment scoped according to permission.
- **FR-032 — Implemented:** Inspections shall record type, result, checklist, findings, technician, and completion time.
- **FR-033 — Implemented:** A failed or conditional inspection shall move the asset to `under_inspection`.
- **FR-034 — Implemented:** Opening maintenance shall move the asset to `under_maintenance` and record whether the defect blocks dispatch.
- **FR-035 — Implemented:** Releasing maintenance shall require a passing inspection completed after the work order was opened.
- **FR-036 — Implemented:** An asset may become `ready_for_service` only when no unreleased blocking work remains.
- **FR-037 — Implemented:** Maintenance work orders, defect logging, parts usage, work performed, next-due scheduling, post-repair inspection verification, and safe asset release are fully supported in the asset and maintenance controllers.

### Module 5: Fuel Management

- **FR-040 — Implemented:** Authorized field users shall submit a fuel request with quantity, fuel type, purpose, and optional job/asset.
- **FR-041 — Implemented:** The supported server workflow shall be `submitted → forwarded → approved/rejected → verified → logged`.
- **FR-042 — Implemented:** The request owner shall not approve their own fuel request.
- **FR-043 — Implemented:** The `logged` state and `FuelLog` persistence are fully supported by the transition endpoint, including quantity, price/litre, total cost, odometer, hour meter, fuel station, and receipt attachment.
- **FR-044 — Implemented:** Authorized field users shall submit their own coordinates with capture time, accuracy, optional asset, and sharing state.
- **FR-045 — Implemented:** Only users with all-tracking permission shall read the operations-wide location feed.
- **FR-046 — Partial:** Precise location is collected only during
  explicit sharing with active assigned work, tied to dispatch context, labeled
  fresh within 2 minutes, delayed through 10 minutes, stale after 10 minutes,
  and offline when reported or after 30 minutes without an update; precise
  coordinates are pruned after 30 days. Native/offline monitoring and
  production operational proof remain incomplete.

### Shared records, GPT, and reporting services

- **FR-050 — Implemented:** The database and browser routes preserve scoped job reports, private attachment metadata, notifications, GPT recommendations, audit events, and asynchronous CSV/PDF export records with authorization and retention controls; remaining full-surface convergence is tracked separately.
- **FR-051 — Implemented:** Important current mutations shall record an audit event containing actor, subject, action, before/after summary where applicable, request ID, IP, and occurrence time.
- **FR-052 — Implemented:** OpenAI `gpt-5-mini` recommendations include
  explanation and conflicts, be role-scoped, expire after 15 minutes, and never
  mutate operational data without a separately authorized human action. The
  routed review lifecycle includes bounded processing polling and accessible
  failure/stale/decision states; production-like operational monitoring remains
  open.
- **FR-053 — Implemented:** Reports are permission-scoped and can be submitted,
  reviewed, summarized, and exported through authorized CSV/PDF workflows with
  atomic retry deduplication, private signed downloads, seven-day cleanup, and
  audit evidence.
- **FR-054 — Implemented:** Attachments are private, limited to 15 MiB each
  and 10 per owning record, restricted initially to JPEG, PNG, HEIC/HEIF, and
  PDF, content-MIME validated, checksum recorded, and downloaded only after
  authorization. Report and fuel receipt uploads share the same server policy,
  and browser evidence covers invalid MIME, count, busy, focus, and download
  behavior.
- **FR-055 — Partial:** The focused React Native application for Operators uses the same Laravel domain rules through a
  versioned JSON API. Its Expo/React Native component tree, SecureStore adapter,
  role gating, assigned-job states, Tactical Cockpit HUD (daylight/dark modes),
  in-cab turn-by-turn heavy crane navigation, 4-angle walkaround DVIR photo tagging (`front`, `back`, `driver_side`, `passenger_side`),
  Hours of Service (HoS) duty status logging and fatigue tracking, 1-tap floating SOS distress jewel,
  and pending-revocation logout recovery pass package tests. Clean native builds and complete
  Detox acceptance pass on Android API 30 and API 36, and the supported physical Android phone journey
  passes on Android 12/API 31. Sprint 1 and Sprint 2 are complete: actor-scoped
  durable SQLite commands, restart/reconnect replay, revoked-token fail-closed
  behavior, exactly-once idempotency, and explicit conflict recovery pass
  package and API 30/API 36 Detox coverage. Device GPS implementation and
  automated journey coverage are present; final physical lock-screen/
  background-location callback proof remains open. Battery characterization is
  outside the current release acceptance scope. iOS and tablet applications
  are outside the active release scope.

### Fleet & Equipment Sub-system: Driver Vehicle Inspection Reports (DVIR)

- **FR-080 — Implemented:** The system shall require pre-trip inspection completion before allowing heavy equipment to advance to dispatched or operational status.
- **FR-081 — Implemented:** Post-trip inspection shall be required and recorded upon job or shift completion.
- **FR-082 — Implemented:** Any inspection checklist item marked as safety-critical shall immediately trigger an asset status transition to `grounded` (or `under_inspection`), prohibiting assignment until mechanic certification.
- **FR-083 — Implemented:** The mobile field app shall support 4-angle walkaround defect capture (`front`, `back`, `driver_side`, `passenger_side`), requiring photographic evidence and descriptive text for failed components.
- **FR-084 — Implemented:** Mechanics and Operations Managers shall review reported defects, link repair work orders, and certify equipment safe before returning assets to available inventory.
- **FR-085 — Implemented:** Subsequent operators shall be presented with previous DVIR defect resolutions and must acknowledge/countersign before operating equipment with prior defects.

### Driver/Operator Assignment Sub-system: Hours of Service (HoS) & Fatigue Management

- **FR-090 — Implemented:** The system shall track continuous operator duty statuses: `operating`, `driving`, `standby`, `on_break`, and `off_duty` (`App\Modules\HoursOfService\Enums\DutyStatus`).
- **FR-091 — Implemented:** The system shall enforce Philippine DOLE-OSHC fatigue guardrails: 10.0-hour hard operating limit per shift with an automated warning alert at 9.0 hours.
- **FR-092 — Implemented:** The system shall enforce mandatory rest breaks (`on_break`) during continuous equipment operation and calculate +10% Night Shift Differential for work between 22:00 and 06:00.
- **FR-093 — Implemented:** The system shall enforce automatic shift lockout and safety supervisor notifications upon exceeding the 10.0-hour operating limit until mandatory rest period requirements are satisfied.
- **FR-094 — Implemented:** The system shall calculate real-time fatigue risk scores based on sleep debt and duty duration, alerting operators and managers upon reaching elevated fatigue thresholds.
- **FR-095 — Implemented:** Duty logs shall support tamper-evident manual edits with mandatory remarks, original value retention, and electronic signature sign-offs.

## Cross-Cutting: Statutory Safety Governance (DOLE OSHS Rule 1410 & DO 198-18)

- **FR-100 — Implemented:** The application shall capture Toolbox Meetings (TBM) prior to daily field operations, including discussion topics, GPS coordinates, crew attendance rosters (Operator, Rigger), and supervisor co-signatures.
- **FR-101 — Implemented:** Critical Lift Plans shall be required for heavy lifts exceeding 75% crane rated capacity, tandem crane operations, or lifts over active hazards, specifying ground bearing pressure, rigging configurations, wind thresholds, and requiring Operations Manager approval.
- **FR-102 — Implemented:** Any worker shall be empowered to issue a Work Stoppage Order (WSO) under DOLE DO 198-18 upon detecting imminent danger, which immediately freezes affected dispatches and notifies the Operations Manager.
- **FR-103 — Implemented:** Safety hazards and near-misses shall be recordable via mobile or web with severity classification (`low`, `medium`, `high`, `critical`), GPS tagging, and photographic attachments.
- **FR-104 — Implemented:** Real-time safety events (TBM, lift plans, WSO, hazards) shall broadcast immediately across the `operations.safety` Reverb WebSocket channel.
- **FR-105 — Implemented:** Assignment engines shall verify that Riggers hold active TESDA Crane Rigging NC II certifications and Operators hold valid DOLE Heavy Equipment Operator accreditations before deployment.

## Cross-Cutting: SOS Emergency Response System

- **FR-110 — Implemented:** Field users shall be able to trigger an SOS emergency distress alert with optional category and automated GPS coordinate capture.
- **FR-111 — Implemented:** Triggering an SOS alert shall immediately broadcast high-priority events across the `operations.sos` Reverb WebSocket channel and queue emergency responder notifications.
- **FR-112 — Implemented:** The emergency response dashboard shall provide real-time alert acknowledgment, responder assignment, and escalation tracking.
- **FR-113 — Implemented:** Resolving an SOS incident shall require an authorized responder, a structured resolution code (`all_clear`, `assistance_rendered`, `evacuated`, `medical_attended`, `false_alarm`), and resolution notes.
- **FR-114 — Implemented:** The system shall automatically escalate unacknowledged SOS incidents after a configurable timeout threshold.
- **FR-115 — Implemented:** Emergency contact numbers shall be stored as salted SHA-256 hashes to protect personnel PII while supporting rapid lookup.

## Cross-Cutting: Dispatch Project Planning & Multi-Crane Allocations

- **FR-120 — Implemented:** Operations Managers shall be able to create structured Project Plans grouping multi-day, multi-phase industrial lift operations.
- **FR-121 — Implemented:** Project Plans shall support sequenced milestones and tasks, enforcing predecessor dependency completions before subsequent dispatches can activate.
- **FR-122 — Implemented:** The allocation engine shall detect equipment and operator scheduling conflicts across overlapping project plans and routine dispatches.
- **FR-123 — Implemented:** Project plans shall track estimated versus actual operating hours, fuel usage, and labor costs.
- **FR-124 — Implemented:** Project completion shall generate an integrated closeout dossier combining all linked dispatch tickets, job reports, DVIR logs, and statutory lift plans.

## Tri-Modal Commercial Inbound Flow: Rental Operations

- **FR-060 - Implemented (partial backend/API):** Authorized users can create a
  rental reservation, approve it, check out the reserved assets, and record a
  return through the session-authenticated JSON boundary. The Core 2 receiving
  adapter, routed Rental UI, commercial contract, deposits, payments, billing,
  and dispatch handoff remain deferred.
- **FR-061 - Implemented (partial backend/API):** Checkout and return require
  non-empty condition evidence. Each evidence value is a non-blank string of at
  most 255 characters; the evidence object has 1-50 entries and notes/damage
  notes are separately bounded.
- **FR-062 - Implemented (partial backend/API):** Rental days, rates, line
  totals, and aggregate totals are server-derived integer cents. Item batches
  are bounded to 100 entries, persisted integer values use the signed
  32-bit maximum `2,147,483,647`, and physical rental quantity is exactly one.
- **FR-063 - Implemented (partial backend/API):** Creation, approval, and
  checkout lock and recheck assets through the Shared availability coordinator.
  Missing, deleted, unsafe, blocked, overlapping Dispatch, overlapping active
  Rental, and committed Sales assets fail atomically. Return records evidence
  and preserves a more restrictive maintenance, inspection, sale, or unavailable
  state rather than reviving an unsafe asset.
- **FR-064 - Implemented (partial backend/API):** Rental routes require the
  dedicated Rental permission plus authenticated, active, verified account
  middleware. Supported mutations persist an attributable audit event in the
  same transaction; failures do not create success audit or domain rows.

## Tri-Modal Commercial Inbound Flow: Sales Operations

- **FR-070 - Implemented (partial backend/API):** Authorized users can manage
  operational catalog rows, create/list quotes, accept a quote into an order,
  fulfill a confirmed order, and transfer ownership through the JSON boundary.
  Core 2 receiving, delivery orchestration, routed Sales UI, payments,
  invoicing, tax, and accounting remain deferred.
- **FR-071 - Implemented (partial backend/API):** Catalog, quote, and order
  prices and totals are server-derived. Catalog/quote item batches are bounded
  to 100 entries, supported persisted quantities and cents fit the signed
  32-bit maximum, checked arithmetic rejects line or aggregate overflow, and a
  physical catalog item has exactly one unit.
- **FR-072 - Implemented (partial backend/API):** Quote acceptance locks the
  quote, catalog rows, and linked assets, rechecks inventory/readiness and
  cross-module conflicts, reserves stock, writes the reserve ledger, creates
  the order, and audits atomically. Expired drafts fail while remaining draft;
  `valid_until` equals today in the application timezone.
- **FR-073 - Implemented (partial backend/API):** Confirmed, fulfilled, and
  transferred orders remain asset commitments independent of the reserved-stock
  counter. Fulfillment rechecks stock and readiness, decrements counters, writes
  the sale ledger, marks linked physical assets unavailable, and commits the
  order transition and audit together.
- **FR-074 - Implemented (partial backend/API):** Ownership transfer has one
  physical-asset uniqueness boundary, is available only from `fulfilled`, moves
  the order to terminal `transferred`, and cannot restore the asset to an
  operational status. Duplicate or concurrent attempts return a domain
  validation failure.
- **FR-075 - Implemented (partial backend/API):** Sales routes require their
  exact dedicated permissions plus authenticated, active, verified account
  middleware. Prices, totals, asset references, inventory, ownership, and audit
  writes are server-authoritative and rollback together on failure.

## Non-functional requirements

### Security and privacy

- Login throttling uses the normalized username or temporary legacy email
  identifier plus client IP. Invalid credentials remain generic to avoid
  account enumeration, while email remains the verification and recovery
  identifier.

- **NFR-007 — Implemented:** Authentication rate-limits the normalized login identifier plus IP, returns generic invalid-credential failures, and never exposes passwords, tokens, raw secrets, or unnecessary personal data. Username migration, compatibility, and focused regression checks are covered by focused tests and migration evidence.

- **NFR-001:** All untrusted request data shall be validated at the HTTP boundary.
- **NFR-002:** State-changing browser requests shall use Laravel session authentication and CSRF protection.
- **NFR-003:** Supabase/PostgreSQL operational tables shall remain server-only; `anon` and `authenticated` Data API roles receive no table privileges.
- **NFR-004:** Authorization shall use least privilege and ownership/active-assignment scope.
- **NFR-005:** Precise location, private attachments, exports, credentials, and GPT context shall not be exposed in logs or public storage.
- **NFR-006:** Approval, access, safety, and critical lifecycle changes shall remain attributable.

### Reliability and consistency

- **NFR-010:** Multi-record workflow changes shall run inside short database transactions.
- **NFR-011:** Contended assignment and transition records shall use row locks where needed.
- **NFR-012:** Dispatch status changes shall reject stale client versions.
- **NFR-013 — Implemented:** Browser location writes support a local outbox,
  idempotency keys, replay, and queued/syncing/failed/conflict/synchronized
  states. The versioned `/api/v1` mobile boundary and actor-scoped SQLite
  repository support command UUIDs, payload hashes, expected versions, bounded
  retries, restart/reconnect replay, exactly-once server application, and
  explicit conflict recovery through the complete eight-hour disconnected
  window. No silent overwrite is permitted.
- **NFR-014:** Database foreign keys and constraints shall preserve referential and domain integrity.

### Performance

- **NFR-020:** List endpoints shall paginate and eager-load required relations.
- **NFR-021:** Workspace queries shall be capability-scoped and bounded.
- **NFR-022:** Common status, schedule, ownership, and relation lookups shall be indexed.
- **NFR-023 — Planned:** Critical authenticated operations shall target 99.5%
  monthly availability excluding announced maintenance, a 15-minute RPO, and a
  4-hour RTO, with monitoring and rehearsed restore evidence.
- **NFR-024 — Implemented:** GPT recommendations are asynchronous and enforce
  token, cost, and rate guards; p95 completion within 30 seconds, at most
  32,000 input and 2,000 output tokens, an estimated USD $0.05 cost ceiling,
  and initial limits of 10 requests per user per hour and 100 system-wide per
  day. Operational metrics record only safe aggregates and bounded polling
  stops after one minute.
- **NFR-025 — Implemented:** GPT decision metadata and redacted summaries are
  retained for 90 days; raw prompts, raw responses, secrets, unnecessary
  personal data, and precise location are not stored. Metric rows cascade with
  recommendation pruning; production-like monitoring proof remains open.

### Accessibility and responsive use

- **NFR-030:** The interface shall meet WCAG 2.2 AA.
- **NFR-031:** Status shall not rely on color alone.
- **NFR-032:** Keyboard navigation, visible focus, screen-reader announcements, reduced motion, 200% zoom, and 44px mobile targets shall be supported.
- **NFR-033:** Map information shall have a synchronized list alternative.

## Recorded baseline decisions & assigned policy owners

Session 0 recorded explicit decisions for an Android-only Expo dev build (SDK
52+), Detox/Maestro E2E runners, AWS ECS/Fly.io compute, Supabase/S3
infrastructure, Sentry/Datadog monitoring, MapLibre GL JS with configurable
Stadia Maps basemaps for the browser, separate future routing/mobile-navigation
decisions, FCM push notifications, 7-year operational record retention, 90-day
raw AI retention, and perpetual per-device mobile token lifetime during 8-hour shifts. Assigned
policy owners and full specifications are documented in
[phase-0-baseline.md](../archive/phase-0-baseline.md).

## Acceptance evidence

The repository currently includes Pest feature tests for authentication,
role/permission seeding, capability sharing, user management, dispatch
workflows, assigned-only job and assignment-record scope, every valid field
transition, invalid skips/reversals, unauthorized/former workers, optimistic
conflicts, audit rollback, independent approval, unsafe asset blocking, fuel
transitions, tracking permissions, ERD alignment, and maintenance release
safety.

Current evidence verified on 2026-08-01 includes 27 passing mobile unit/workflow
tests, 15 passing rendered tests, and 22 focused authentication/field API Pest
tests with 110 assertions. Clean no-skip builds and Detox acceptance pass 5/5
on both Android API 30 and API 36, with zero detections across ten retained
log/APK sources per target. Physical Android-phone acceptance also passes on an
Infinix X6815B running Android 12/API 31 through Maestro 2.8.0; see
[Session 1 readiness status](../archive/session-1-readiness-status.md).
