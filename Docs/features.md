# Core Transaction 2 — Feature Catalog

**Last updated:** 2026-07-26

## Status key

- **Live backend:** Server-backed in the current repository; the routed UI may not expose every endpoint.
- **Partial:** Data model or a subset of behavior is implemented.
- **Prototype:** Demonstrated by the unrouted fixture/reducer UI only.
- **Planned:** Defined capability without a complete current workflow.

## Accepted module ownership

The feature catalog uses the following five top-level business modules:

| Module | Feature-catalog coverage |
| --- | --- |
| Dispatch Job and Scheduling | Client/service-request intake, job creation, scheduling, approvals, activation, and field progression |
| Driver/Operator and Equipment Assignment | Personnel and asset assignment, eligibility, conflicts, and assignment responses |
| Fleet Management | Fleet vehicle registration, status, inspections, maintenance, and readiness |
| Crane and Equipment Management | Crane/equipment registration, status, inspections, maintenance, and readiness |
| Fuel Management | Fuel requests, forwarding, decisions, verification, and final logging |

Tracking, administration, reporting, attachments, notifications, and GPT are
shared platform services. Their capabilities remain listed below because they
support one or more business modules.

## Platform foundation

| Feature | Status | Notes |
| --- | --- | --- |
| Internal login/logout | Live backend/UI | Active-account check, verified-email gate, throttled login |
| Password reset and email verification | Live backend/UI | Internal account recovery flows |
| Six-role RBAC | Live backend | Spatie permissions with canonical role enum |
| Capability-driven Inertia payload | Live backend/UI | Server shares identity/permissions and now maps live navigation plus action capabilities |
| Canonical role-adaptive web convergence | Partial | The routed shell now begins with an authorized operations overview that links pending decisions, resource readiness, stale telemetry, and scheduled work into the live module workflows; remaining prototype surfaces still use fixtures |
| Canonical frontend status view models | Live backend/UI | Laravel enum values/labels feed explicit workspace TypeScript view models; prototype label types are marked fixture-only |
| Browser mutation contract | Partial | Live dispatch, resource assignment, activation, assigned field progression, fuel, approval, location, report, attachment, notification, and GPT mutations use the current browser boundary; remaining JSON writes still require convergence |
| React Native field application | Partial | The active release targets Android phones running Android 11+. Versioned field API, Expo/React Native shell, SecureStore authentication, explicit pending-revocation logout recovery, actor-scoped durable SQLite outbox, reconnect replay, and conflict recovery pass package and device-flow coverage. Sprint 1 and Sprint 2 are complete; device GPS integration remains Sprint 3 work. iOS and tablets are outside the active release scope. |
| User provisioning and suspension | Live backend | One role per user; sessions revoked on access change; current UI is list-only |
| Personnel profiles and credentials | Live backend | Availability plus driver/operator/qualification credentials |
| Audit event recording | Live backend/UI | Used by current critical write paths and listed in workspace |

## Modules 1–2: Dispatch and assignment

| Feature | Status | Notes |
| --- | --- | --- |
| Client and service request intake | Live backend/UI | Canonical workspace creates active clients and captures client-selected requests with schedule, priority, requirements, location, and notes |
| Dispatch job creation | Live backend/UI | Direct or atomically derived from a service request; one request may produce multiple uniquely referenced drafts |
| Personnel assignment | Live backend/UI | Role, account, availability, credential, duplicate, and schedule-conflict validation with a server-authoritative detail workspace |
| Asset assignment | Live backend/UI | Kind, readiness, blocking-maintenance, duplicate, and overlap validation with a server-authoritative detail workspace |
| Exceptional approval | Live backend/UI | Priority/emergency creates independent approval request |
| Dispatch activation | Live backend | Approval, asset safety, and optimistic-version checks |
| Field status progression | Live backend/UI | Assigned-only `Today's work` and touch-first job detail expose one confirmed next action; stale, invalid, unauthorized, and terminal changes fail closed |
| Assignment accept/reject | Live backend/UI | Assigned active worker can accept or reject with a required reason, recorded timestamps, optimistic versioning, audit logging, and closed active interval |
| Cancellation/reassignment | Live backend/UI | Assignment ending/reassignment, required-reason cancellation, controlled reopen, and archive are live in the Inertia workflow; restore remains an authorized backend action without an archived-record management surface |
| Guided GPT dispatch recommendation | Live backend | Authorized, bounded, rate-limited asynchronous recommendations with human accept/reject decisions are server-backed; routed GPT controls remain to be connected to the live workspace |
| Schedule board and live map | Partial | The routed dispatch workspace now renders a bounded server-backed schedule board and conflict review; conflict indicators remain client-derived and do not replace server validation. The routed tracking workspace has a live OpenStreetMap map, synchronized list, freshness filters, and polling; the local operations map remains a fixture/prototype surface |

## Modules 3–4: Fleet and crane/equipment management

| Feature | Status | Notes |
| --- | --- | --- |
| Unified operational asset register | Live backend/UI | Trucks, vehicles, cranes, and equipment are listed in the routed workspace with registration, status, inspection, maintenance, and safe-release actions |
| Scoped asset visibility | Live backend/UI | All-assets or active-assignment access |
| Asset status updates | Live backend | Reason required and safety guard for ready-for-service |
| Inspection submission | Live backend | Checklist, result, findings, and automatic safety state |
| Maintenance work orders and safe release | Live backend/UI | Work order creation, defect reporting, parts usage, work performed, next due scheduling, post-repair inspection verification, and safe release are live |
| Job reports and private attachments | Live backend | Scoped report workflow, private validated uploads, owner authorization, checksums, and attachment limits |
| Offline field queue | Live backend/UI | Browser location commands and actor-scoped native field commands persist durably and replay with idempotency. Native SQLite close/reopen, eight-hour restoration, reconnect, exactly-once replay, explicit failure/conflict recovery, revoked-token handling, and cross-user isolation pass automated coverage. |

## Module 5: Fuel management and shared tracking

| Feature | Status | Notes |
| --- | --- | --- |
| Fuel request submission | Live backend/UI | Optional dispatch/asset link, quantity, type, purpose |
| Forward, approve/reject, verify, and log | Live backend/UI | Submitted → forwarded → approved/rejected → verified → logged status sequence is fully implemented with cost/litre, odometer, hour meter, receipt uploads, and audit trail |
| Own location sharing | Live backend/UI | Server records capture/receive times and sharing flag |
| Operations-wide location feed | Live backend/UI | Restricted to tracking-wide permission and exposed through the tracking workspace |
| Telemetry freshness map/list | Live backend/UI | Freshness thresholds, own-worker isolation, daily coordinate pruning, and reconnect replay are implemented |

## Shared platform services: administration, reporting, and AI

| Feature | Status | Notes |
| --- | --- | --- |
| Administration workspace data | Live backend/UI | Authorized users and audit events are listed |
| Role configuration | Partial | Backend role assignment exists; current UI is list-only |
| Reports and exports | Partial | Scoped report submission/review and daily-summary endpoints are live; export workflows and complete report UI remain planned |
| Notifications | Live backend | Queued notification delivery, authorized listing, read-state mutation, and audit-backed workflow events are implemented; no dedicated routed notification surface yet |
| GPT recommendation history | Live backend | Scoped generation, asynchronous processing, review, accept, reject, expiry, and audit metadata are live; the routed workspace does not yet render the lifecycle |
| Archive/restore | Partial | Authorized soft-delete/archive and restore actions are transactional and audited; archive closes active assignment intervals and normal operational views exclude archived jobs, but an archived-record management UI is still missing |

## Feature dependencies

- Dispatch activation depends on assignments, asset readiness, approvals, policies, and audit events.
- Field visibility depends on an active personnel assignment.
- Maintenance release depends on inspection history and all blocking work orders.
- Fuel decisions depend on ordered state transitions and independent permissions.
- GPT acceptance must use the same domain actions and policies as manual dispatch.

## Current UI boundary

`resources/js/pages/workspace.tsx` and `resources/js/pages/dispatch-detail.tsx`
are routed production pages. The workspace begins with a server-backed,
permission-filtered operations overview that surfaces actionable approvals,
asset safety blockers, fuel workflow steps, stale telemetry, and upcoming work
without presenting fixture data as live. These pages use explicit live view models,
server-filtered capabilities, client/service-request intake, linked draft
conversion, resource assignment/conflict review, activation readiness, assigned
field progression, and live tracking with an OpenStreetMap map/list, polling,
freshness filters, and a browser location outbox. Reports, attachments,
notifications, and GPT have server-backed transitional routes, but not every
lifecycle is rendered in the routed workspace. The richer `operations.tsx`,
remaining role surfaces, fixtures, reducer, and unconnected interactions
remain design/prototype sources and are not evidence of live product behavior.
The routed dispatch page's schedule board and conflict review are live
server-data presentations; server-side assignment, approval, and activation
workflows remain authoritative.

The accepted direction is to progressively migrate the richer experience onto
the live route. Phase 0 decisions do not change any capability status in this
catalog without implementation and acceptance evidence.
