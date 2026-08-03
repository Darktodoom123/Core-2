# Core Transaction 2 — Requirements

**Last updated:** 2026-07-26  
**Legend:** Implemented means server-backed and covered by current code; Partial means only part of the behavior exists; Planned means the repository defines or prototypes the concept but does not complete it.

## Top-level module ownership

Functional requirements are grouped under the five accepted business modules:

1. Dispatch Job and Scheduling — client/service requests, jobs, schedules,
   approvals, activation, and field progression.
2. Driver/Operator and Equipment Assignment — personnel and asset eligibility,
   assignment, conflict checks, and assignment response.
3. Fleet Management — fleet vehicles, readiness, inspections, and maintenance.
4. Crane and Equipment Management — cranes and non-fleet equipment, readiness,
   inspections, and maintenance.
5. Fuel Management — requests, ordered decisions, verification, and logging.

Identity, tracking, audit, reports, attachments, notifications, and GPT are
shared platform services. See [Top-level modules](./modules.md).

## Functional requirements

### Identity and access

- **FR-001 — Implemented:** The application shall require an authenticated, active internal account for operational routes.
- **FR-002 — Implemented:** The application shall require verified email before the operations workspace is available.
- **FR-003 — Implemented:** Login and password-reset requests shall be rate-limited and sessions regenerated or invalidated at access changes.
- **FR-004 — Implemented:** Each operational user shall have one canonical role selected from the six defined roles.
- **FR-005 — Implemented:** Laravel policies, permissions, and scoped database queries shall enforce access independently of the React interface.
- **FR-006 — Implemented:** The last active System Administrator shall not be suspended or demoted.

### Module 1: Dispatch Job and Scheduling

- **FR-009 — Implemented:** Authorized dispatch users shall create active
  clients and record client-selected service requests with schedule, priority,
  requirements, location, and notes.
- **FR-010 — Implemented:** Authorized users shall create dispatch jobs
  directly or create multiple uniquely referenced drafts from an existing
  service request for staged, retried, or rescheduled work.
- **FR-011 — Implemented:** A job shall have a unique reference, valid schedule window, priority, status, requirements, and creator.
- **FR-012 — Implemented:** Dispatchers shall assign zero or more personnel and assets using validated assignment types.
- **FR-013 — Implemented:** Driver and crane-operator assignments shall require a valid credential at the scheduled start.
- **FR-014 — Implemented:** Inactive, suspended, unavailable, or on-leave users shall not be assignable.
- **FR-015 — Implemented:** Non-dispatchable assets, assets with an open blocking work order, and assets with overlapping active assignments shall not be assignable.
- **FR-016 — Implemented:** Priority and emergency assignments shall create a pending approval request.
- **FR-017 — Implemented:** A requester shall not decide their own exceptional
  approval, and every approval or rejection shall record a required reason.
- **FR-018 — Implemented:** The live Dispatcher workspace shall activate only
  jobs with active personnel and asset assignments, use optimistic version
  checking with explicit refresh-and-review recovery, require the latest
  applicable approval for non-routine jobs, revalidate asset safety, and audit
  every domain activation attempt.
- **FR-019 — Implemented:** Assigned field users shall see only their active
  jobs and own personnel assignment record, receive one confirmed next action,
  and progress only through the allowed forward status sequence with optimistic
  version checks, transactional reauthorization, and an audit event for every
  successful step.
- **FR-020 — Partial:** Assignment ending and reassignment are live through the session-authenticated Inertia workflow with server-side eligibility, conflict, approval, optimistic-version, transaction, and audit checks. Cancellation and controlled reopen/archive are live through the Inertia workflow with authorization, assignment closure, versioning, and audit checks; restore is backend-only until an archived-record management surface is added.

### Modules 3–4: Fleet Management and Crane/Equipment Management

- **FR-030 — Implemented:** Authorized users shall register trucks, vehicles, cranes, and equipment with a unique code.
- **FR-031 — Implemented:** Asset visibility shall be all-assets or active-assignment scoped according to permission.
- **FR-032 — Implemented:** Inspections shall record type, result, checklist, findings, technician, and completion time.
- **FR-033 — Implemented:** A failed or conditional inspection shall move the asset to `under_inspection`.
- **FR-034 — Implemented:** Opening maintenance shall move the asset to `under_maintenance` and record whether the defect blocks dispatch.
- **FR-035 — Implemented:** Releasing maintenance shall require a passing inspection completed after the work order was opened.
- **FR-036 — Implemented:** An asset may become `ready_for_service` only when no unreleased blocking work remains.
- **FR-037 — Implemented:** Maintenance work orders, defect logging, parts usage, work performed, next-due scheduling, post-repair inspection verification, and safe asset release are fully supported in the asset and maintenance controllers.

### Module 5: Fuel Management and shared tracking

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

- **FR-050 — Partial:** The database and transitional browser routes preserve job reports, private attachment metadata, notifications, GPT recommendations, and audit events; complete routed UI and export workflows remain.
- **FR-051 — Implemented:** Important current mutations shall record an audit event containing actor, subject, action, before/after summary where applicable, request ID, IP, and occurrence time.
- **FR-052 — Implemented:** OpenAI `gpt-5-mini` recommendations include
  explanation and conflicts, be role-scoped, expire after 15 minutes, and never
  mutate operational data without a separately authorized human action; the
  routed review UI remains incomplete.
- **FR-053 — Partial:** Reports are permission-scoped and can be submitted, reviewed, and summarized through authorized operations; exports remain planned.
- **FR-054 — Implemented:** Attachments are private, limited to 15 MiB each
  and 10 per owning record, restricted initially to JPEG, PNG, HEIC/HEIF, and
  PDF, content-MIME validated, checksum recorded, and downloaded only after
  authorization. A complete routed upload/report experience remains incomplete.
- **FR-055 — Partial:** The focused React Native application for Driver, Crane
  Operator, and Field Technician uses the same Laravel domain rules through a
  versioned JSON API. Its Expo/React Native component tree, SecureStore adapter,
  role gating, assigned-job states, and pending-revocation logout recovery pass
  package tests. Clean native builds and complete Detox acceptance pass on
  Android API 30 and API 36, and the supported physical Android phone journey
  passes on Android 12/API 31. Sprint 1 and Sprint 2 are complete: actor-scoped
  durable SQLite commands, restart/reconnect replay, revoked-token fail-closed
  behavior, exactly-once idempotency, and explicit conflict recovery pass
  package and API 30/API 36 Detox coverage. Device GPS remains Sprint 3 work;
  iOS and tablet applications are outside the active release scope.

## Non-functional requirements

### Security and privacy

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
- **NFR-024 — Partial:** GPT recommendations are asynchronous and enforce
  token, cost, and rate guards; p95
  completion within 30 seconds, at most 32,000 input and 2,000 output tokens,
  an estimated USD $0.05 cost ceiling, and initial limits of 10 requests per
  user per hour and 100 system-wide per day.
- **NFR-025 — Partial:** GPT decision metadata and redacted summaries are
  retained for 90 days; raw prompts, raw responses, secrets, unnecessary
  personal data, and precise location shall not be stored. Retention
  enforcement and production proof remain incomplete.

### Accessibility and responsive use

- **NFR-030:** The interface shall meet WCAG 2.2 AA.
- **NFR-031:** Status shall not rely on color alone.
- **NFR-032:** Keyboard navigation, visible focus, screen-reader announcements, reduced motion, 200% zoom, and 44px mobile targets shall be supported.
- **NFR-033:** Map information shall have a synchronized list alternative.

## Recorded baseline decisions & assigned policy owners

Session 0 recorded explicit decisions for an Android-only Expo dev build (SDK
52+), Detox/Maestro E2E runners, AWS ECS/Fly.io compute, Supabase/S3
infrastructure, Sentry/Datadog monitoring, Mapbox routing, FCM push
notifications, 7-year operational record retention, 90-day raw AI retention,
and perpetual per-device mobile token lifetime during 8-hour shifts. Assigned
policy owners and full specifications are documented in
[phase-0-baseline.md](./phase-0-baseline.md).

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
[Session 1 readiness status](./session-1-readiness-status.md).
