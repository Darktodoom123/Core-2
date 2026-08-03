# CT2 Supplemental Recommendation Register

**Last reviewed:** 2026-07-30  
**Status:** Initial repository-grounded triage  
**Authority:** Decision register only; accepted canonical documents remain
authoritative

## How to use this register

Each row represents an actionable recommendation family from the
[2026-07-27 proposal set](./2026-07-27-proposal/README.md). A disposition of
`accepted` or `accepted with changes` means the idea may be promoted into the
named canonical owner; it does not claim that the behavior is implemented.
This initial triage does not approve new scope. `Accepted` is used only where
the direction is already present in canonical documents; owners must still
review any proposed wording or delivery change.

### Dispositions

- `accepted` — consistent and approved in current direction
- `accepted with changes` — retain intent after canonical normalization
- `duplicate` — already covered by accepted documentation/evidence
- `needs evidence` — requires research, measurement, policy, or owner decision
- `deferred` — valid candidate outside active scope
- `rejected` — conflicts with an accepted decision or current boundary

### Field defaults and review ownership

All rows were last reviewed on 2026-07-30. Current evidence and canonical
ownership are recorded in the fifth column; conflict and next action are
recorded in the sixth. No delivery reference is assigned unless a real tracker
or accepted plan item already exists.

| Prefix/category | Decision owner | Default target horizon |
| --- | --- | --- |
| `SUP-PRD`, `SUP-USM` | Product Owner with affected operational owner | Current canonical direction, research, or post-MVP according to disposition |
| `SUP-ARC` | Lead Architect | Research unless already duplicate/accepted |
| `SUP-SEC` | Security/Privacy owner with Product Owner | Policy research before delivery |
| `SUP-OPS` | Delivery/Operations owner | Production-readiness horizon |
| `SUP-AI` | Product Owner, Lead Architect, and Security/Privacy owner | Bounded current GPT scope or post-MVP research |
| `SUP-INT` | Product Owner and integration owner | Post-MVP research until a provider/business case is approved |
| `SUP-DSN` | Product Design and Accessibility owner | Current design direction or research according to disposition |

## Product and workflow recommendations

| ID | Source | Proposal | Disposition | Canonical owner / evidence | Rationale and next action |
| --- | --- | --- | --- | --- | --- |
| `SUP-PRD-001` | PRD §2–3 | Preserve six internal personas and operational pain points | Accepted with changes | [PRD](../../prd.md), [long-term plan](../../long-term-plan.md) | Align wording with canonical role permissions and field contexts |
| `SUP-PRD-002` | PRD §2 | Measure dispatch-to-departure under eight minutes | Needs evidence | [Requirements](../../requirements.md) | Define timestamps, exclusions, baseline, owner, and reporting source |
| `SUP-PRD-003` | PRD §2 | Target asset utilization above 85% | Needs evidence | [Requirements](../../requirements.md) | Define availability denominator and prevent unsafe utilization incentives |
| `SUP-PRD-004` | PRD §2 | Target conflict resolution under two minutes | Needs evidence | [Roadmap](../../Roadmap.md) | Define conflict lifecycle and measurement instrumentation |
| `SUP-PRD-005` | PRD §4 | Treat dashboard, tracking, records, administration, and AI as top-level modules | Rejected | [Modules](../../modules.md) | Accepted boundary has five business modules plus shared services |
| `SUP-PRD-006` | `DISP-001` | Persist the eleven proposed Kanban stages | Rejected unchanged | [Phase 0 baseline](../../phase-0-baseline.md) | UI labels must map to canonical Laravel states |
| `SUP-PRD-007` | `SCHD-001`–`SCHD-007` | Expand schedule views, drag/drop, shifts, reservations, and conflicts | Accepted with changes | [Requirements](../../requirements.md), [Roadmap](../../Roadmap.md) | Reuse current eligibility, authorization, optimistic locking, and keyboard alternatives |
| `SUP-PRD-008` | `LOC-004`–`LOC-006` | Add traffic, geofences, and dynamic ETA | Deferred | [Long-term plan](../../long-term-plan.md) | Requires provider, privacy, cost, accuracy, and operational evidence |
| `SUP-PRD-009` | `PERS-001`–`PERS-005` | Show qualification, workload, availability, and reasons in assignment UI | Duplicate/accepted | [Feature catalog](../../features.md) | Current assignment workspace already exposes server-derived eligibility and blocks |
| `SUP-PRD-010` | `EQUIP-002` | Add QR code generation/scanning | Deferred | [Long-term plan](../../long-term-plan.md) | Define field value, identifiers, tamper behavior, and device support |
| `SUP-PRD-011` | `RPT-004` | Deliver scheduled reports | Deferred | [Requirements](../../requirements.md) | Complete private asynchronous exports and delivery authorization first |
| `SUP-PRD-012` | `ADMIN-008` | Add integration marketplace and API-key management | Rejected as near-term shape | [Architecture](../../Architecture.md) | Evaluate integrations individually; avoid implying public platform/API support |
| `SUP-PRD-013` | `MOB-004`–`MOB-005` | Add field photos and digital signatures | Accepted with changes | [Long-term plan](../../long-term-plan.md) | Follow private attachment, MIME, metadata, authorization, and retention policy |
| `SUP-PRD-014` | `MOB-008` | Add voice notes | Deferred | [Long-term plan](../../long-term-plan.md) | Requires privacy, retention, accessibility, transcription, and storage review |
| `SUP-PRD-015` | `MOB-010` | Add structured incident reporting | Needs evidence | [Long-term plan](../../long-term-plan.md) | Define incident taxonomy, emergency escalation, ownership, and legal retention |
| `SUP-USM-001` | `US-001`–`US-012` | Reuse user/RBAC/system acceptance language | Accepted with changes | [Business rules](../../business_rules.md), [Feature catalog](../../features.md) | Most is live; crosswalk uncovered bulk import/activity/SSO ideas separately |
| `SUP-USM-002` | `US-013`–`US-029` | Reuse intake/dispatch stories as delivery backlog | Duplicate/accepted with changes | [User flows](../../userflow.md), [Roadmap](../../Roadmap.md) | Preserve source IDs only for traceability; remove billing export clause |
| `SUP-USM-003` | `US-050`–`US-063` | Use source mobile story slice as capstone plan | Accepted with changes | [Capstone plan](../../plans/CAPSTONE_COMPLETION_PLAN.md) | Normalize states, API, idempotency, offline duration, privacy, and device evidence |
| `SUP-USM-004` | `US-067` | Add dark mode | Deferred/needs evidence | [Product design](../../Design.md) | Current product is light-first; validate user need, accessibility, and maintenance cost |
| `SUP-USM-005` | Release 1–3 | Adopt source release counts, points, and durations | Rejected | [Consolidated sprint plan](../03_Sprint_Plan.md) | Greenfield assumptions do not reflect current evidence or team capacity |

## Architecture, data, security, and operations recommendations

| ID | Source | Proposal | Disposition | Canonical owner / evidence | Rationale and next action |
| --- | --- | --- | --- | --- | --- |
| `SUP-ARC-001` | Architecture §1 | Adopt modular boundaries with extractable services | Duplicate/accepted | [Architecture](../../Architecture.md) | Already the accepted modular-monolith direction |
| `SUP-ARC-002` | Architecture §2.3 | Replace Laravel with Node/NestJS/Prisma | Rejected | [Architecture](../../Architecture.md) | Conflicts with repository and accepted stack |
| `SUP-ARC-003` | Architecture §6 | Use JWT/refresh tokens for browser auth | Rejected | [Phase 0 baseline](../../phase-0-baseline.md) | Browser uses Laravel session authentication and CSRF; mobile uses Sanctum |
| `SUP-ARC-004` | Architecture §1/8 | Require API gateway, microservices, CQRS, and Kubernetes | Rejected as baseline | [Architecture](../../Architecture.md) | Reconsider only from measured constraints and an architecture decision |
| `SUP-ARC-005` | Architecture §2.4 | Require Redis/BullMQ or RabbitMQ | Needs evidence | [Architecture](../../Architecture.md) | Database queue is accepted initial baseline |
| `SUP-ARC-006` | Architecture §2.4 | Require Elasticsearch for operational search | Needs evidence | [Architecture](../../Architecture.md) | Measure PostgreSQL search/query limits first |
| `SUP-ARC-007` | Architecture §2.4/4 | Require TimescaleDB for GPS | Needs evidence | [Database](../../database.md) | Current retention and query volume must justify extension/operations cost |
| `SUP-ARC-008` | Architecture §4.1 | Use source SQL schema | Rejected | [Database](../../database.md), Laravel migrations | Conflicts with normalized assignments, assets, permissions, and states |
| `SUP-ARC-009` | Architecture §9 | Add structured logs, tracing, APM, queue/database alerts | Accepted direction | [Architecture](../../Architecture.md), [Roadmap](../../Roadmap.md) | Select/configure providers and prove alert/runbook behavior |
| `SUP-ARC-010` | Architecture §11 | Use source front-end/API performance budgets | Needs evidence | [Requirements](../../requirements.md) | Establish representative workloads and measurement environments |
| `SUP-ARC-011` | Architecture §10 | Use five-minute RPO and fifteen-minute DB RTO | Rejected as current commitment | [Phase 0 baseline](../../phase-0-baseline.md) | Accepted capstone targets differ; stricter targets require cost/owner decision |
| `SUP-SEC-001` | PRD §5.2 | Claim GDPR/CCPA compliance | Rejected without evidence | [Business rules](../../business_rules.md) | Require jurisdiction, data inventory, policy owner, controls, and legal review |
| `SUP-SEC-002` | PRD §6.2 | Retain precise GPS for two years | Rejected | [Phase 0 baseline](../../phase-0-baseline.md) | Accepted coordinate retention is 30 days |
| `SUP-SEC-003` | PRD §5.2 | Add SAML/OAuth/OIDC SSO | Deferred/needs evidence | [Long-term plan](../../long-term-plan.md) | Define organization/provider demand, account linking, deprovisioning, and recovery |
| `SUP-OPS-001` | Sprint DoD | Retain security, accessibility, E2E, recovery, and docs gates | Accepted with changes | [Consolidated sprint plan](../03_Sprint_Plan.md) | Use risk-based checks and externally visible evidence, not blanket percentages |

## AI and integration recommendations

| ID | Source | Proposal | Disposition | Canonical owner / evidence | Rationale and next action |
| --- | --- | --- | --- | --- | --- |
| `SUP-AI-001` | `AI-001` | Explainable dispatch recommendations | Duplicate/accepted with changes | [Phase 0 baseline](../../phase-0-baseline.md) | Keep bounded GPT, expiry, revalidation, reasons, conflicts, and human action |
| `SUP-AI-002` | `AI-002`–`AI-003` | Route and schedule optimization | Deferred research | [Long-term plan](../../long-term-plan.md) | Needs data quality, solver/service evaluation, cost, and safety review |
| `SUP-AI-003` | `AI-004` | Predictive maintenance | Deferred research | [Long-term plan](../../long-term-plan.md) | Needs failure labels, sufficient history, explainability, and false-negative controls |
| `SUP-AI-004` | `AI-005` | Fuel anomaly detection above 95% accuracy | Deferred research | [Long-term plan](../../long-term-plan.md) | Define ground truth and precision/recall/business-loss measures |
| `SUP-AI-005` | `AI-006`–`AI-009` | Risk, duration, reassignment, and insight models | Deferred research | [Long-term plan](../../long-term-plan.md) | Outside bounded capstone GPT slice |
| `SUP-INT-001` | PRD §7 | Integrate telematics, maps, ERP, CRM, HRIS, accounting, weather, traffic, and communications | Needs evidence | [Long-term plan](../../long-term-plan.md) | Review each provider independently with owner, contract, privacy, cost, and failure mode |

## Design and accessibility recommendations

| ID | Source | Proposal | Disposition | Canonical owner / evidence | Rationale and next action |
| --- | --- | --- | --- | --- | --- |
| `SUP-DSN-001` | Design §1 | Operational awareness, speed, hierarchy, consistency, progressive disclosure | Duplicate/accepted | [Product design](../../Design.md) | Already aligned with canonical experience principles |
| `SUP-DSN-002` | Design §2.1 | Use blue as primary brand | Rejected | [Phase 0 baseline](../../phase-0-baseline.md) | Amber is accepted; blue remains informational |
| `SUP-DSN-003` | Design §2.2 | Use Inter as UI typeface | Rejected | [Product design](../../Design.md) | Instrument Sans is canonical and implemented |
| `SUP-DSN-004` | Design §3 | Reuse table/panel/dialog/toast/form component anatomy | Accepted with changes | [Consolidated design system](../05_Design_System_Specification.md) | Apply canonical tokens, states, content, focus, and role rules |
| `SUP-DSN-005` | Design §3.3/3.9 | Use drag/drop Kanban and schedule interactions | Needs evidence | [Product design](../../Design.md) | Must include keyboard alternative, server revalidation, and conflict recovery |
| `SUP-DSN-006` | Design §3.10 | Reuse resource/job/cluster map-marker anatomy | Accepted with changes | [Product design](../../Design.md) | Add sharing/freshness state, non-color cues, and synchronized list |
| `SUP-DSN-007` | Design §4.1 | Use 256 px expanded sidebar | Rejected as canonical | [Consolidated design system](../05_Design_System_Specification.md) | Accepted shell uses 248 px |
| `SUP-DSN-008` | Design §7 | Normalize accessibility to WCAG 2.2 AA | Accepted with changes | [Product design](../../Design.md) | Add 200% zoom, focus restoration, async announcements, map/list equivalence |

## Decision history

| Date | Change |
| --- | --- |
| 2026-07-30 | Imported normalized source set and completed initial repository-grounded triage |
