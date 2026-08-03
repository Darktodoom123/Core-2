# Core Transaction 2 — Business Rules

**Last updated:** 2026-07-26

## Identity and authorization

- **BR-001:** Only authenticated, active, non-suspended users may enter operational routes.
- **BR-002:** Operational access is expressed through roles and permissions; frontend visibility is not authorization.
- **BR-003:** A normal user has one active operational role.
- **BR-004:** “Own” means the authenticated user is the requester or has an active assignment; it is never accepted from a client-supplied user ID.
- **BR-005:** The last active System Administrator cannot be suspended or demoted.
- **BR-006:** Role or activation changes revoke existing sessions for the affected user.

## Modules 1–2: Dispatch and assignment

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
- **BR-014:** Drivers require a valid driver license at scheduled start; crane operators require a valid operator certification.
- **BR-015:** Assets are assignable only when `available` or `ready_for_service`.
- **BR-016:** An asset with unreleased dispatch-blocking maintenance cannot be assigned or activated.
- **BR-017:** An asset cannot have an overlapping active dispatch assignment.
- **BR-018:** Priority and emergency assignments require independent approval.
- **BR-019:** An approval requester cannot decide the same approval, and only pending approvals are decidable.
- **BR-020:** Activation rejects stale versions and increments the version when successful.
- **BR-020A:** Activation requires at least one active personnel assignment and
  one active asset assignment; exceptional work requires the latest applicable
  approval to be approved.
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

## Modules 3–4: Fleet and crane/equipment management

- **BR-030:** Asset codes and registration numbers, when present, are unique.
- **BR-031:** Asset kind is truck, vehicle, crane, or equipment.
- **BR-032:** Inspection result is passed, failed, or conditional and includes a non-empty checklist.
- **BR-033:** Failed or conditional inspection moves the asset to `under_inspection`.
- **BR-034:** Opening maintenance moves the asset to `under_maintenance`.
- **BR-035:** Release requires a passing inspection completed after work-order creation.
- **BR-036:** `ready_for_service` requires a passing inspection and no open dispatch-blocking work.
- **BR-037:** Rated capacity and meter values cannot be negative.

## Module 5: Fuel management

- **BR-040:** Quantity is 0.01–100,000 litres and fuel type is diesel or gasoline.
- **BR-041:** Supported transitions are `submitted` → `forwarded`;
  `forwarded` → `approved`/`rejected`; `approved` → `verified`; and
  `verified` → `logged`.
- **BR-042:** Each transition requires its corresponding permission.
- **BR-043:** The requester cannot approve their own request.
- **BR-044:** A wrong-stage or unsupported transition is rejected. The
  `logged` transition creates one `FuelLog`; duplicate logging is rejected.
- **BR-045:** Price, total cost, odometer, and hour-meter values cannot be negative.

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

## Shared audit and AI services

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

## Concurrency and integrity

- **BR-070:** Conflict-sensitive workflows use database transactions and row locks.
- **BR-071:** Foreign keys define ownership and scope; clients cannot override them.
- **BR-072:** Browser and versioned mobile location writes use a command
  UUID/idempotency key and replay without duplicating a command. The mobile
  boundary carries expected versions and exposes conflicts; durable native
  storage for the reviewed 8-hour offline shift remains planned and must not
  replace newer server state silently.

GPT acceptance, browser offline replay, attachment handling, and location
retention now have implemented server/browser slices. Native offline replay,
complete routed shared-service UI, operational-record/attachment retention, and
AI audit retention beyond 90 days remain incomplete or undecided pending legal
and business policy.
