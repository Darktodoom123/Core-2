# Core Transaction 2 — HTTP API

**Last updated:** 2026-09-16  
**Current style:** Inertia page delivery with redirect/error/typed-flash mutations for the live workspace slice; REST API v2 (`/api/v2`) for next-gen dispatch domain commands; REST API v1 (`/api/v1`) for field mobile clients; Rental/Sales unrouted `/operations` controllers are transitional session-authenticated JSON-only boundaries.

## Conventions

- Operational routes use Laravel's `web` stack, session authentication, CSRF, active-account middleware (`active`), verified email (`verified`), and `120/minute` throttling.
- Browser mutations use Inertia 3 redirects and typed `flash` data (`flash.banner`, `flash.toast`).
  Resource assignment redirects to its dispatch detail page; most other successful writes redirect to `/`. Validation returns Laravel's normal error bag.
- REST API v1 (`/api/v1`) and v2 (`/api/v2`) require Laravel Sanctum bearer device tokens (`auth:sanctum`), active accounts (`active`), and token scope checks (`api-token`).
- Typical failures are `401` unauthenticated, `403` unauthorized, `404` missing/scoped record, `409` optimistic version conflict, `422` validation or state conflict, and `429` throttled.
- Dedicated throttles protect sensitive surfaces: `throttle:5,1` for login/forgot-password, `throttle:6,1` for email verification, `throttle:uploads` for attachments, `throttle:exports` for CSV/PDF generation, `throttle:gpt` for advisory recommendations, `throttle:location` for GPS telemetry, and `throttle:sos` for emergency operations.
- Realtime WebSocket updates are broadcast via Laravel Reverb on private channels (`operations.workspace`, `operations.sos`).

## Authentication and workspace

Browser login uses the normalized `username` credential; password reset and email verification continue to use `email`. The web login field accepts the same documented 3–50 character lowercase ASCII alphanumeric format as the mobile API.

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/login` | Render/authenticate internal user; POST throttled 5/minute |
| POST | `/logout` | Invalidate session |
| GET/POST | `/forgot-password` | Render/request password reset |
| GET/POST | `/reset-password...` | Render/complete reset |
| GET/POST | `/verify-email...` | Notice, signed verification, resend |
| GET | `/` | Render capability-scoped Inertia workspace |
| GET | `/operations/dispatch-desk/jobs` | Search and paginate permitted dispatch jobs for the office desk |
| GET | `/api/user` | Return Sanctum stateful-authenticated user profile |

Local `/dev/*` helpers are development-only and are not production API contracts.

### Office dispatch search (2026-09-06)

`GET /operations/dispatch-desk/jobs` uses the authenticated, active, verified,
120/minute web boundary plus `DispatchJob::viewAny` and row visibility. It returns
`{jobs, total, current_page, last_page, per_page}` with 25 jobs per page, using the
workspace job view model and existing assignment visibility restrictions.

Parameters: `view` (`schedule`, `in-progress`, `history`), optional `q` (at most
200 characters), `source` (`all`, `manual`, `service_request`,
`rental_reservation`, `sales_order`), and `page` (1–1,000,000). Schedule requires
timezone-qualified ISO timestamps `ends_after` and `starts_before`, with the
latter strictly later. Jobs must overlap that interval, except fully undated
preparation work. Search and source filtering precede pagination; sorting is
deterministic. Attention checks remain client-side and explicitly page-scoped.

### Login credential contract

Web login uses the normalized `username` field. The browser login field is trimmed and lowercased before validation and lookup; it must use only `a-z`, `0-9`, `.`, `_`, and `-`, be 3-50 characters, and begin and end with an alphanumeric character. The email address remains unique and is used for email verification, password reset, account recovery, and notifications.

Mobile clients use `username` as the canonical credential in `POST /api/v1/auth/login`. During the temporary compatibility window, older installed APKs may submit `email` instead; the server normalizes that legacy identifier and applies the same authentication gates. A request must submit one identifier, not both. The default compatibility date is 2026-11-07 and can be overridden with `AUTH_LEGACY_EMAIL_LOGIN_UNTIL`.

Invalid credentials use a generic response and do not reveal whether a username or email exists. Throttling uses the normalized submitted identifier plus IP.

## Core 1 integration boundary

Core 2 is a downstream operational system. Core 1 owns Sales, CRM, Client, Job Order, Rental, and Project Management and sends Core 2 three transaction types: **service, rental, and sale**. The incoming handoff carries the Core 1 transaction type, unique source reference, client reference, job/project reference when applicable, requested equipment or catalog items, schedule and location, requirements, source status/timestamp, and an idempotency key.

Core 2 validates every handoff against its own authorization, asset readiness, availability, qualification, conflict, approval, concurrency, and audit rules. Direct session-authenticated creation routes in `/operations` are transitional compatibility paths.

## Operations endpoints

The operations routes implement the **5 core operational modules** and **3 tri-modal inbound business flows** through a shared session-authenticated Laravel boundary:

### 5 Core Operational Modules
- **Dispatch Job and Scheduling (Real-Time Activation)** (`app/Modules/Dispatch`) — clients, service requests, dispatch jobs, approvals, activation, geospatial coordination, project planning, and status progression.
- **Assign Driver/Operator and Equipment** (`app/Modules/Assignment`) — assignment commands, offers, designated leads, server-side eligibility/conflict validation, and Hours of Service (HoS) compliance.
- **Fleet Management** (`app/Modules/Fleet`) — transport trucks, flatbeds, lowbed trailers, escort vehicles, and Driver Vehicle Inspection Reports (DVIR).
- **Crane and Equipment Management** (`app/Modules/CraneEquipment`) — mobile cranes, crawler cranes, boom extensions, load charts, safety certifications, and pre-lift inspections.
- **Fuel Management** (`app/Modules/Fuel`) — fuel requests, ordered status transitions, verified fuel logs, burn rate baselines, variance calculation, and automated anomaly detection.

### Tri-Modal Inbound Business Flow Adapters
- **Rental Operations Flow** (`app/Modules/Rental`) — reservation creation, approval, operator assignment, checkout/return condition diffs, and return check-in.
- **Sales Operations Flow** (`app/Modules/Sales`) — catalog, quote, order, delivery fulfillment, inventory ledger, and terminal ownership transfer.

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
| PATCH | `/operations/dispatch-jobs/{dispatchJob}/site-coordinates` | `dispatch.update` | `site_latitude`, `site_longitude`; updates job site geocoordinates |
| PATCH | `/operations/dispatch-jobs/{dispatchJob}/crane-slots` | `dispatch.update` | `planned_crane_slots` JSON array for crane pad positioning |
| PATCH | `/operations/dispatch-jobs/{dispatchJob}/assets/{assetAssignment}/site-coordinates` | `dispatch.update` | Asset-specific `site_latitude`, `site_longitude` positioning |
| POST | `/operations/dispatch-jobs/{dispatchJob}/assignments` | `assignments.create` + job policy | `personnel[]`, `assets[]`; redirects to detail with typed flash or validation errors |
| POST | `/operations/dispatch-jobs/{dispatchJob}/reassign` | `assignments.reassign` + visible-job policy | `end_personnel_assignment_ids[]`, `end_asset_assignment_ids[]`, replacement resources, required `version`, optional `reason` |
| POST | `/operations/dispatch-jobs/{dispatchJob}/assignments/{assignment}/response` | Assigned worker + `dispatch.respond_own` | `response` (accepted/rejected), required `reason` on rejection, `version`; redirects to detail with typed flash |
| POST | `/operations/dispatch-jobs/{dispatchJob}/activate` | Activate policy | `version`; rechecks safety, locks resources, and redirects to dispatch detail |
| POST | `/operations/dispatch-jobs/{dispatchJob}/status` | Active assigned worker + status permission | `status`, `version`; redirects to detail with typed flash, validation error, or stale-version recovery |
| POST | `/operations/dispatch-jobs/{dispatchJob}/cancel` | `dispatch.cancel` or `dispatch.approve_cancel` | Required `reason` and `version`; closes active assignments, increments version, and redirects with typed flash |
| POST | `/operations/dispatch-jobs/{dispatchJob}/reopen` | `dispatch.approve_cancel` or `archive.manage` | Optional `reason` and `version`; only cancelled jobs return to `draft` |
| POST | `/operations/dispatch-jobs/{dispatchJob}/archive` | `archive.manage` | Optional `reason`; soft-deletes non-active-field jobs, closes active assignment intervals, and increments version |
| POST | `/operations/dispatch-jobs/{dispatchJob}/restore` | `archive.manage` | Optional `reason`; restores soft-deleted job while preserving lifecycle status |
| POST | `/operations/approval-requests/{approvalRequest}/decision` | Approval permission + independent actor | `decision` (approved/rejected) and required `reason` |

Assignment accepts operators, support equipment, trucks, cranes,
and rigging gear. It rejects repeated resource IDs, role/type mismatches,
inactive, suspended, unavailable, or on-leave personnel, missing/expired
required credentials, asset kind mismatches, non-dispatchable readiness,
blocking maintenance, existing assignment duplicates, and overlapping
personnel or asset schedules. The write rechecks the current database state
inside one transaction after deterministic job/personnel/asset row locks.
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

### Modules 6-7: Rental and Sales Management

These session-authenticated routes are implemented backend/API slices. They
reuse the existing client, operational-asset, permission, transaction, and
audit boundaries. Creation routes in this section are transitional local
scaffolding. They are not Core 1 endpoints and do not provide the planned Core
2 receiving contract. Customer/commercial and financial workflows remain in
Core 1; the Core 2 operational UI and delivery handoffs remain incomplete.

The routes in this section are intentionally JSON-only transitional commands;
they do not redirect to an Inertia page. They use the `auth`, `active`,
`verified`, and `throttle:120,1` session middleware, retain Laravel CSRF
protection, and authorize the exact permission listed below. A JSON request from
an unauthenticated client returns `401`; inactive, unverified, or unauthorized
accounts return `403`; validation and domain conflicts return `422`; throttled
requests return `429`.

| Method | Path | Permission | Purpose | Success |
| --- | --- | --- | --- | --- |
| GET | `/operations/rental-reservations` | `rental.view` | List authorized rental reservations | `200` |
| POST | `/operations/rental-reservations` | `rental.create` | Create a reservation with server-derived days/totals | `201` |
| POST | `/operations/rental-reservations/{rentalReservation}/approve` | `rental.approve` | Approve after locked availability re-check | `200` |
| POST | `/operations/rental-reservations/{rentalReservation}/operators` | `rental.assign_operator` | Assign a qualified operator to one rental item for the inclusive rental window | `200` |
| POST | `/operations/rental-reservations/{rentalReservation}/checkout` | `rental.checkout` | Record bounded checkout evidence | `200` |
| POST | `/operations/rental-reservations/{rentalReservation}/return` | `rental.return` | Record bounded return evidence | `200` |
| POST | `/operations/rental-reservations/{rentalReservation}/operation-authorization` | `rental.operate` | Recheck checkout, assignment, qualification, asset state, and rental-window eligibility for the authenticated operator | `200` |
| GET | `/operations/sales/catalog` | `sales.view` | List active saleable catalog items | `200` |
| POST | `/operations/sales/catalog` | `sales.catalog_manage` | Create an operational catalog item and opening ledger row | `201` |
| GET | `/operations/sales/quotes` | `sales.view` | List authorized sales quotes | `200` |
| POST | `/operations/sales/quotes` | `sales.create_quote` | Create a quote with server-derived prices/totals | `201` |
| POST | `/operations/sales/quotes/{salesQuote}/accept` | `sales.approve_order` | Convert a valid draft quote into a committed order | `201` |
| GET | `/operations/sales/orders` | `sales.view` | List authorized sales orders | `200` |
| POST | `/operations/sales/orders/{salesOrder}/fulfill` | `sales.fulfill` | Fulfill after locked stock/readiness re-check | `200` |
| POST | `/operations/sales/orders/{salesOrder}/transfer-ownership` | `sales.transfer_ownership` | Perform terminal ownership transfer | `200` |

Successful responses use the current envelope `{"data": <model-or-paginator>}`.
List responses put Laravel's paginator object under `data` (including its
paginated `data` collection and page metadata); item responses put the
serialized model under `data`. The current transitional controllers do not
claim a stable API Resource schema. JSON validation uses Laravel's
`{"message": "The given data was invalid.", "errors": {"field": ["..."]}}`
shape; authorization and authentication use Laravel's standard `message`
error, and conflict messages are safe operator-facing text only.

Rental request bounds include a 48-character reference, active client,
inclusive `start_date`/`end_date`, `delivery_location` 2,000 characters,
`notes` 5,000 characters, at most 100 items, exactly-one physical quantity,
and rate cents from 0 through `2,147,483,647`. Operator assignment is per
rental item and accepts only the asset-matched `driver` or `operator`
type with an active qualified account, available personnel profile, and valid
credential at rental start. Checkout/return require
`condition` as a 1-50 entry object with non-blank string values at most 255
characters, plus independently bounded notes/damage notes.

Operation authorization succeeds only for a checked-out rental, a current
operator assignment for the selected item, an operable assigned/working asset,
and the inclusive rental date window. The server rechecks the operator account,
availability, and credential at operation time; assignment or operation
permission alone never bypasses the item and time-window checks.

Sales catalog and quote requests bound batches to 100 items, prices/quantities
to the signed 32-bit persistence maximum, quote references to 48 characters,
notes/descriptions to 5,000 characters, and require exactly one unit for a
physical linked catalog item. Quote acceptance accepts only a non-expired
`draft`; supported source transitions are `confirmed -> fulfilled` and
`fulfilled -> transferred`.

The server ignores client attempts to provide protected rental/sales derived
prices, days, totals, stock counters, or ownership state. Exact route
permissions are rechecked inside transaction-owning actions. Cross-module
asset conflicts use the Shared typed availability contract, and supported
mutations write their audit event in the same transaction as the business
change.

### Shared administration services

| Method | Path | Access | Request highlights |
| --- | --- | --- | --- |
| GET | `/operations/users` | `users.manage` | Users with roles, 50/page |
| POST | `/operations/users` | `users.manage` | Name, username, email, phone?, canonical role |
| PATCH | `/operations/users/{user}` | `users.manage` | Role and/or active state |
| PATCH | `/operations/users/{user}/personnel-profile` | `users.manage` | Availability and profile fields |
| POST | `/operations/users/{user}/credentials` | `users.manage` | Kind, number, type, dates |
| DELETE | `/operations/users/{user}/credentials/{credential}` | `users.manage` | Revoke/delete credential |
| POST | `/operations/users/{user}/reset-password` | `users.manage` | Admin password reset |

### Shared records, reporting, notifications, and GPT

| Method | Path | Purpose | Response style |
| --- | --- | --- | --- |
| GET | `/operations/job-reports` | Scoped paginated reports | Transitional JSON |
| POST | `/operations/job-reports` | Submit report with optional validated attachments, meter readings & coordinates | Redirect/flash or JSON |
| GET | `/operations/job-reports/{jobReport}` | View one authorized report and attachments | Transitional JSON |
| POST/PUT | `/operations/job-reports/{jobReport}/resubmit` | Resubmit previously rejected report with corrections | Redirect/flash or JSON |
| POST | `/operations/job-reports/{jobReport}/review` | Approve or reject a submitted report with reason | Redirect/flash or JSON |
| POST | `/operations/attachments` | Upload a private, validated attachment (SHA-256 hash, max 15 MiB) | Redirect/flash or JSON |
| GET | `/operations/attachments/{attachment}/download` | Authorized, audited private download | Streamed file |
| POST | `/operations/reports/exports` | Queue a scoped CSV/PDF export | Redirect/flash |
| GET | `/operations/reports/exports/{export}/download` | Authorized signed private export download (24-hour validity) | Streamed file |
| POST | `/operations/reports/exports/{export}/retry` | Atomically retry a failed export | Redirect/flash |
| GET | `/operations/notifications` | List the authenticated user's notifications | Transitional JSON |
| POST | `/operations/notifications/{notification}/read` | Mark an authorized notification as read | Redirect/flash or JSON |
| GET | `/operations/reports/daily-summary` | Generate an authorized daily operations summary | Transitional JSON |
| GET | `/operations/reports/weekly-fuel-summary` | Weekly aggregate fuel consumption, burn rate variances, and anomalies | Transitional JSON |
| POST | `/operations/gpt-recommendations` | Queue an authorized bounded recommendation | Redirect/flash |
| POST | `/operations/gpt-recommendations/{recommendation}/accept` | Revalidate and accept a recommendation | Redirect/flash |
| POST | `/operations/gpt-recommendations/{recommendation}/reject` | Reject a recommendation with an optional reason | Redirect/flash |
| POST | `/operations/gpt-recommendations/{recommendation}/retry` | Atomically create one authorized retry | Redirect/flash |
| POST | `/operations/gpt-circuit-breaker/toggle` | Toggle GPT recommendation circuit breaker | Redirect/flash |
| GET | `/operations/gpt-governance/telemetry` | Operational GPT cost, token, and latency metrics | Transitional JSON |

### SOS Emergency Response Operations

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/operations/sos-incidents` | `sos.view` | Real-time feed of active emergency incidents |
| GET | `/operations/sos-incidents/{sosIncident}` | `sos.view` | Incident detail, coordinates, category, and responders |
| POST | `/operations/sos-incidents/{sosIncident}/acknowledge` | `sos.respond` | Responder acknowledgment of active SOS incident |
| POST | `/operations/sos-incidents/{sosIncident}/resolve` | `sos.respond` | Resolve incident with resolution code and notes |
| POST | `/operations/sos-incidents/{sosIncident}/cancel` | `sos.respond` | Cancel false-alarm incident |
| GET | `/operations/sos-configuration/contacts` | `sos.configure` | Emergency hotline directory contacts |
| POST | `/operations/sos-configuration/contacts` | `sos.configure` | Add prioritized emergency contact |
| PUT | `/operations/sos-configuration/contacts/{sosEmergencyContact}` | `sos.configure` | Update emergency contact |
| DELETE | `/operations/sos-configuration/contacts/{sosEmergencyContact}` | `sos.configure` | Deactivate emergency contact |

### Dispatch Project Planning (`/operations/project-plans`)

Long-term project phase allocation, equipment reservation, and weekly shift coverage. Requires `auth`, `active`, `verified`, and `throttle:120,1`.

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| POST | `/operations/project-plans` | `dispatch.create` | Create new multi-phase project plan draft |
| POST | `/operations/project-plans/{projectPlan}/submit` | `dispatch.create` | Submit baseline project plan for independent review |
| POST | `/operations/project-plans/{projectPlan}/decision` | `dispatch.approve_priority` | Approve or reject baseline project plan |
| POST | `/operations/project-plans/{projectPlan}/phases/{phase?}` | `dispatch.create` | Create or update operational project phase |
| GET | `/operations/project-plans/{projectPlan}/phases/{phase}/allocation-preview/{allocation?}` | `dispatch.view_all` | Preview allocation conflicts and affected dispatches |
| POST | `/operations/project-plans/{projectPlan}/phases/{phase}/allocations/{allocation?}` | `dispatch.create` | Reserve crane/equipment asset for phase timeline |
| POST | `/operations/project-plans/{projectPlan}/phases/{phase}/shifts` | `dispatch.create` | Generate linked daily shift dispatch jobs |
| GET | `/operations/project-plans/{projectPlan}/shifts/{shift}/candidates` | `assignments.create` | Search eligible qualified crew candidates |
| POST | `/operations/project-plans/{projectPlan}/shifts/{shift}/roster` | `assignments.create` | Fill shift roster; creates exception within 24-hr lock |
| POST | `/operations/project-plans/{projectPlan}/shifts/{shift}/decision` | `assignments.approve` | Approve or reject 24-hour shift roster exception |

### Proactive GPT Advisory & Governance (`/operations/gpt-*`)

AI resource recommendation engine and governance telemetry. Throttled at `throttle:gpt` (10 requests/minute).

| Method | Path | Permission | Purpose |
| --- | --- | --- | --- |
| POST | `/operations/gpt-recommendations` | `gpt.use_dispatch` | Request AI resource allocation proposal for a dispatch job |
| POST | `/operations/gpt-recommendations/{recommendation}/accept` | `gpt.use_dispatch` | Review, revalidate, and apply proposed crew/assets |
| POST | `/operations/gpt-recommendations/{recommendation}/reject` | `gpt.use_dispatch` | Reject recommendation with structured rationale |
| POST | `/operations/gpt-recommendations/{recommendation}/retry` | `gpt.use_dispatch` | Retry failed recommendation |
| POST | `/operations/gpt-circuit-breaker/toggle` | `system.configure` | Toggle circuit breaker to temporarily bypass OpenAI API |
| GET | `/operations/gpt-governance/telemetry` | `system.configure` | Monitor API token consumption, costs, and response latencies |

### Admin Overrides and System Health

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/operations/admin/dispatch-jobs/{dispatchJob}/emergency-abort` | `system.configure` | Break-glass emergency abort of active dispatch |
| POST | `/operations/admin/assets/{asset}/safety-lockdown` | `system.configure` or `OperationsManager` | Immediate safety lockdown of compromised asset |
| GET | `/operations/admin/health` | `system.configure` | System health check (DB, cache, queue, storage, Reverb) |

## Dispatch Backend V2 REST API (`/api/v2`)

The `/api/v2` route group implements the Dispatch Backend V2 state machines, readiness projections, and outbox integration. Requires `auth:sanctum`, `active`, `api-token`, and `throttle:120,1`.

| Method | Path | Controller Action | Description |
| --- | --- | --- | --- |
| GET | `/api/v2/dispatch-jobs` | `DispatchJobV2Controller@index` | List dispatch jobs with V2 projection metadata |
| GET | `/api/v2/dispatch-jobs/{dispatchJob}` | `DispatchJobV2Controller@show` | Show dispatch job with current plan version and active offers |
| GET | `/api/v2/dispatch-jobs/{dispatchJob}/readiness` | `DispatchJobV2Controller@readiness` | Evaluate `DispatchReadinessProjection` and list blockers |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/dispatch` | `DispatchJobV2Controller@dispatch` | Transition job to `dispatched` after readiness checks |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/progress` | `DispatchJobV2Controller@progress` | Monotonic forward execution (`dispatched → en_route → arrived → working → completed`) |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/cancel` | `DispatchJobV2Controller@cancel` | Cancel dispatch attempt with version and reason |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/reopen` | `DispatchJobV2Controller@reopen` | Reopen cancelled attempt as new draft |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/archive` | `DispatchJobV2Controller@archive` | Archive terminal dispatch job |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/plan/submit` | `DispatchPlanApprovalV2Controller@submitPlan` | Submit immutable plan version for supervisory review |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/plan/approve` | `DispatchPlanApprovalV2Controller@approvePlan` | Approve plan version |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/plan/reject` | `DispatchPlanApprovalV2Controller@rejectPlan` | Reject plan version |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/emergency-override/propose` | `DispatchPlanApprovalV2Controller@proposeEmergencyOverride` | Propose time-bounded emergency override |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/emergency-override/{override}/decision` | `DispatchPlanApprovalV2Controller@decideEmergencyOverride` | Decide (approve/reject) emergency override |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/offers` | `AssignmentOfferV2Controller@propose` | Propose assignment offer to field worker |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/offers/{offer}/accept` | `AssignmentOfferV2Controller@accept` | Accept assignment offer (field worker) |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/offers/{offer}/reject` | `AssignmentOfferV2Controller@reject` | Reject assignment offer with reason |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/offers/{offer}/withdraw` | `AssignmentOfferV2Controller@withdraw` | Withdraw pending offer upon plan change |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/offers/{offer}/expire` | `AssignmentOfferV2Controller@expire` | Expire unresponded offer after deadline |
| POST | `/api/v2/dispatch-jobs/{dispatchJob}/lead` | `AssignmentOfferV2Controller@designateLead` | Designate accepted operator as execution lead |

## Versioned `/api/v1` Mobile REST API

The `/api/v1` prefix is composed from module- and platform-owned route files. All requests require `auth:sanctum`, `active`, and `api-token`.

### Authentication & Profiles
- `POST /api/v1/auth/login` (`throttle:5,1`): Authenticate field user (canonical `username`, temporary compatibility `email`).
- `POST /api/v1/auth/logout`: Invalidate device token.
- `GET /api/v1/auth/me` / `GET /api/v1/auth/user` / `GET /api/v1/user`: Return user profile, roles, and permissions.

### Field Dispatch & Custody Handover
- `GET /api/v1/dispatch-jobs`: List assigned jobs for the authenticated field worker.
- `GET /api/v1/dispatch-jobs/{dispatchJob}`: Show job detail, site requirements, crane slots, and route coordinates.
- `POST /api/v1/dispatch-jobs/{dispatchJob}/status`: Step forward in lifecycle (`accepted`, `en_route`, `arrived`, `working`, `completed`).
- `POST /api/v1/dispatch-jobs/{dispatchJob}/assignments/{assignment}/response`: Accept or reject assignment offer.
- `POST /api/v1/dispatch-jobs/{dispatchJob}/handover/initiate`: Initiate equipment custody handover.
- `POST /api/v1/dispatch-jobs/{dispatchJob}/handover/claim`: Claim transferred equipment custody.

### Driver Vehicle Inspection Report (DVIR) (`/api/v1/dvir`)
- `GET /api/v1/dvir/inspections` (`throttle:60,1`): List inspection history for operator/asset.
- `POST /api/v1/dvir/inspections` (`throttle:60,1`): Submit pre-trip or post-trip inspection with equipment classification, 360-degree walkaround photos, defects, and digital signature.
- `GET /api/v1/dvir/inspections/{inspection}` (`throttle:60,1`): View detailed DVIR report and defect statuses.

### Hours of Service (HoS) (`/api/v1/hos`)
- `GET /api/v1/hos/current-shift` (`throttle:60,1`): Current shift state, elapsed driving/duty hours, and remaining cycle hours.
- `POST /api/v1/hos/shifts/start` (`throttle:60,1`): Clock in to initiate daily HoS shift.
- `POST /api/v1/hos/duty-status` (`throttle:60,1`): Transition duty status (`operating`, `driving`, `standby`, `on_break`, `off_duty`).
- `POST /api/v1/hos/shifts/certify` (`throttle:60,1`): Certify daily shift log and clock out.
- `GET /api/v1/hos/cycle-history` (`throttle:60,1`): Historical shift and duty log summary.

### Statutory Philippine Safety Governance (`/api/v1/safety`)
- `GET|POST /api/v1/safety/hazards` (`throttle:safety`): Report site safety hazard with geo-coordinates and severity.
- `POST /api/v1/safety/hazards/{ticket}/rectify` (`throttle:safety`): Submit rectification evidence.
- `GET|POST /api/v1/safety/lift-plans` (`throttle:safety`): Submit critical lift plan (>75% capacity, tandem, proximity).
- `POST /api/v1/safety/lift-plans/{plan}/authorize` (`throttle:safety`): Operations Manager digital lift authorization.
- `GET|POST /api/v1/safety/toolbox-meetings` (`throttle:safety`): Submit daily pre-lift Toolbox Meeting (TBM).
- `POST /api/v1/safety/toolbox-meetings/{meeting}/cosign` (`throttle:safety`): Crew member digital cosignature.
- `GET|POST /api/v1/safety/work-stoppages` (`throttle:safety`): Issue imminent danger work stoppage notice.
- `POST /api/v1/safety/work-stoppages/{notice}/lift` (`throttle:safety`): Lift work stoppage notice after hazard clearance.
- `GET /api/v1/safety/metrics` (`throttle:safety`): Real-time safety compliance KPI indicators.

### Fleet & Equipment Catalogs
- `GET /api/v1/fleet/assets`, `GET /api/v1/fleet/assets/{operationalAsset}`: Read-only fleet asset specs and readiness.
- `GET /api/v1/equipment/assets`, `GET /api/v1/equipment/assets/{operationalAsset}`: Read-only crane and equipment specs.

### Fuel & Telemetry
- `GET /api/v1/fuel-requests`, `GET /api/v1/fuel-requests/{fuelRequest}`: Worker fuel requests.
- `POST /api/v1/locations` (`throttle:location`): High-frequency GPS telemetry sharing pings (lat, lng, speed, heading, accuracy).
- `GET /api/v1/dispatch/jobs/{id}/weather`: Real-time weather and wind telemetry for lift site.
- `POST /api/v1/dispatch/jobs/{id}/weather-standby`: Report weather hold / high wind safety delay.

### SOS Emergency Response
- `POST /api/v1/sos-incidents` (`throttle:sos`): Trigger emergency distress alert with instant GPS coordinates.
- `GET /api/v1/sos-incidents/active` (`throttle:sos`): Check active distress incident for current user.
- `PATCH /api/v1/sos-incidents/{sosIncident}/classification` (`throttle:sos`): Triage incident category (`medical`, `structural_collapse`, `rollover`, `fire`, `other`).
- `PATCH /api/v1/sos-incidents/{sosIncident}/location` (`throttle:sos`): Stream continuous coordinate updates during distress.
- `POST /api/v1/sos-incidents/{sosIncident}/cancel` (`throttle:sos`): Cancel distress call with mandatory cancellation reason.
- `GET /api/v1/sos-configuration` (`throttle:sos`): Emergency hotline directory.

## Realtime WebSocket Architecture (Laravel Reverb)

The application broadcasts live operational updates via **Laravel Reverb**.

### Private Channels (`routes/channels.php`)

1. **`operations.workspace`**:
   - **Authorization**: User is active, non-suspended, email-verified, and holds an operational role.
   - **Broadcast Events**: `App\Platform\Workspace\Events\WorkspaceUpdated`, `App\Modules\Dispatch\Events\DispatchExecutionTransitioned`, `App\Modules\Dispatch\Events\DispatchOutboxMessageDelivered`.
2. **`operations.sos`**:
   - **Authorization**: User is active, verified, non-suspended, and possesses the `sos.view` permission.
   - **Broadcast Events**: `App\Platform\Safety\Events\SosIncidentChanged`.
3. **`operations.safety`**:
   - **Authorization**: User is active, verified, non-suspended, and holds an operational role.
   - **Broadcast Events**: Real-time statutory safety governance updates (hazard notifications, lift plan authorizations, and work stoppages).

## Rate Limiting & Resilience Architecture

All endpoints enforce named rate limiters defined in `bootstrap/app.php` and route service providers:
- `throttle:5,1`: Web/API authentication login and password reset.
- `throttle:6,1`: Email verification requests.
- `throttle:120,1`: General web operations, planning, and admin endpoints.
- `throttle:60,1`: Mobile DVIR and Hours of Service endpoints.
- `throttle:location`: High-frequency location sharing (60 requests/minute).
- `throttle:safety`: Safety governance actions (30 requests/minute).
- `throttle:sos`: Emergency distress operations (15 requests/minute).
- `throttle:gpt`: Advisory generation (10 requests/minute).
- `throttle:uploads`: Attachment uploads (20 requests/minute).
- `throttle:exports`: Report generation (10 requests/minute).

When a client exceeds limits, the server returns HTTP `429 Too Many Requests` with a standard `Retry-After: <seconds>` header. The native mobile client (`apiClient.ts`) and durable outbox engine (`commandOutbox.ts`) parse this header and automatically delay queued synchronization attempts using bounded exponential backoff.

## Tracking Microservice Internal REST API (`apps/tracking`)

The Tracking microservice exposes high-throughput GPS ingestion and query endpoints protected by HMAC-SHA256 service signing (`ValidateServiceSignature` middleware). Requests require `X-Service-Name: operations`, `X-Timestamp: <unix-timestamp>`, and `X-Service-Signature: <hmac-sha256>`. Replay defense rejects timestamps older than 300 seconds.

| Method | Path | Middleware | Description |
| --- | --- | --- | --- |
| GET | `/ready` | None | Health readiness probe checking database connection and migration state |
| POST | `/internal/v1/locations` | `ValidateServiceSignature` | Ingest append-only GPS location samples (`user_id`, `operational_asset_id`, `dispatch_job_id`, `latitude`, `longitude`, `speed_kph`, `heading_deg`, `accuracy_m`, `recorded_at`) |
| GET | `/internal/v1/locations/latest` | `ValidateServiceSignature` | Fetch latest cached coordinate projection by `asset_id` |
| GET | `/internal/v1/locations/history` | `ValidateServiceSignature` | Query historical coordinate stream for playback |
| GET | `/internal/v1/locations` | `ValidateServiceSignature` | List locations with filtering |

*(The identical endpoint group is also aliased under `/api/internal/v1/*` for upstream gateway compatibility).*

## Canonical values

- **System Users (Roles)**: `system_administrator` (System Administrator), `operations_manager` (Operations Manager), `operator` / `crane_operator` (Operator). *(Note: Riggers and field assistants are workforce crew tracked via `PersonnelProfile` without software user login accounts).*
- **Dispatch priority**: `routine`, `priority`, `emergency`.
- **Service request status**: `submitted`, `dispatching`.
- **Dispatch execution status**: `draft`, `dispatched`, `en_route`, `arrived`, `working`, `completed`, `cancelled`.
- **Assignment offer status**: `proposed`, `offered`, `accepted`, `rejected`, `withdrawn`, `expired`, `ended`.
- **Plan approval status**: `draft`, `submitted`, `approved`, `rejected`, `superseded`.
- **Fuel status**: `submitted`, `forwarded`, `approved`, `rejected`, `verified`, `logged`.
- **Asset status**: `available`, `assigned`, `working`, `under_inspection`, `under_maintenance`, `awaiting_parts`, `ready_for_service`, `unavailable`.
- **DVIR inspection status**: `passed`, `defects_identified`, `critical_safety_lockout`.
- **HoS duty status**: `operating`, `driving`, `standby`, `on_break`, `off_duty`.
- **Project plan status**: `draft`, `submitted`, `approved`, `rejected`, `superseded`.
- **SOS status**: `triggered`, `acknowledged`, `escalated`, `resolved`, `cancelled`.
- **Rental reservation status**: `requested`, `reserved`, `checked_out`, `returned`, `closed`.
- **Sales order status**: `confirmed`, `fulfilled`, `transferred`, `cancelled`.
