# Core Transaction 2 — User Story Map Proposal

**Document class:** Supplemental source — normalized reference edition  
**Source version:** 1.0  
**Source date:** 2026-07-27  
**Original method:** User Story Mapping (Jeff Patton)  
**Imported:** 2026-07-30  
**Authority:** Non-canonical  
**Use:** Source-story and acceptance-criteria reference  
**Review register:** [Recommendation register](../RECOMMENDATION_REGISTER.md)

## 1. Source method

The source organizes stories under five activities:

1. Manage Users & System
2. Manage Jobs & Dispatches
3. Manage Resources & Schedules
4. Execute Field Operations
5. Monitor & Report

It uses Must/Should/Could/Won't prioritization and Fibonacci-like point
estimates. Priorities and points are proposal inputs, not current commitments.

## 2. Source story inventory

Original identifiers are preserved for traceability.

### Manage users and system

| IDs | Source task | Proposed outcomes |
| --- | --- | --- |
| `US-001`–`US-005` | User administration | Create/edit/deactivate, bulk import, activity review |
| `US-006`–`US-008` | Roles and permissions | Six default roles, granular permission matrix, clone templates |
| `US-009`–`US-012` | System configuration | Company settings, notification templates, integrations, backups |

Notable acceptance ideas include immediate session termination on
deactivation, active-job reassignment, validation reports for imports, and
auditable user changes.

### Manage jobs and dispatches

| IDs | Source task | Proposed outcomes |
| --- | --- | --- |
| `US-013`–`US-016` | Job intake | Create/import requests, attach files, duplicate previous work |
| `US-017`–`US-019` | Review and approval | Validate requirements, approve high-value work, reject/cancel with reason |
| `US-020`–`US-025` | Assignment | Review availability, assign driver/crane/operator/technician, recommend, dispatch |
| `US-026`–`US-029` | Tracking | Real-time status, reassignment, field communication, close/archive |

The proposed `US-029` acceptance mentions a billing export. Billing remains a
canonical non-goal and that clause is rejected unless scope changes.

### Manage resources and schedules

| IDs | Source task | Proposed outcomes |
| --- | --- | --- |
| `US-030`–`US-035` | Schedule management | Multi-view board, drag/drop, conflict blocks, shifts, reservations, AI suggestions |
| `US-036`–`US-039` | Personnel | Profiles, qualifications, shifts, workload |
| `US-040`–`US-043` | Fleet | Registry views, maintenance, fuel consumption, inspections |
| `US-044`–`US-046` | Cranes | Profiles, inspections, utilization |
| `US-047`–`US-049` | Equipment | Inventory, maintenance, location |

Qualification expiry, schedule overlap, and asset-readiness ideas align with
current server-authoritative safety rules. UI breadth and analytics require
individual maturity review.

### Execute field operations

| IDs | Source task | Proposed outcomes |
| --- | --- | --- |
| `US-050`–`US-058` | Mobile execution | Assignments, navigation, lifecycle, photos, signatures, offline, voice |
| `US-059`–`US-063` | Communication/reporting | Push, incidents, fuel, inspections, background location |

The source proposes Start/Pause/Resume/Complete. Canonical CT2 progression is
`dispatched → accepted → en_route → arrived → working → completed`; Pause is
not a persisted state unless separately approved.

### Monitor and report

| IDs | Source task | Proposed outcomes |
| --- | --- | --- |
| `US-064`–`US-067` | Dashboard | Role-based KPIs, live status, customization, dark mode |
| `US-068`–`US-071` | Live operations | Map, filters, traffic, geofences |
| `US-072`–`US-075` | Reporting | Filters, charts, exports, scheduled reports |
| `US-076`–`US-078` | Fuel | Driver request, supervisor decision, analytics/anomalies |

## 3. Source release assumptions

### Proposed Release 1

The source labels approximately 45 Must stories and about 180 points as an
8–10 week MVP focused on dispatch, scheduling, mobile execution, dashboard,
live operations, and access administration.

### Proposed Release 2

It assigns approximately 25 Should stories and 100 points to fleet, cranes,
equipment, reporting, fuel, and early AI over an additional 4–6 weeks.

### Proposed Release 3

It assigns approximately 15 Could stories and 70 points to advanced AI, maps,
scheduled reports, mobile enhancements, and integrations over another 4–6
weeks.

These release, point, and duration assumptions are historical. Current
planning starts from verified implementation evidence in
[Roadmap](../../../Roadmap.md) and the
[consolidated sprint plan](../../03_Sprint_Plan.md).

## 4. Crosswalk rules

For each `US-###` source story:

1. identify the accepted business module or shared service;
2. link its canonical functional requirement or business rule;
3. link implementation/test evidence when present;
4. classify it as duplicate, accepted with changes, needs evidence, deferred,
   or rejected;
5. preserve the original ID only as a source reference; and
6. create a real delivery item only after canonical acceptance.

## 5. Initial disposition by task

| Source task | Initial disposition |
| --- | --- |
| User administration and RBAC | Mostly duplicate/live; retain uncovered import/activity ideas |
| Job intake, approval, assignment, progression | Mostly duplicate/live; normalize state and approval vocabulary |
| Schedule board expansion | Partial; crosswalk remaining views and conflict UX |
| Fleet/crane/equipment safety | Mostly duplicate/live backend/UI; assess richer analytics |
| Mobile execution | Partial/current capstone; map to accepted API, outbox, and state contracts |
| Dark mode | Deferred/needs evidence |
| Traffic/geofencing | Deferred/needs provider and privacy evidence |
| Reports and scheduled exports | Partial; align with private asynchronous export plan |
| Fuel workflow | Duplicate in part; map to canonical ordered states |
| Advanced AI | Deferred research |

## 6. Story acceptance normalization

Useful source acceptance language may be promoted only when it also specifies,
where relevant:

- authorization and query scoping;
- boundary validation;
- canonical states and allowed transitions;
- atomic multi-write behavior and audit attribution;
- optimistic concurrency/idempotency;
- safety and segregation-of-duties failures;
- loading, empty, denied, stale, conflict, success, and offline states;
- WCAG 2.2 AA semantics and keyboard/touch behavior; and
- focused automated evidence.

