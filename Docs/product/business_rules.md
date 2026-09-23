# Core Transaction 2 — Business Rules

Alibaton's heavy-equipment rental, sales, and service lines provide the
business context. External Core 1 owns Sales, CRM, Client, Job Order, Rental,
and Project Management. These rules govern Core 2 operational processing of
service, rental, and sale handoffs; they do not authorize Core 1 customer or
commercial workflows. See [Alibaton Business Context and CT2 Scope](./alibaton-business-scope.md)
for Core 1 commercial transaction boundaries.

**Last updated:** 2026-09-16

## Identity and authorization

- **BR-001:** Only authenticated, active, non-suspended users may enter operational routes.
- **BR-002:** Operational access is expressed through roles and permissions; frontend visibility is not authorization.
- **BR-003:** A normal software user has one active operational role from the 3 canonical system user roles (`system_administrator`, `operations_manager`, `crane_operator` [Operator]). Supervisory governance, approvals, and emergency triage are consolidated into `operations_manager`, while equipment operation and field reporting are governed by `crane_operator` [Operator].
- **BR-003A:** Field personnel without direct software interaction duties (specifically **Riggers**) are registered as employees with [`PersonnelProfile`](../../apps/operations/app/Platform/Identity/Models/PersonnelProfile.php) and [`PersonnelCredential`](../../apps/operations/app/Platform/Identity/Models/PersonnelCredential.php) for crew assignment, DOLE/TESDA certification compliance, and critical lift planning, but are not provisioned with [`User`](../../apps/operations/app/Platform/Identity/Models/User.php) login accounts, web sessions, or mobile Sanctum API tokens.
- **BR-004:** “Own” means the authenticated user is the requester or has an active assignment; it is never accepted from a client-supplied user ID.
- **BR-005:** The last active System Administrator cannot be suspended or demoted.
- **BR-006:** Role or activation changes revoke existing sessions for the affected user.

## External system boundary

- **BR-007:** Core 1 is external to this repository and remains authoritative
  for customer, commercial, job-order, rental, and project transactions.
- **BR-008:** Core 2 receives only service, rental, and sale handoffs and must
  preserve the Core 1 source reference when it creates operational records.
- **BR-009:** A Core 1 handoff never bypasses Core 2 authentication, validation,
  authorization, availability, readiness, qualification, conflict,
  concurrency, state-transition, or audit rules.
- **BR-009A:** Replayed handoffs must be idempotent and must not create duplicate
  Core 2 records or repeat a state transition.

## Module 1: Dispatch Job and Scheduling & Module 2: Assign Driver/Operator and Equipment

- **BR-010:** Dispatch references are unique and scheduled end is later than start.
- **BR-011:** New jobs are created as `draft` with version 1.
- **BR-012:** A direct dispatch provides client, title, site, and priority; a
  linked dispatch derives client, title, site, notes, priority, and requirements
  from its service request and rejects client attempts to override them.
- **BR-012A:** A service request may create multiple distinct dispatch jobs for
  staged, retried, or rescheduled execution. The first conversion atomically
  changes the request from `submitted` to `dispatching`; later conversions are
  allowed while it remains `dispatching`, and dispatch references remain
  globally unique.
- **BR-013:** Personnel must be active, not suspended, and not unavailable or on leave.
- **BR-014:** Operators require a valid operator certification and commercial driving license at scheduled start; assigned riggers require valid rigging credentials (e.g., TESDA Rigging NC II, DOLE-BOSH).
- **BR-015:** Assets are assignable only when `available` or `ready_for_service`.
- **BR-016:** An asset with unreleased dispatch-blocking maintenance cannot be assigned or activated.
- **BR-017:** An asset cannot have an overlapping active dispatch assignment.
- **BR-018:** All dispatch assignments (routine, priority, and emergency) across tri-modal workflows require independent Operations approval.
- **BR-019:** An approval requester cannot decide the same approval, and only pending approvals are decidable.
- **BR-020:** Activation rejects stale versions and increments the version when successful.
- **BR-020A:** Activation requires at least one active personnel assignment and
  one active asset assignment; activation revalidates current personnel
  eligibility and asset safety; all work requires the latest applicable
  Operations approval to be approved.
- **BR-021:** Assigned field staff may move only through `dispatched → accepted → en_route → arrived → working → completed`.
- **BR-022:** Completed and cancelled jobs cannot be activated.
- **BR-023:** Ending an active personnel or asset assignment sets its
  `active_until` timestamp and preserves the historical row.
- **BR-024:** Reassignment requires the submitted dispatch version. Replacement
  resources must pass the same role, account, credential, readiness,
  maintenance, duplicate, and schedule-conflict checks as initial assignment;
  replacements also require a scheduled dispatch window.
- **BR-025:** Post-activation or non-routine reassignment requires an independent
  assignment approval unless the actor has the explicit override permission.
  Approval revalidates and applies the complete change atomically, records both
  the requester and approver, and increments the dispatch version.
- **BR-026:** Cancellation requires a non-empty reason, sets the cancelling
  actor and reason, increments the dispatch version, and closes every active
  personnel and asset assignment in the same transaction. Completed and
  already-cancelled jobs cannot be cancelled.
- **BR-027:** Reopen is restricted to cancellation-approval or archive-management
  capability and changes only a cancelled job to `draft`, clearing cancellation
  metadata and incrementing the version. Archive is restricted to
  `archive.manage`, soft-deletes only non-active-field jobs, closes any
  remaining active assignment intervals, and increments the version. Restore
  is restricted to `archive.manage`, preserves the pre-archive lifecycle
  status, increments the version, and is available only to soft-deleted jobs.
  All lifecycle commands are audited with actor, reason when supplied, and
  request/timestamp context.
- **BR-028:** Dispatch reference numbers are generated monotonically per year via atomic sequence counters (`dispatch_reference_sequences`).
- **BR-029:** Site GPS coordinates must have latitude in [-90, 90] and longitude in [-180, 180]. Planned crane slots must conform to non-overlapping slot allocations.

## Module 3: Fleet Management & Module 4: Crane and Equipment Management

- **BR-030:** Asset codes and registration numbers, when present, are unique.
- **BR-031:** Asset kind is truck, vehicle, crane, or equipment.
- **BR-032:** Inspection result is passed, failed, or conditional and includes a non-empty checklist.
- **BR-033:** Failed or conditional inspection moves the asset to `under_inspection`.
- **BR-034:** Opening maintenance moves the asset to `under_maintenance`.
- **BR-035:** Standard maintenance release requires a passing `post_repair` verification. Blocking work orders require persisted repair completion first, and verification must be completed at or after that timestamp. Routine pre/post-trip DVIRs and generic safety or maintenance inspections do not substitute for post-repair verification. A later failed/conditional inspection or defective DVIR invalidates verification until a new passing post-repair verification is recorded. Authorized managerial overrides retain their required reason and audit trail.
- **BR-036:** `ready_for_service` requires a passing inspection and no open dispatch-blocking work.
- **BR-037:** Rated capacity and meter values cannot be negative.

## Module 5: Fuel Management and Anomaly Detection

- **BR-040:** Quantity is 0.01–100,000 litres and fuel type is diesel or gasoline.
- **BR-041:** Supported transitions are `submitted` → `forwarded`;
  `forwarded` → `approved`/`rejected`; `approved` → `verified`; and
  `verified` → `logged`.
- **BR-042:** Each transition requires its corresponding permission.
- **BR-043:** The requester cannot approve their own request.
- **BR-044:** A wrong-stage or unsupported transition is rejected. The
  `logged` transition creates one `FuelLog`; duplicate logging is rejected.
- **BR-045:** Price, total cost, odometer, and hour-meter values cannot be negative.
- **BR-046:** Operational assets maintain an authoritative baseline burn rate (`baseline_burn_rate >= 0`) and unit (`L/hr` or `km/L`).
- **BR-047:** Effective burn rate is computed between sequential verified fuel logs using differential meter values.
- **BR-048:** Significant burn rate variances (>25%) automatically trigger the anomaly flag (`is_anomaly = true`) and record an explicit `anomaly_reason`.
- **BR-049:** Weekly fuel summary reports aggregate volume, expenditure, and anomaly rates across operational fleets.

## Shared tracking and privacy service

- **BR-050:** Users submit only their own location update.
- **BR-051:** Latitude is -90..90; longitude is -180..180; capture time cannot be future.
- **BR-052:** Operations-wide location visibility requires `tracking.view_all`.
- **BR-053:** Capture preserves sharing state, device capture time, and server receive time.
- **BR-054:** Precise location is collected only during explicit sharing with
  active assigned work and is deleted after 30 days; non-coordinate audit facts
  follow the owning operational/audit record.
- **BR-055:** Location is fresh within 2 minutes, delayed through 10 minutes,
  stale after 10 minutes, and offline when the client reports no network or no
  update arrives for 30 minutes.

## Inbound Commercial Flow: Rental Operations Flow

- **BR-080:** Rental `start_date` and `end_date` are inclusive business dates.
  Conflict checks convert them in the application timezone to the half-open
  window `[start_date 00:00, end_date + 1 day 00:00)`; intervals overlap only
  when `left.start < right.end` and `right.start < left.end`.
- **BR-081:** Checkout and return require a condition object with 1-50 entries;
  every value is a non-blank string of at most 255 characters. Notes and damage
  notes are independently bounded. Supported writes never use missing, null, or
  empty condition evidence as an API allowance.
- **BR-082:** Rental transitions are `requested -> reserved -> checked_out ->
  returned`; approval, checkout, and return reject every other source state.
  Rental create/approve/checkout require a dispatchable, conflict-free asset;
  return records evidence and does not overwrite a stricter operational state.
- **BR-083:** Rental creation, approval, and checkout lock all affected asset
  rows in ascending ID order before rechecking asset status, maintenance,
  inspection, overlapping Rental/Dispatch use, and committed Sales use. A typed
  Rental source may exclude only the current reservation during revalidation.
- **BR-084:** Rental line quantity is exactly one. Rental item lists are bounded
  to 100 entries, rates and totals are non-negative signed 32-bit persisted
  integers, and checked integer multiplication/addition rejects overflow before
  any write.
- **BR-085:** Rental mutations require the exact route permission and reauthorize
  inside the transaction. Domain changes and success audit events commit or roll
  back together; condition text and personal details are not copied into audit
  snapshots.
- **BR-086:** Rental checkout and return are session-authenticated, CSRF-
  protected JSON commands. Server-derived days, rates, line totals, and total
  cents are authoritative; client attempts cannot replace them.
- **BR-087:** A losing concurrent Rental, Sales, or Dispatch use returns a safe
  domain validation conflict and leaves no partial reservation, evidence, asset
  status, or success audit.
- **BR-088:** A rental operator assignment belongs to one rental item and uses
  the inclusive rental window as its half-open active interval. The operator
  must match the asset's required type, active role, availability, and
  credential validity at rental start; an operator cannot have overlapping
  rental assignments.
- **BR-089:** Operation authorization requires a checked-out rental, the
  authenticated operator's active assignment to the selected item, an assigned
  or working asset, the inclusive rental window, and a fresh role/account,
  availability, and credential check. The server rechecks the exact
  `rental.operate` permission and records the authorization audit event.

## Inbound Commercial Flow: Sales Operations Flow

- **BR-090:** A quote is accepted only from `draft`. A locked quote whose
  inclusive `valid_until` is before today in the application timezone is rejected
  with the quote still in `draft`; equality with today is valid.
- **BR-091:** Quote acceptance locks the quote, catalog rows, and linked assets,
  then validates the full batch before creating the order, reserving stock,
  writing reserve-ledger rows, changing quote status, and writing both success
  audit events in one transaction.
- **BR-092:** Catalog prices are the source for quote/order line prices and
  totals. Quote and catalog lists are bounded to 100 entries; quantities, cents,
  and checked products fit the signed 32-bit persistence maximum; physical
  linked catalog stock is exactly one.
- **BR-093:** `confirmed`, `fulfilled`, and `transferred` Sales orders commit a
  linked physical asset. The conflict checker uses order status rather than
  `quantity_reserved`, so fulfillment cannot reopen the asset for reuse.
- **BR-094:** Fulfillment is allowed only from `confirmed`, locks and rechecks
  every inventory row and linked asset, decrements on-hand/reserved counters,
  writes sale-ledger rows, marks linked assets `unavailable`, and audits the
  state change atomically.
- **BR-095:** Ownership transfer is allowed only from `fulfilled`, creates at
  most one transfer per physical asset/order item, changes the order to terminal
  `transferred`, and preserves `unavailable`. Duplicate and unique-race failures
  are translated into domain validation errors.
- **BR-096:** No generic status, inspection, maintenance, Rental return, or other
  runtime path may restore a transferred asset to an operational status. A
  confirmed sale blocks dispatchable use; fulfillment and transfer require the
  asset to remain unavailable.
- **BR-097:** Sales mutation permissions are exact and are rechecked inside the
  transaction. Client-provided prices, totals, stock counters, ownership IDs,
  and derived references are ignored or rejected rather than trusted.
- **BR-098:** Multi-line Sales actions validate every line before persisting any
  row. Audit failure or a later-line failure rolls back orders, counters, ledger
  rows, ownership rows, asset changes, and success audits together.
- **BR-099:** The derived `SO-<quote reference>` reference fits the widened
  64-character order column. Any future derivation overflow returns a stable
  validation error instead of a raw database exception.

## Shared reporting, audit, and AI services

- **BR-060:** Critical writes identify actor, subject, action, time, and request context.
- **BR-060A:** Every valid activation command reaching the domain action records
  an attributable attempt, including attempts later blocked by authorization,
  version, approval, assignment, status, or asset-safety checks.
- **BR-061:** Audit events are operational history and must not be casually edited or deleted.
- **BR-062:** GPT output is advisory, never an authorization decision.
- **BR-063:** GPT acceptance must call the same domain action as a manual workflow.
- **BR-064:** Secrets, unnecessary PII, and precise location are redacted from GPT context.
- **BR-065:** Attachment and export downloads require separate authorization.
- **BR-066:** An attachment is private, at most 15 MiB, one of at most 10 files
  on its owning record, and initially JPEG, PNG, HEIC/HEIF, or PDF after
  content-based MIME validation.
- **BR-067:** GPT recommendations use `gpt-5-mini`, expire after 15 minutes,
  fail closed, and must remain within the accepted token, cost, latency, and
  rate limits.
- **BR-068:** Job reports record work interval, summary, ending meter value/type, and job site geocoordinates at submission.
- **BR-069:** Rejected job reports require a managerial `rejection_reason`. Resubmission increments `resubmitted_count` and resets status to `submitted` for re-review.

## SOS Emergency Response System

- **BR-100:** An active internal field user may trigger an SOS emergency incident with optional emergency category and GPS coordinates.
- **BR-101:** Triggering an SOS incident immediately dispatches broadcast events on `operations.sos`, queues responder notifications, and starts the automated escalation timeout sweep.
- **BR-102:** An SOS incident remains in `triggered` or `escalated` status until an authorized responder acknowledges or resolves it.
- **BR-103:** Resolution requires an authorized responder (`sos.respond`), a valid resolution code (`all_clear`, `assistance_rendered`, `evacuated`, `medical_attended`, `false_alarm`), and resolution notes.
- **BR-104:** False alarm alerts may be cancelled by the triggering user or responder.
- **BR-105:** Emergency contact hotlines store salted SHA-256 hashes of phone numbers to prevent plaintext credential exposure while enabling fast lookup.

## Fleet & Equipment Sub-system: Driver Vehicle Inspection Reports (DVIR)

- **BR-110:** Pre-trip inspection must be submitted and certified before any vehicle or crane can transition to `dispatched` or operational use. Post-trip inspection is required upon shift completion.
- **BR-111:** If any checklist item is flagged with `is_safety_critical`, the equipment status immediately transitions to `grounded` (or `under_inspection`), barring it from dispatch until maintenance certification.
- **BR-112:** 360-degree walkaround photo tagging requires photo evidence and defect descriptions for any flagged failure component.
- **BR-113:** Maintenance mechanics or Operations Managers must inspect defects, link corrective work orders, and mark items as `repaired` or `certified_safe` before equipment status is restored to `available`.
- **BR-114:** Subsequent operators must review and countersign previous DVIR defect resolutions prior to operating equipment with prior recorded defects.
- **BR-115:** DVIR records record GPS coordinates at submission, odometer/hour-meter readings, operator identity, and are immutable once finalized for statutory compliance.

## Driver/Operator Assignment Sub-system: Hours of Service (HoS) & Fatigue Management

- **BR-120:** Operators must log continuous duty statuses from the 5 heavy-equipment statuses: `operating`, `driving`, `standby`, `on_break`, and `off_duty` (`App\Modules\HoursOfService\Enums\DutyStatus`).
- **BR-121:** Shift operating duration is governed by Philippine DOLE-OSHC heavy equipment fatigue rules: maximum 10.0-hour hard cap per shift with an automated warning alert at 9.0 hours.
- **BR-122:** Mandatory rest breaks (`on_break`) are enforced during continuous operations, with shift resets requiring minimum consecutive off-duty rest. Night Shift Differential (+10% premium) is calculated for hours worked between 22:00 and 06:00.
- **BR-123:** Exceeding the 10.0-hour hard cap triggers automatic shift lockout and safety notification to the Operations Manager, prohibiting dispatch assignment until the mandatory rest period elapses.
- **BR-124:** Real-time fatigue risk scoring evaluates shift duration and rest intervals; critical fatigue thresholds trigger automated warnings to the operator and Operations Manager.
- **BR-125:** Duty log edits maintain full audit history with mandatory edit remarks, original values, and electronic certification signatures.

## Statutory Safety Governance (DOLE OSHS Rule 1410 & DO 198-18)

- **BR-130:** Toolbox Meetings (TBM) must be documented prior to commencing daily field operations, capturing topics discussed, GPS location, digital attendee signatures (Operator, Rigger), and supervisor/Operations Manager co-signatures.
- **BR-131:** Critical Lift Plans are mandatory for heavy crane operations exceeding 75% rated capacity, tandem lifts, or operations near live hazards; plans must specify ground bearing pressure, rigging configuration, wind limits, and require Operations Manager authorization.
- **BR-132:** Work Stoppage Orders (WSO) can be issued by any field personnel under DOLE DO 198-18 upon identifying imminent danger; issuing a WSO immediately freezes active dispatches on site and requires formal safety resolution to clear.
- **BR-133:** Safety Hazards and near-misses record severity (`low`, `medium`, `high`, `critical`), photographic evidence, GPS location, and require corrective action sign-off from the Operations Manager.
- **BR-134:** Safety governance actions broadcast live events across the `operations.safety` Reverb channel for dispatch dashboard situational awareness.
- **BR-135:** Lift team members must hold verified certifications (TESDA Crane Rigging NC II for Riggers, DOLE Heavy Equipment Operator Accreditation for Operators) before assignment.

## Dispatch Project Planning & Multi-Crane Allocations

- **BR-140:** Project Plans aggregate complex, multi-day, or multi-equipment operations into sequenced milestones and task allocations.
- **BR-141:** Equipment and personnel allocation conflict detection validates against active dispatches and overlapping project phases to prevent double-booking.
- **BR-142:** Downstream project milestones remain blocked until upstream dependency requirements are certified complete.
- **BR-143:** Project performance monitors estimated vs. actual equipment operating hours, fuel consumption, and labor expenditure.
- **BR-144:** Project plans maintain version history and support cloning for standard recurring industrial lift workflows.
- **BR-145:** Project completion compiles a unified dossier containing all linked dispatch tickets, job reports, DVIR logs, and statutory lift plans.

## Granular Rate Limiting & Mobile Resilience

- **BR-150:** Route-specific rate limiting protects critical endpoints (`throttle:gpt` at 10/min, `throttle:location` at 60/min, `throttle:safety` at 30/min, `throttle:sos` at 15/min, `throttle:uploads` at 20/min, `throttle:exports` at 10/min, default API at 60/min).
- **BR-151:** HTTP 429 Too Many Requests responses must provide a `Retry-After` header indicating delay in seconds until quota refresh.
- **BR-152:** Mobile clients and command outboxes must detect HTTP 429 responses and execute exponential backoff respecting the `Retry-After` header before replaying queued mutations.

## Concurrency and integrity

- **BR-070:** Conflict-sensitive workflows use database transactions and row locks.
- **BR-071:** Foreign keys define ownership and scope; clients cannot override them.
- **BR-072:** Browser and versioned mobile location writes use a command
  UUID/idempotency key and replay without duplicating a command. The mobile
  boundary carries expected versions and exposes conflicts; `packages/field-mobile`
  provides a durable native SQLite outbox for offline shift action queuing with
  exponential backoff and replay, preventing silent overwrites of newer server state.

GPT acceptance, browser offline replay, attachment handling, location
retention, and native SQLite mobile outbox now have implemented server/mobile slices.
Complete routed shared-service UI, operational-record/attachment retention, and
AI audit retention beyond 90 days remain incomplete or undecided pending legal
and business policy.
