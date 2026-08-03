# CT2 Supplemental Source Crosswalk

**Last updated:** 2026-07-30  
**Source set:** [2026-07-27 proposal](./2026-07-27-proposal/README.md)  
**Purpose:** Map source concepts to accepted module/document ownership and
current maturity evidence

## 1. Document-level crosswalk

| Supplemental source | Canonical owners | Primary conflict | Use |
| --- | --- | --- | --- |
| [PRD proposal](./2026-07-27-proposal/01_PRD_Core_Transaction_2.md) | [PRD](../../prd.md), [requirements](../../requirements.md), [modules](../../modules.md), [long-term plan](../../long-term-plan.md) | Broad module list, non-canonical states, unvalidated targets/retention | Persona, feature, KPI, integration, and risk recommendations |
| [Story map proposal](./2026-07-27-proposal/02_User_Story_Map.md) | [User flows](../../userflow.md), [requirements](../../requirements.md), [feature catalog](../../features.md), [roadmap](../../Roadmap.md) | Greenfield priorities, estimates, and some non-goal clauses | Source IDs, task coverage, and acceptance-language prompts |
| [Sprint proposal](./2026-07-27-proposal/03_Sprint_Plan.md) | [Roadmap](../../Roadmap.md), [capstone plan](../../plans/CAPSTONE_COMPLETION_PLAN.md), [consolidated sprint plan](../03_Sprint_Plan.md) | Obsolete stack/starting point/team forecast | Dependencies, quality gates, and deferred themes |
| [Architecture proposal](./2026-07-27-proposal/04_Technical_Architecture.md) | [Architecture](../../Architecture.md), [database](../../database.md), [HTTP API](../../API.md), [Phase 0 baseline](../../phase-0-baseline.md) | Node/NestJS/JWT/microservices/Kubernetes versus Laravel/Inertia/Sanctum modular monolith | Option catalogue and review prompts |
| [Design proposal](./2026-07-27-proposal/05_Design_System_Specification.md) | [Product design](../../Design.md), [consolidated design system](../05_Design_System_Specification.md), implemented CSS | Blue/Inter versus amber/Instrument Sans | Component anatomy, states, interaction, and accessibility recommendations |

## 2. Product-module mapping

| Source area | Accepted owner |
| --- | --- |
| Job intake, review, scheduling, activation, progression, cancellation | Module 1 — Dispatch Job and Scheduling |
| Personnel/asset eligibility, staffing, response, reassignment | Module 2 — Driver/Operator and Equipment Assignment |
| Vehicle registry, readiness, inspection, maintenance, utilization | Module 3 — Fleet Management |
| Crane/equipment registry, certification, inspection, maintenance | Module 4 — Crane and Equipment Management |
| Fuel request, decision, verification, logging, monitoring | Module 5 — Fuel Management |
| Dashboard, live tracking, reports, admin, notifications, files, audit, GPT, mobile delivery | Shared platform services |

## 3. State-vocabulary crosswalk

### Dispatch

| Source label | Canonical treatment |
| --- | --- |
| New Request | Service request or dispatch `draft`, depending on entity |
| Pending Review | `pending_approval` when an approval is required |
| Approved | Approval decision, not a persistent dispatch execution stage |
| Scheduled | `scheduled` |
| Assigned | Assignment readiness/relationship; not a separate canonical execution state |
| Dispatched | `dispatched` |
| On Route | `en_route` |
| Arrived | `arrived` |
| Working / In Progress | `working` |
| Completed | `completed` |
| Closed | No direct canonical state; completion/archive are distinct concepts |
| Cancelled | `cancelled` |
| Delayed / Critical | Operational condition/priority unless separately modeled |

Canonical field progression also includes `accepted` between `dispatched` and
`en_route`.

### Fuel

| Source label | Canonical treatment |
| --- | --- |
| Submit | `submitted` |
| Review/Forward | `forwarded` |
| Approve/Reject | `approved` / `rejected` |
| Issue/Dispense | Not a standalone canonical state |
| Verify | `verified` |
| Log | `logged` |

### Assets

Source Available/In Use/Maintenance/Out of Service labels must map to the
canonical asset enum: `available`, `assigned`, `working`, `under_inspection`,
`under_maintenance`, `awaiting_parts`, `ready_for_service`, and `unavailable`.
Telemetry offline is not an asset lifecycle state.

## 4. Technology crosswalk

| Source proposal | Accepted/current direction |
| --- | --- |
| Node.js/NestJS/Prisma backend | PHP 8.3+/Laravel 13/Eloquent |
| JWT/refresh-token browser auth | Laravel session auth + CSRF |
| Generic bearer mobile auth | Sanctum revocable device tokens |
| React Router browser shell | Inertia 3 + React 19 routed by Laravel |
| Separate admin web app | One capability-adaptive Inertia shell |
| Redis/BullMQ baseline | Laravel database queue initially |
| Socket.io/WebSockets baseline | Measured polling now; realtime only with evidence |
| AWS RDS primary | Managed Supabase PostgreSQL |
| Direct client database access | Server-only operational database access |
| Microservices/Kubernetes/CQRS | Modular monolith; extraction only after measurement |
| Elasticsearch/TimescaleDB required | Optional only after PostgreSQL limits are demonstrated |

## 5. Design crosswalk

| Source proposal | Canonical direction |
| --- | --- |
| Blue primary `#0D5A99` | Amber brand/action/focus; cobalt informational |
| Inter | Instrument Sans |
| Light and dark equal modes | Light-first; dark mode unaccepted/deferred |
| 256 px expanded sidebar | 248 px expanded sidebar |
| WCAG 2.1 AA | WCAG 2.2 AA |
| Generic KPI-card grid | Decision-oriented dense operational workspaces |
| Color-based status variants | Text + icon/shape + semantic color |
| Map-only live view | Synchronized map and list with freshness/sharing state |
| AI contextual cards | Reviewable recommendations with source freshness, reasons, conflicts, expiry, and separate operational action |

## 6. Non-functional crosswalk

| Source target | Accepted/current treatment |
| --- | --- |
| 99.9% uptime | Accepted capstone target is 99.5% monthly for critical authenticated operations |
| PostgreSQL 5-minute RPO / 15-minute RTO | Accepted overall RPO no more than 15 minutes and RTO within 4 hours |
| Two-year precise GPS history | 30-day precise-coordinate retention |
| GPS every 60 seconds | 30 seconds moving foreground; two minutes stationary/background, subject to OS limits |
| 500 simultaneous dispatchers | Unmeasured; requires representative load target |
| API p95 under 500 ms | Candidate target; measure per critical endpoint/workload |
| GDPR/CCPA compliance | Cannot be claimed without jurisdiction, policy, controls, and legal evidence |

## 7. Maturity handling

When a source capability is reviewed:

1. check [Feature catalog](../../features.md);
2. inspect migrations/application code and focused tests;
3. label it live backend/UI, partial, prototype, planned, deferred, or rejected;
4. update the narrowest canonical owner;
5. refresh consolidated summaries only after canonical sources change.

The source documents must never be used to mark a capability live.

