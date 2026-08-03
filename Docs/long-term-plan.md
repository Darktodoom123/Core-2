# Core Transaction 2 — Long-Term Product Plan

**Document status:** Strategic product vision  
**Last updated:** 2026-07-26  
**Planning horizon:** Current foundation through post-MVP expansion

## 1. Purpose

This document describes the long-term direction of Core Transaction 2 (CT2).
It preserves the complete capstone vision while separating mandatory outcomes
from later product expansion.

The documentation has distinct responsibilities:

- [prd.md](./prd.md) defines the authoritative requirements and boundaries for
  the active release.
- [business_rules.md](./business_rules.md) defines the operational, safety,
  authorization, and integrity rules that every interface must enforce.
- [Architecture.md](./Architecture.md) defines the accepted system structure
  and technical decisions.
- [Roadmap.md](./Roadmap.md) defines delivery phases and exit gates.
- [features.md](./features.md) records whether capabilities are live, partial,
  prototype, or planned in the repository.
- This document defines the broader product destination and delivery horizons.

When this plan and the PRD differ, the PRD governs the active release until the
product decision is incorporated into the PRD and related documents.

The active Phase 0 decisions are recorded in
[phase-0-baseline.md](./phase-0-baseline.md). Responsive web and the mandatory
focused React Native field application are parallel capstone workstreams; they
are no longer conflicting scopes.

## 2. Product vision

CT2 will be an intelligent dispatch and resource management platform for crane,
trucking, and related field-service operations. It will combine:

- A web operations workspace for dispatch, management, administration, and
  monitoring
- A mandatory React Native mobile application for field personnel
- Location sharing and operational tracking with explicit freshness and privacy
  controls
- GPT Mini-powered, explainable dispatch assistance
- Centralized resource, maintenance, fuel, approval, reporting, and audit
  workflows

The product should first make dispatch safe, attributable, and operationally
complete. Advanced automation, external customer access, and enterprise
integrations follow only after the core workflow is proven.

## 3. Product principles

1. The Laravel server is authoritative for every operational read and write.
2. Web and mobile clients use the same policies, domain actions, transitions,
   and audit rules.
3. Field users see only work and records within their active assignment scope.
4. Unsafe, unavailable, unqualified, conflicted, or unapproved resources cannot
   be dispatched.
5. GPT output is advisory, explainable, time-bounded, and human-confirmed.
6. Location and synchronization uncertainty must be visible rather than hidden.
7. Critical state changes must identify the actor, subject, time, and request
   context.
8. Product capability claims must be labeled as live, partial, prototype,
   planned, or future.
9. Accessibility, privacy, and security are release requirements rather than
   final-stage additions.

## 4. Technology direction

### Web

- Inertia 3
- React 19
- TypeScript
- Vite
- Existing project design system and reusable interface components

The web application is the primary interface for office and management users.
React Router and React Query are not assumed architectural dependencies because
the current application uses Inertia. They should be introduced only through a
recorded architecture decision with a demonstrated need.

### Backend

- PHP 8.3 or later
- Laravel 13
- Laravel Sanctum
- Spatie Laravel Permission
- Laravel queues, notifications, policies, Form Requests, and domain actions
- Pest 4, PHPStan, Laravel Pint, ESLint, and Prettier

The backend remains a modular Laravel monolith. Transaction-sensitive dispatch,
approval, fuel, maintenance, and audit behavior stays in shared domain actions
instead of being duplicated between browser and mobile controllers.

### Database and storage

- PostgreSQL as the production relational database
- SQLite where supported for local automated tests
- Private object storage for operational photos, reports, and attachments
- Server-only database access; clients do not receive direct operational table
  privileges

Production starts in one managed region with persistent Laravel web and worker
services co-located with Supabase PostgreSQL. Persistent services use a direct
database connection where IPv6 is available or Supavisor session mode on
IPv4-only runtimes. Private S3-compatible object storage is versioned. Hosting,
storage, monitoring, and final region providers remain undecided.

### Mobile

- React Native
- A versioned Laravel JSON API
- Sanctum-backed, revocable mobile authentication
- Device-safe private file access
- Idempotent commands and optimistic versions for retry-sensitive writes
- Push notifications when production delivery infrastructure is established

The native application is mandatory for the capstone outcome and proceeds in
parallel with responsive web delivery. It remains a focused field application
rather than a duplicate of the complete management workspace.

### AI

- OpenAI `gpt-5-mini`, subject to the accepted cost, privacy, latency, and
  retention limits
- Asynchronous recommendation generation
- Stored recommendation reasons, assumptions, conflicts, model metadata,
  context hash, expiry, and review outcome
- Explicit human acceptance or rejection

### Maps and tracking

The web slice currently wires an OpenStreetMap basemap and a synchronized list.
The production map/routing provider and usage policy remain open after
evaluating licensing, coverage, cost, routing needs, privacy, and offline
behavior. Product documents must not name conflicting providers as simultaneous
defaults.

The bounded GPT integration and lifecycle are now implemented behind an
application credential boundary. Production credentials, queue operations, and
retention policy still require product-owner configuration and authorization; no
personal subscription is an application credential.

## 5. Canonical users

### System Administrator

Manages internal accounts, canonical roles, permissions, account status,
configuration, and audit review. The last active System Administrator cannot be
suspended or demoted.

### Dispatcher

Creates clients, service requests, and dispatch jobs; schedules work; assigns
qualified personnel and safe assets; activates routine work; monitors
operations; and forwards fuel requests.

### Operations Manager

Reviews priority and emergency approvals independently, oversees operational
conflicts, monitors performance, and approves or rejects fuel requests.

### Driver

Uses the mobile application to view assigned work, respond to assignments,
advance job status, share location, provide completion evidence, and submit fuel
requests.

### Crane Operator

Uses the mobile application to view assigned work and equipment, complete
required checks, advance job status, share field evidence, and submit fuel
requests.

### Field Technician

Uses web or mobile workflows to inspect assets, report faults, open and update
maintenance work, verify fuel stages, and release equipment only after required
safety evidence exists.

### Future external user

A client portal user is a post-MVP role. In the mandatory scope, a client is a
business record managed by authorized internal users, not an authenticated
public user.

## 6. Platform responsibilities

### Web operations workspace

The web application owns:

- Internal authentication and user administration
- Client and service request management
- Dispatch creation, scheduling, assignments, approvals, and activation
- Resource, qualification, availability, inspection, and maintenance oversight
- Live location map with a synchronized accessible list
- Fuel review and decision workflows
- GPT recommendation generation and review
- Dashboards, reports, exports, audit activity, and system configuration

### Mobile field application

The mobile application owns:

- Secure login and session/device sign-out
- Assigned-job list and job details
- Assignment acceptance or rejection
- Forward-only job status progression
- Own-location sharing with visible sharing and freshness state
- Navigation handoff to the selected mapping application
- Notes, checklists, inspection results, photos, and completion evidence
- Fuel submission or verification according to role
- Notifications and schedule-change awareness
- Queued, synchronizing, failed, and conflict states for retryable commands

The initial mobile release does not include system administration, complete
dispatch planning, organization-wide reporting, role management, or unrestricted
operations-wide tracking. Its supported native platform is Android phones
running Android 11 or later; iOS and tablet applications are outside the active
release scope.

Responsive web remains available as a field fallback. Parallel delivery does
not permit the web and native clients to define different states, permissions,
or domain transitions.

### Shared Laravel domain

Both interfaces must call the same:

- Authorization policies and permission checks
- Ownership and active-assignment scopes
- Validation rules
- Transactional domain actions
- State-transition rules
- Concurrency and idempotency protections
- Audit recording

## 7. Mandatory capstone MVP

The mandatory capstone MVP is a demonstrable, secure vertical slice rather than
the complete long-term feature set.

### Foundation

- Internal authentication, verification, recovery, and account status checks
- Six canonical roles and least-privilege permissions
- User provisioning, personnel availability, and credential records
- Audit events for critical actions

### Core dispatch

- Client and service request records
- Draft dispatch creation and valid schedule windows
- Personnel and asset assignment
- License, certification, availability, readiness, maintenance, and overlap
  validation
- Independent approval for priority and emergency work
- Dispatch activation with optimistic version checks
- Field progression from dispatch through completion

### Resources and safety

- Truck, vehicle, crane, and equipment register
- Asset availability and readiness
- Inspection checklists and results
- Dispatch-blocking maintenance
- Post-repair passing inspection before release
- Basic personnel and equipment utilization visibility

### Mobile field operations

- React Native application for Driver, Crane Operator, and Field Technician
- Assigned-job access
- Status changes
- Location sharing
- Checklists, notes, photos, and completion evidence
- Fuel request or verification actions appropriate to the authenticated role
- Visible network and synchronization status

### Tracking and monitoring

- Authorized own-location submission
- Restricted operations-wide location feed
- Location capture time, receive time, sharing state, accuracy, and freshness
- Accessible list alternative to the map
- The accepted capture, freshness, 30-day precise-location retention, privacy,
  and 8-hour offline contract

### GPT Mini assistance

- Recommendations for qualified personnel, safe assets, and feasible schedules
- Explanations, assumptions, and detected conflicts
- Natural-language questions over strictly scoped operational context
- Human review and explicit acceptance or rejection
- Revalidation through the normal domain action before any operational change

GPT cannot approve exceptional work, bypass permissions, or write directly to
dispatch, assignment, asset, or personnel records.

Each request is limited to 32,000 input and 2,000 output tokens, USD $0.05
estimated model cost, p95 30-second asynchronous completion, 10 requests per
user per hour, and 100 system-wide per day initially. Recommendations expire
after 15 minutes. Redacted decision metadata is retained for 90 days; raw
prompts/responses and precise location are not stored.

### Essential notifications and reporting

- Assignment and schedule-change notifications
- Completion and delay awareness
- Basic daily dispatch and operational summary
- Audited, permission-scoped access to generated records

## 8. Post-MVP expansion

Post-MVP work extends the proven operational core:

- External client portal and controlled customer registration
- Client request submission, status visibility, history, and notifications
- Complete durable offline command replay and conflict-resolution experience
- Geofencing
- Traffic-aware route and ETA integration
- Rich mobile push-notification preferences
- Advanced schedule board and utilization analytics
- Asynchronous PDF, spreadsheet, and CSV exports
- Archive and controlled restore workflows
- Parts inventory and automated next-due maintenance
- Complete routed job-report and private-attachment workflows beyond the current
  server-backed slice
- Multi-branch preparation where authorization and data isolation are defined

## 9. Future product direction

Future capabilities require separate discovery, requirements, risk review, and
acceptance criteria:

- Predictive maintenance
- Automatic optimization proposals for dispatch and routing
- Fuel-consumption analytics
- IoT crane and vehicle sensor integration
- QR code and RFID asset tracking
- Payroll, billing, invoicing, and accounting integrations
- Full multi-branch operations
- Client native mobile application
- Predictive scheduling and demand forecasting
- Autonomous operational actions

Autonomous dispatch remains outside the accepted direction unless a future PRD
explicitly introduces governance, override, safety, and accountability controls.

## 10. Module evolution

| Module | Mandatory MVP outcome | Later evolution |
| --- | --- | --- |
| Dispatch Job and Scheduling | Client/service-request intake; create, schedule, approve, activate, and progress dispatch work | Optimization, geofencing, predictive scheduling |
| Driver/Operator and Equipment Assignment | Validate qualifications, availability, readiness, and conflicts; staff and equip jobs | IoT-assisted matching, RFID, advanced utilization |
| Fleet Management | Register fleet vehicles; manage status, inspections, maintenance, and readiness | Predictive maintenance and fleet analytics |
| Crane and Equipment Management | Register cranes/equipment; manage capacity, certification, inspections, maintenance, and readiness | Advanced capacity planning and equipment analytics |
| Fuel Management | Submit, forward, decide, verify, and complete fuel records | Consumption analytics, receipts, and automation |
| Shared platform services | Identity, roles, audit, tracking, notifications, reports, attachments, GPT, and focused mobile support | External identity, richer administration, scheduled exports, deeper offline support, and broader analytics |

## 11. End-to-end target workflow

1. An authorized internal user records a client and service request.
2. A Dispatcher creates a draft dispatch and schedule window.
3. The system validates personnel qualifications and availability.
4. The system validates asset readiness, inspection, maintenance, and schedule
   conflicts.
5. GPT may propose a schedule and resources with reasons and conflicts.
6. The Dispatcher reviews and confirms the proposed assignments.
7. Priority or emergency work is routed to an independent Operations Manager.
8. The Dispatcher activates eligible work.
9. Assigned field staff receive the work in the mobile application.
10. Field staff accept, travel, arrive, work, and complete the job through valid
    forward transitions.
11. The system records location, inspection, fuel, evidence, and audit events
    according to role and privacy rules.
12. A Field Technician or Operations Manager performs required verification.
13. The system updates dashboards, notifications, operational records, and
    authorized reports.

## 12. Security, privacy, and integrity direction

- Treat browser, mobile, GPS, file, and GPT input as untrusted.
- Validate and authorize every server request independently of client UI state.
- Use session authentication and CSRF protection for browser mutations.
- Use revocable, least-privilege mobile credentials and rate-limited endpoints.
- Revoke relevant sessions and tokens when an account is suspended or its role
  changes.
- Scope field reads and writes through active assignments rather than
  client-supplied user identifiers.
- Use database transactions, row locks, unique constraints, foreign keys, and
  optimistic versions for conflict-sensitive work.
- Require idempotency keys for commands that a mobile client may retry.
- Store attachments privately and authorize each download independently.
- Validate file type, size, checksum, and association.
- Minimize precise location collection and define consent, retention, and
  deletion behavior before production use.
- Redact secrets, unnecessary personal data, and precise location from GPT
  context.
- Preserve operational history through audit events and controlled archival
  rather than normal hard deletion.

## 13. Delivery horizons

Delivery uses outcome gates rather than unverified calendar promises.

### Horizon 1 — Alignment and parallel client foundations

- Resolve status vocabulary, browser mutation contract, map provider,
  production topology, and mobile API decisions.
- Connect the canonical React/Inertia workspace to live Laravel behavior.
- Establish the React Native boundary and versioned API/authentication and
  idempotent command contracts in parallel.

### Horizon 2 — Complete dispatch and safety lifecycle across clients

- Complete live scheduling, assignments, approvals, activation, field
  progression, inspections, maintenance, fuel, files, and essential reports.
- Deliver the focused React Native workflows for the three field roles.
- Prove assigned-only access, retry safety, and synchronization visibility.

### Horizon 3 — Tracking resilience and notifications

- Enforce accepted location freshness, retention, and offline limits.
- Complete monitoring, accessible map alternatives, notification delivery, and
  measured reconnect behavior.

### Horizon 4 — Explainable GPT Mini assistance

- Deliver scoped recommendation generation, review, acceptance, rejection,
  revalidation, cost controls, and audit evidence.

### Horizon 5 — Production hardening and capstone acceptance

- Complete security, accessibility, performance, backup/restore, deployment,
  UAT, monitoring, rollback, and operational-readiness checks.

### Horizon 6 — Post-MVP growth

- Add the client portal, deeper offline behavior, advanced analytics,
  integrations, and justified future capabilities.

## 14. Key risks and dependencies

- **Scope expansion:** Keep the client portal and enterprise integrations outside
  the mandatory MVP.
- **Web/mobile drift:** Share Laravel domain actions and publish typed,
  versioned contracts.
- **Offline conflicts:** Use command identifiers, idempotency, record versions,
  and explicit conflict UX.
- **Location privacy:** Enforce explicit consent, active-assignment scope,
  30-day precise retention, and audit before production tracking.
- **Assignment safety:** Preserve qualification, availability, maintenance, and
  overlap checks on every assignment and activation path.
- **GPT overreach:** Keep generation asynchronous and advisory; revalidate every
  accepted recommendation.
- **Private evidence:** Use authorized private storage, limited metadata
  exposure, and retention rules.
- **Unproven infrastructure:** Prove the accepted latency, GPS freshness,
  availability, recovery, and storage targets before selecting scaling
  mechanisms.

## 15. Decision status

The following Phase 0 values are accepted and must be enforced by later
implementation and acceptance evidence:

- Parallel responsive-web and mandatory React Native capstone delivery
- Eight-hour offline duration with idempotency and explicit version conflicts
- Thirty-day precise-location retention and defined freshness thresholds
- 15 MiB per attachment and 10 attachments per owning record
- OpenAI `gpt-5-mini` with the limits in
  [phase-0-baseline.md](./phase-0-baseline.md)
- Managed single-region Laravel/Supabase topology, 99.5% availability,
  15-minute RPO, and 4-hour RTO

The following remain genuinely undecided:

- Mobile token lifetime, device binding, refresh, and revocation details
- Map, routing, and push-notification providers
- Production hosting, object-storage and monitoring vendors, and final region
- Operational-record/attachment retention schedule
- AI audit retention beyond 90 days

## 16. Long-term success indicators

- Routine dispatch can be created, staffed, equipped, activated, and completed
  across web and mobile.
- Exceptional work cannot activate without independent approval.
- Unsafe assets and unqualified, unavailable, or conflicted personnel cannot be
  assigned.
- Field users cannot discover or change another worker's assignments.
- Mobile retries do not create duplicate actions or silently overwrite newer
  state.
- Location displays identify freshness and sharing state.
- GPT recommendations explain their basis and cannot bypass human authority.
- Critical actions are attributable and auditable.
- Core web and mobile workflows meet WCAG 2.2 AA where the platform permits.
- Capabilities presented as live have server-backed acceptance evidence.
