# Core Transaction 2 — Authorization and Operations Plan

## Goal

Replace the current client-side role prototype with authenticated, server-enforced Laravel authorization for six internal roles, then deliver each operational module as a tested vertical slice.

This plan is based on the supplied access matrix and the repository as it exists on July 17, 2026: Laravel 13.17, PHP 8.3, Inertia 3, React 19, Pest 4, one `User` model, no login flow, no operational database tables, and fixture/reducer-driven UI behavior.

## Decisions and assumptions

1. Use `spatie/laravel-permission:^8.3` with the existing `web` guard. Version 8.3 supports PHP 8.3 and Laravel 12/13. Roles group permissions; policies and Laravel's `can` checks remain the enforcement layer.
2. Give each user one active operational role through the admin UI (`syncRoles`), while retaining package support for future multi-role accounts. Do not grant direct user permissions in normal operation.
3. Do not allow public registration. Administrators create or invite internal users; users complete password setup/reset and email verification.
4. Give the System Administrator all explicit permissions, but keep daily operations out of the administrator's default navigation. Any backup operational action remains authorized and audited.
5. Let Dispatchers schedule and activate routine jobs. Priority/emergency jobs, post-activation assignment or schedule changes, overrides, and cancellations require Operations Manager approval.
6. Limit the Field Technician's GPT access to read-only maintenance/inspection summaries and checklist help. GPT never changes operational records directly for any role.
7. Treat “own” as the authenticated user being the current active assignee/requester. Treat “assigned vehicle/equipment” as an active assignment relation, not a client-supplied identifier.
8. Use archive/restore instead of hard delete for operational records. Reserve hard deletion for retention jobs with explicit policy and audit requirements.

## Authorization model

### Canonical role slugs

- `system_administrator`
- `dispatcher`
- `operations_manager`
- `driver`
- `crane_operator`
- `field_technician`

The existing React aliases (`administrator`, `manager`, `operator`, `technician`) should be removed from authorization logic. Labels may remain presentation-only.

### Permission catalog

Keep permission names as backed enum values or constants so seeders, policies, and UI capabilities cannot drift.

- Dispatch: `dispatch.view_all`, `dispatch.view_assigned`, `dispatch.create`, `dispatch.update`, `dispatch.activate`, `dispatch.cancel`, `dispatch.approve_priority`, `dispatch.approve_change`, `dispatch.approve_cancel`, `dispatch.update_own_status`, `dispatch.respond_own`
- Assignments: `assignments.view_all`, `assignments.view_own`, `assignments.create`, `assignments.reassign`, `assignments.approve`, `assignments.override`
- Fleet: `fleet.view_all`, `fleet.view_assigned`, `fleet.register`, `fleet.update_status`, `fleet.inspect`, `fleet.maintain`
- Equipment: `equipment.view_all`, `equipment.view_assigned`, `equipment.register`, `equipment.update_status`, `equipment.inspect`, `equipment.maintain`
- Fuel: `fuel.view_all`, `fuel.view_own`, `fuel.request`, `fuel.forward`, `fuel.approve`, `fuel.record`, `fuel.verify`, `fuel.monitor`, `fuel.report`
- Tracking: `tracking.share_own`, `tracking.view_all`
- GPT: `gpt.use_dispatch`, `gpt.use_operations`, `gpt.use_maintenance`, `gpt.configure`
- Reports: `reports.view_all`, `reports.view_dispatch`, `reports.view_own`, `reports.view_maintenance`, `reports.export`
- Administration: `users.manage`, `roles.manage`, `system.configure`, `audit.view`, `archive.manage`

`View Own` and `View All` are scopes enforced by policy and query constraints. They are not interchangeable permissions.

### Role bundles

| Role | Granted capability groups |
| --- | --- |
| System Administrator | Every explicit permission, including configuration, users, roles, audit, archive/restore, and GPT configuration |
| Dispatcher | All-job viewing; routine dispatch create/update/activate; assignment create/reassign; availability/status viewing; temporary resource status updates; fuel review/forward/monitor; all tracking; dispatch reports; dispatch GPT |
| Operations Manager | All-job viewing; priority/change/cancellation approval; assignment approval/override; fleet/equipment oversight; fuel approval/monitor/report; all tracking; all operational reports/export; operations GPT |
| Driver | Assigned dispatch/assignment viewing and response; own job status; assigned vehicle; own GPS sharing; fuel request/record/view-own; own reports/history |
| Crane Operator | Assigned dispatch/assignment viewing and response; own job status; assigned crane/equipment status and checklists; own GPS sharing; fuel request/record/view-own; own reports/history |
| Field Technician | Assigned service tasks; fleet/equipment inspection, maintenance and condition updates; fuel verification/recording; own GPS sharing; maintenance reports; maintenance-only GPT |

Create an idempotent `RolePermissionSeeder` that uses `syncPermissions`, clears the package permission cache, and is safe to rerun. Seed demo users separately from production roles/permissions.

## Domain and persistence foundation

Implement the database in module-sized migrations instead of one large schema.

### Shared records

- Extend `users` with activation/suspension metadata; keep operational identity on `User`.
- Add personnel profiles, licenses, certifications, and qualifications for assignment validation.
- Add private attachments with uploader, owning record, MIME type, checksum, and retention metadata.
- Add append-only audit events with actor, action, subject, before/after summary, reason, request ID, IP, and timestamp.
- Use enums for statuses and dedicated transition actions; do not accept arbitrary status strings.

### Dispatch and assignment

- `dispatch_jobs`: reference, customer/site details, schedule window, priority, lifecycle status, requirements, creator, activation/cancellation metadata, and optimistic version.
- `dispatch_personnel_assignments`: job, assigned user, assignment type, response status, assigned/reassigned by, approval metadata, active interval.
- `dispatch_asset_assignments`: job, vehicle/equipment, assignment type, approval metadata, active interval.
- `approval_requests`: subject, approval kind, requested change payload, requester, approver/decision, reason, timestamps.
- Validate qualifications, availability, maintenance/safety status, schedule overlap, and capacity before assignment. Lock relevant rows during confirmation to prevent double-booking.

### Fleet, crane, and equipment

- `vehicles` for trucks and road assets.
- `equipment` for cranes, attachments, and support equipment, using a type enum rather than separate tables for every subtype.
- `inspections`, checklist responses, defects, and `maintenance_work_orders` with parts/work logs.
- Resource availability is derived from active assignments plus operational/maintenance status; it must not be a freely editable boolean.

### Fuel

- `fuel_requests`, decisions, receipts, and `fuel_logs` linked to requester, job, asset, odometer/hour-meter values, verifier, and approver.
- Preserve Dispatcher review/forward and Operations Manager approval as separate actions.

### Tracking and GPT

- `location_updates` store user/asset coordinates, captured-at/server-received-at, accuracy, source, and consent/sharing state. Define a retention job before production use.
- `gpt_recommendations` store prompt context hash, redacted input references, recommendation, explanation/conflicts, model metadata, authorizing user, and lifecycle (`draft`, `reviewed`, `accepted`, `rejected`). Acceptance invokes a normal authorized domain action; GPT cannot bypass validation or policy.

## Workflow rules

### Dispatch

`Draft → Pending Approval (when required) → Scheduled → Activated/Dispatched → Accepted → En Route → Arrived → Working → Completed`

- Rejection returns the assignment to Dispatcher attention without cancelling the job.
- Cancellation is terminal but reversible only through an audited administrative restore/reopen action.
- Only assigned field users can perform their own status transitions.
- Each transition records actor and timestamp and validates the prior state.

### Assignment approval

- Routine, conflict-free assignments may be confirmed by a Dispatcher.
- Priority/emergency jobs, overrides, conflicts, and changes after activation create an approval request.
- An Operations Manager cannot approve their own exceptional change unless an explicit emergency rule is later adopted.

### Fuel

`Submitted → Reviewed/Forwarded → Approved or Rejected → Verified → Logged`

### Maintenance

`Under Inspection → Under Maintenance → Awaiting Parts → Ready for Service`

Moving to `Ready for Service` requires completed safety checks and no unresolved dispatch-blocking defect.

## Backend implementation shape

1. Protect all application routes with `auth` and, once onboarding exists, `verified` middleware.
2. Use resource policies for every record type. `viewAny` controls module access; `view` combines permission plus ownership/active-assignment scope; mutation methods check both permission and workflow state.
3. Add `visibleTo(User $user)` query scopes/query objects for list endpoints. Never fetch all rows and filter them in React.
4. Use Form Requests for authorization and validation, thin controllers, and transaction-backed Actions for create, assign, approve, transition, verify, archive, and GPT acceptance operations.
5. Prefer scoped route-model binding. For records outside the user's scope, return 404 where revealing existence would leak another worker's assignment.
6. Require an idempotency key for mobile/offline writes and use optimistic versions for status changes so queued replays cannot silently overwrite newer state.
7. Dispatch notifications/events only after transaction commit. Make jobs idempotent and safe to retry.

## Inertia and React integration

1. Share a minimal authenticated payload from `HandleInertiaRequests`: user identity, canonical role, and a capability map needed by the current page.
2. Replace `?role=` and `localStorage` role selection in `resources/js/pages/operations.tsx` with server-provided identity. Remove the production role switcher from `resources/js/components/app-shell.tsx`.
3. Build navigation from capabilities, not role names. A hidden menu is convenience only; Laravel remains authoritative.
4. Replace fixture/reducer mutations with Inertia form requests or typed endpoints. Keep local state only for selection, optimistic display, connectivity, and queued-action feedback.
5. Split the single operations page into role-aware module pages while reusing the existing surfaces and design system.
6. Keep field workflows touch-first and offline-aware. Show queued, syncing, failed, and conflict states explicitly.

## Delivery sequence

### Phase 1 — Identity and RBAC foundation

- Add internal login, logout, password setup/reset, verification, suspension checks, and session regeneration.
- Install/configure Spatie permissions, enums, User `HasRoles`, seeders, factories, and admin-only user/role endpoints.
- Add policies, capability sharing, protected routes, and replace the client role switch.
- Exit criterion: anonymous users are redirected; each seeded role sees only its allowed navigation; forbidden endpoints return 403/404 even when called directly.

### Phase 2 — Dispatch and assignments vertical slice

- Persist jobs, personnel/assets, assignments, approvals, conflicts, and audit events.
- Implement routine scheduling plus priority/override approval flows.
- Convert the guided dispatch and schedule UI from fixtures to server data.
- Exit criterion: Dispatcher can complete a routine job assignment; a priority or conflicting change cannot activate without independent manager approval.

### Phase 3 — Driver and crane-operator field flows

- Implement assignment accept/reject, checklists, status transitions, private photo/receipt upload, and offline/idempotent writes.
- Enforce active-assignment record scope.
- Exit criterion: one field user cannot discover or mutate another user's job, location, fuel request, or history.

### Phase 4 — Fleet, equipment, inspections, and maintenance

- Persist inventory/specifications, inspections, defects, checklists, maintenance work, and derived availability.
- Implement Dispatcher visibility/status controls, technician work flows, and manager oversight.
- Exit criterion: unsafe or maintenance-blocked assets cannot be assigned or marked available without satisfying release rules.

### Phase 5 — Fuel operations

- Implement requester submission, Dispatcher review/forward, manager decision, technician verification, logs, receipts, and reports.
- Exit criterion: no role can skip its allowed stage or approve its own request.

### Phase 6 — Tracking, reports, GPT, and administration

- Add opt-in field sharing, all-operations map/list, stale/offline indicators, and retention cleanup.
- Add scoped reports and exports; authorize the export job and generated download independently.
- Add explainable GPT recommendations with role-specific tools/data and mandatory human confirmation.
- Add audit viewer, archive/restore, system settings, and permission-management UI.

### Phase 7 — Hardening and cutover

- Remove fixture data paths and demo role switching from production builds.
- Run authorization, concurrency, upload, privacy, performance, accessibility, and dependency-security checks.
- Document role provisioning, emergency access, approval escalation, GPS retention, and incident response.

## Test strategy

Use Pest and `RefreshDatabase`; write each slice red-green-refactor.

- Permission snapshot test: all expected permission names exist and every role has exactly the intended set.
- Policy matrix datasets: six roles × view/create/update/approve/assign/status/export actions.
- Scope tests: assigned user succeeds; another user of the same role receives 404/403; office-wide roles see all.
- Workflow tests: invalid transitions, self-approval, missing qualification, unsafe asset, time conflict, stale optimistic version, and duplicate idempotency key are rejected.
- Feature tests: authentication, CSRF, validation, mass-assignment boundaries, private upload access, report/export authorization, and audit creation.
- GPT tests: recommendations may be generated/read only by allowed roles; no recommendation mutates records until an authorized user accepts it through the standard action.
- Add Vitest, React Testing Library, and `jest-dom`, then cover capability-driven navigation, removed role switching, field offline states, and accessible status/error feedback.
- Verification gate: `composer test`, frontend lint/format/type checks, focused browser flows for all six roles, and `composer audit`.

## Security and operational safeguards

- Regenerate sessions on login and privilege changes; revoke sessions when a user is suspended or their role changes.
- Rate-limit login, uploads, tracking, GPT, and bulk export endpoints.
- Keep photos, receipts, exports, and GPT context private; authorize every download and use short-lived signed links where appropriate.
- Validate file MIME/size, generate server-side names, scan uploads when the deployment environment supports it, and never expose storage paths.
- Redact secrets, precise location, and unnecessary PII from logs and GPT inputs.
- Audit role/permission changes, approvals, overrides, cancellations, status transitions, archive/restore, exports, and GPT acceptance.
- Add alerts for emergency override, repeated rejected login, bulk export, and unusual permission changes.
- Protect system role slugs and prevent deletion/demotion of the last active System Administrator.

## Acceptance checklist

- No URL, local-storage value, hidden button, or request payload can elevate a user's role or scope.
- The supplied matrix is traceable to seeded permissions and policy tests.
- “Own/assigned” access is proven by database relations on every read and write.
- Manager-only approvals cannot be performed by a Dispatcher or the requester.
- GPT output is explainable, scoped, recorded, and never auto-applied.
- Operational state changes are transactional, auditable, concurrency-safe, and replay-safe.
- Field screens preserve safety and sync state under poor connectivity.
- Administrator backup actions are possible but visibly attributable in the audit trail.

## Source checks

- Spatie installation and Laravel Gate integration: https://spatie.be/docs/laravel-permission/v8/installation-laravel
- Spatie role/permission best practices: https://spatie.be/docs/laravel-permission/v8/best-practices/roles-vs-permissions
- Package compatibility used by this plan: https://packagist.org/packages/spatie/laravel-permission
