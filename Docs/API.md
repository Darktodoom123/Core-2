# Core Transaction 2 — HTTP API

**Last updated:** 2026-07-27  
**Current style:** Inertia page delivery with redirect/error/typed-flash
mutations for the live workspace slice; remaining unrouted `/operations`
controllers are a transitional session-authenticated JSON boundary

## Conventions

- Operational routes use Laravel's `web` stack, session authentication, CSRF, active-account middleware, verified email, and `120/minute` throttling.
- They are not Sanctum bearer-token endpoints.
- Live workspace client creation, service-request intake, dispatch creation,
  resource assignment, activation, assigned field progression, fuel
  submission/transition, approval decisions, and browser location sharing use
  Inertia redirects and typed `flash` data.
  Resource assignment redirects to its dispatch detail page; most other
  successful writes redirect to `/`. Validation returns Laravel's normal error
  bag.
- Remaining transitional JSON commands generally use `{ "data": ... }`;
  collection `data` contains Laravel paginator output. These shapes are not a
  stable mobile contract.
- Typical failures are `401` unauthenticated, `403` unauthorized, `404` missing/scoped record, `422` validation or state conflict, and `429` throttled.
- `GET /api/user` is a legacy resource-shaped `auth:sanctum` route. The versioned `/api/v1` boundary requires a Sanctum bearer device token and does not accept browser session authentication.
- Report, attachment, notification, daily-summary, and GPT routes are now
  present in the browser boundary, but most list/detail responses remain
  transitional JSON rather than a stable external API contract.

## Authentication and workspace

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/login` | Render/authenticate internal user; POST throttled 5/minute |
| POST | `/logout` | Invalidate session |
| GET/POST | `/forgot-password` | Render/request password reset |
| GET/POST | `/reset-password...` | Render/complete reset |
| GET/POST | `/verify-email...` | Notice, signed verification, resend |
| GET | `/` | Render capability-scoped Inertia workspace |
| GET | `/api/user` | Return Sanctum stateful-authenticated user |

Local `/dev/*` helpers are development-only and are not production API contracts.

## Operations endpoints

The operations routes implement the five business modules through a shared
session-authenticated Laravel boundary:

- Dispatch Job and Scheduling — clients, service requests, dispatch jobs,
  approvals, activation, and status progression
- Driver/Operator and Equipment Assignment — assignment commands and
  server-side eligibility/conflict validation
- Fleet Management — fleet asset registration, status, inspections, and
  maintenance
- Crane and Equipment Management — crane/equipment registration, status,
  inspections, and maintenance using the same operational-asset endpoint
- Fuel Management — fuel-request creation and ordered status transitions

Location updates and administration are shared platform services, not separate
top-level business modules. See [Top-level modules](./modules.md).

### Module 1: Dispatch Job and Scheduling — intake

| Method | Path | Access | Request highlights |
| --- | --- | --- | --- |
| GET | `/operations/clients` | `dispatch.view_all` | 50/page, company order |
| POST | `/operations/clients` | `dispatch.create` | `code`, `company_name`, optional contact fields; browser writes redirect with typed flash |
| GET | `/operations/service-requests` | `dispatch.view_all` | 50/page with client |
| POST | `/operations/service-requests` | `dispatch.create` | Active client, reference/project/service/location, priority, optional schedule/requirements/notes; browser writes redirect with typed flash |

### Modules 1–2: Dispatch, approval, and assignment

| Method | Path | Access | Request highlights |
| --- | --- | --- | --- |
| GET | `/operations/dispatch-jobs` | Dispatch view policy | Scoped, 25/page |
| POST | `/operations/dispatch-jobs` | `dispatch.create` | Reference/schedule plus direct details or `service_request_id`; linked fields are derived from the request |
| GET | `/operations/dispatch-jobs/{dispatchJob}` | Visible scope + view policy | Inertia detail workspace; current assignments plus role-scoped eligibility/conflict data |
| POST | `/operations/dispatch-jobs/{dispatchJob}/assignments` | `assignments.create` + job policy | `personnel[]`, `assets[]`; redirects to detail with typed flash or validation errors |
| POST | `/operations/dispatch-jobs/{dispatchJob}/reassign` | `assignments.reassign` + visible-job policy | `end_personnel_assignment_ids[]`, `end_asset_assignment_ids[]`, optional replacement `personnel[]`/`assets[]`, required `version`, optional `reason`; ends history-preserving intervals directly or creates an independent approval request |
| POST | `/operations/dispatch-jobs/{dispatchJob}/assignments/{assignment}/response` | Assigned worker + `dispatch.respond_own` | `response` (accepted/rejected), required `reason` on rejection, `version`; redirects to detail with typed flash or validation error |
| POST | `/operations/dispatch-jobs/{dispatchJob}/activate` | Activate policy | `version`; redirects to dispatch detail with typed flash or validation errors |
| POST | `/operations/dispatch-jobs/{dispatchJob}/status` | Active assigned worker + status permission | `status`, `version`; redirects to detail with typed flash, validation error, or stale-version recovery |
| POST | `/operations/dispatch-jobs/{dispatchJob}/cancel` | `dispatch.cancel` or `dispatch.approve_cancel` | Required `reason` and `version`; closes active assignments, increments the version, and redirects with typed flash |
| POST | `/operations/dispatch-jobs/{dispatchJob}/reopen` | `dispatch.approve_cancel` or `archive.manage` | Optional `reason` and `version`; only cancelled jobs return to `draft` |
| POST | `/operations/dispatch-jobs/{dispatchJob}/archive` | `archive.manage` | Optional `reason`; soft-deletes non-active-field jobs, closes active assignment intervals, increments the version, and redirects home |
| POST | `/operations/dispatch-jobs/{dispatchJob}/restore` | `archive.manage` | Optional `reason`; restores a soft-deleted job while preserving its lifecycle status and increments the version |
| POST | `/operations/approval-requests/{approvalRequest}/decision` | Approval permission + independent actor | approved/rejected and required reason |

Assignment accepts drivers, crane operators, field technicians, trucks, cranes,
and equipment. It rejects repeated resource IDs, role/type mismatches,
inactive, suspended, unavailable, or on-leave personnel, missing/expired
required credentials, asset kind mismatches, non-dispatchable readiness,
blocking maintenance, existing assignment duplicates, and overlapping
personnel or asset schedules. The write rechecks the current database state
inside one transaction after deterministic job/personnel/asset row locks, so a
stale eligible page cannot bypass conflict checks. Conflicts use the
`resources`, `personnel`, or `assets` validation keys with an operational
explanation. Candidate credential numbers are not included in the page
contract. Activation requires at least one active personnel assignment and one
active asset assignment. For exceptional work, the most recent applicable
approval must be approved, so an older approval cannot authorize a newer
pending or rejected resource change. Activation locks and revalidates assigned
asset readiness and blocking maintenance, rejects stale versions with an
explicit refresh-and-review browser state, and records an audit attempt before
authorization and safety checks.

Assigned field progression is restricted to an active assignment owned by the
authenticated user. The domain action locks the job and the actor's assignment,
reauthorizes inside the transaction, requires the submitted optimistic version,
and accepts only the immediate canonical successor:
`dispatched → accepted → en_route → arrived → working → completed`. Stale
versions use the `version` error key; invalid skips or reversals use `status`.
The status/version update and `dispatch.status_updated` audit event commit
atomically. Assigned-only page and collection payloads whitelist explicit view
model fields and omit co-workers' assignment records.

A service request may create multiple dispatch jobs for staged, retried, or
rescheduled work. Conversion locks the request and atomically creates the draft,
records audit history, and changes the request from `submitted` to
`dispatching` on its first conversion. Later conversions remain allowed while
the request is `dispatching`; every dispatch reference remains globally unique.
Linked writes cannot override the request-owned client, title, site, notes,
priority, or requirements.

Reassignment locks the dispatch and selected resource rows in deterministic
order, rechecks replacement eligibility inside one transaction, and increments
the dispatch version for both direct changes and approval requests. Ended rows
remain available as history. Post-activation, priority, and other override
changes create a `reassignment_override` approval; an independent assignment
approver revalidates and applies the complete staged change atomically. Stale,
duplicate, unavailable, unsafe, overlapping, cross-job, and terminal-job
requests fail without assignment or audit partial state.

### Module 5: Fuel Management and shared tracking

| Method | Path | Access | Request highlights |
| --- | --- | --- | --- |
| GET | `/operations/fuel-requests` | Own/all fuel policy | 25/page |
| POST | `/operations/fuel-requests` | `fuel.request` | Optional job/asset, quantity, diesel/gasoline, purpose |
| POST | `/operations/fuel-requests/{fuelRequest}/status` | Stage permission | status, optional reason |
| GET | `/operations/locations` | `tracking.view_all` | Latest with user, 100/page |
| POST | `/operations/locations` | `tracking.share_own` | Asset?, coordinates, accuracy?, captured time, sharing flag |

Fuel command targets supported today are `forwarded`, `approved`, `rejected`, `verified`, and `logged`. The `logged` transition creates a `FuelLog` record with quantity, price per litre, total cost, odometer, hour meter, station, remarks, receipt attachment, and audit trail.

### Modules 3–4: Fleet and crane/equipment management

| Method | Path | Access | Request highlights |
| --- | --- | --- | --- |
| GET | `/operations/assets` | Own/all asset policy | 50/page |
| POST | `/operations/assets` | Fleet/equipment register | Code, name, kind, optional subtype/specifications |
| POST | `/operations/assets/{operationalAsset}/status` | Kind-specific status permission | Status and reason |
| POST | `/operations/assets/{operationalAsset}/inspections` | Kind-specific inspect permission | Type, result, checklist, findings? |
| POST | `/operations/assets/{operationalAsset}/maintenance` | Kind-specific maintain permission | Defect and blocking flag |
| POST | `/operations/maintenance/{maintenanceWorkOrder}/release` | Kind-specific maintain permission | Work performed and optional parts |

The module-owned catalog routes provide a filtered read boundary without
duplicating the shared asset registry commands:

| Method | Path | Access | Response |
| --- | --- | --- | --- |
| GET | `/operations/fleet/assets` | Fleet own/all visibility | Trucks and vehicles only |
| GET | `/operations/fleet/assets/{operationalAsset}` | Fleet own/all visibility | One truck or vehicle only |
| GET | `/operations/equipment/assets` | Equipment own/all visibility | Cranes and equipment only |
| GET | `/operations/equipment/assets/{operationalAsset}` | Equipment own/all visibility | One crane or equipment record only |

### Shared administration services

| Method | Path | Access | Request highlights |
| --- | --- | --- | --- |
| GET | `/operations/users` | `users.manage` | Users with roles, 50/page |
| POST | `/operations/users` | `users.manage` | Name, email, phone?, canonical role |
| PATCH | `/operations/users/{user}` | `users.manage` | Role and/or active state |
| PATCH | `/operations/users/{user}/personnel-profile` | `users.manage` | Availability and profile fields |
| POST | `/operations/users/{user}/credentials` | `users.manage` | Kind, number, type, dates |

### Shared records, reporting, notifications, and GPT

| Method | Path | Purpose | Response style |
| --- | --- | --- | --- |
| GET | `/operations/job-reports` | Scoped paginated reports | Transitional JSON |
| POST | `/operations/job-reports` | Submit a report with optional validated attachments | Redirect/flash or JSON |
| GET | `/operations/job-reports/{jobReport}` | View one authorized report and attachments | Transitional JSON |
| POST | `/operations/job-reports/{jobReport}/review` | Approve or reject a submitted report | Redirect/flash or JSON |
| POST | `/operations/attachments` | Upload a private, validated attachment | Redirect/flash or JSON |
| GET | `/operations/attachments/{attachment}/download` | Authorized, audited private download | Streamed file |
| GET | `/operations/notifications` | List the authenticated user's notifications | Transitional JSON |
| POST | `/operations/notifications/{notification}/read` | Mark an authorized notification as read | Redirect/flash or JSON |
| GET | `/operations/reports/daily-summary` | Generate an authorized daily operations summary | Transitional JSON |
| POST | `/operations/gpt-recommendations` | Queue an authorized bounded recommendation | Redirect/flash |
| POST | `/operations/gpt-recommendations/{recommendation}/accept` | Revalidate and accept a recommendation | Redirect/flash |
| POST | `/operations/gpt-recommendations/{recommendation}/reject` | Reject a recommendation with an optional reason | Redirect/flash |

Attachments are private, content-validated, checksum-recorded, size-limited,
and downloaded through an authorization policy with an audit event. GPT
generation runs through the database queue and remains advisory.

## Canonical values

- Dispatch priority: `routine`, `priority`, `emergency`.
- Service request status: `submitted`, `dispatching`.
- Dispatch status: `draft`, `pending_approval`, `scheduled`, `dispatched`, `accepted`, `en_route`, `arrived`, `working`, `completed`, `cancelled`.
- Fuel status: `submitted`, `forwarded`, `approved`, `rejected`, `verified`, `logged`.
- Asset status: `available`, `assigned`, `working`, `under_inspection`, `under_maintenance`, `awaiting_parts`, `ready_for_service`, `unavailable`.
- Approval status: `pending`, `approved`, `rejected`.

Some declared states are not currently reachable through a direct transition endpoint: dispatch `pending_approval` and `scheduled`. Fuel `logged` is fully reachable via the transition endpoint. Archive and restore are lifecycle commands over the soft-deleted record and do not introduce additional dispatch status values.

## Versioned `/api/v1` mobile foundation

The versioned `/api/v1` field boundary and its typed client/workflow building
blocks in `packages/field-mobile/` are established and tested. The package now
contains a runnable Expo/React Native component tree, native dependencies, and
an Expo SecureStore token adapter. Native compile/install and supported-device
journey evidence remain acceptance gaps. Device GPS integration and durable
SQLite storage remain open work:

- **Routes and Controllers:** The `/api/v1` prefix is composed from module- and platform-owned route files and uses named routes under `api.v1.`. Controllers live with their owner: Dispatch, Assignment, Fleet, Crane/Equipment, and Fuel under `App\Modules`; identity and location services under `App\Platform`.
- **Authentication & Device Binding:** Sanctum personal access tokens are issued via `POST /api/v1/auth/login` to active, verified internal users (`is_active: true`, `suspended_at: null`, `email_verified_at: not null`). Tokens are named per device using the `device_name` field (defaulting to `"React Native Field Mobile"`).
- **Token Lifetime & Revocation:** Mobile bearer tokens persist without arbitrary automatic expiration to support 8-hour offline field shifts, but are fully revocable per device via `POST /api/v1/auth/logout` or user account suspension. If an account is suspended or a token is revoked, access is immediately blocked with `403` or `401`.
- **User Endpoint:** `GET /api/v1/auth/me` (and aliases `/api/v1/auth/user`, `/api/v1/user`) returns sanitized user profile information using `UserResource`.
- **Field Endpoints:** Assigned-job listing/detail, assignment response, forward-only status transition, own-location sharing, scoped Fleet/Equipment asset catalogs, and own/all-permission fuel-request catalogs are available under `/api/v1` and reuse the reviewed domain actions and policies.
- **Module API routes:** `GET /api/v1/fleet/assets` and `GET /api/v1/fleet/assets/{operationalAsset}` expose only trucks/vehicles; `GET /api/v1/equipment/assets` and `GET /api/v1/equipment/assets/{operationalAsset}` expose only cranes/equipment. Each route requires the matching own/all visibility permission and returns an explicit asset resource. The existing assignment-response URL remains `POST /api/v1/dispatch-jobs/{dispatchJob}/assignments/{assignment}/response`, now owned by the Assignment module to preserve the mobile contract.
- **Fuel API routes:** `GET /api/v1/fuel-requests` and `GET /api/v1/fuel-requests/{fuelRequest}` return explicit, policy-scoped fuel request resources. Command endpoints remain browser-only while their mobile workflow contract is designed.
- **API Resources & DTOs:** All mobile endpoints use explicit API resources (such as `UserResource`) to prevent exposure of raw Eloquent structures, internal attributes, hashed passwords, or credentials.
- **Idempotency & Replay Safety:** The reusable `IdempotentCommandService` accepts a user-scoped UUID key, fingerprints the complete command envelope supplied by a concrete endpoint, and replays the original response. Mobile commands require a matching UUID in the `Idempotency-Key` header or `command_id` body field. No generic command executor is exposed.
- **Version Conflict Handling:** Optimistic version mismatches throw `VersionConflictException` or convert version validation errors to `409 Conflict`, returning `"error": "stale_version"`, `"current_version"`, and safe resource snapshots.
- **Throttling:** Mobile login is throttled to 5 attempts/minute per `email|IP`; authenticated mobile requests are limited to 120 requests/minute pending more specific per-operation limits.
- **Outbox Strategy:** The package tracks queued, syncing, failed, conflict, and completed states in memory. Durable eight-hour offline persistence and native device integration remain required before production mobile release.

## Gaps and hardening

- Remaining JSON controllers serialize Eloquent models directly; introduce API
  Resources/DTOs before treating `/api/v1` shapes as a stable external
  contract.
- Add export endpoints, decide whether the mobile boundary needs a dedicated
  fuel-log adapter, and complete the archived-record management UI and routed
  UI for the shared record workflows.
- Add durable native outbox storage and device GPS integration, and complete
  supported-device acceptance of the implemented React Native shell around the
  versioned field boundary.
- Apply dedicated throttles to tracking, uploads, GPT, and bulk exports.
- Convert the remaining unrouted browser mutation candidates to the accepted
  Inertia contract or move their deliberate mobile equivalents behind
  `/api/v1`; do not preserve a hybrid production browser contract.

## Accepted contract boundaries

- `/operations` is the browser boundary: session authentication, CSRF, Inertia
  redirects/errors/flash, and server-provided page props.
- `/api/v1` is the versioned field boundary and planned React Native adapter:
  Sanctum token
  authentication, stable API Resources/DTOs, JSON errors, rate limits,
  idempotency, and optimistic versions.
- Both adapters call the same policies, validation rules, domain actions, and
  audit recording; shared domain behavior does not require shared HTTP response
  shapes.
