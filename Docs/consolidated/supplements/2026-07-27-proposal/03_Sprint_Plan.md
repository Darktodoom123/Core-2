# Core Transaction 2 — Sprint Plan Proposal

**Document class:** Supplemental source — normalized reference edition  
**Source version:** 1.0  
**Source date:** 2026-07-27  
**Original sprint duration:** Two weeks  
**Original team assumption:** Eight developers  
**Original velocity assumption:** 35–40 points per sprint  
**Imported:** 2026-07-30  
**Authority:** Historical greenfield scenario; non-canonical  
**Review register:** [Recommendation register](../RECOMMENDATION_REGISTER.md)

## 1. Source planning model

The source proposes Sprint 0 for foundations, Sprints 1–4 for core MVP,
Sprint 5 as mobile/polish buffer, Sprints 6–8 for V1.1, and Sprint 9+ for V1.2.
It assumes four frontend, two backend, one mobile, and one DevOps/QA developer.

Current CT2 planning does not use these estimates. The accepted plan is
outcome-based and starts from verified implementation evidence.

## 2. Source sprint inventory

### Sprint 0 — Foundation (`SP0-001`–`SP0-015`, 41 points)

Proposed work:

- monorepo, CI/CD, cloud infrastructure, PostgreSQL, Redis, and WebSockets;
- React/Vite web and Expo mobile initialization;
- design tokens, core components, and Storybook;
- OpenAPI auth/user contracts, JWT/SSO authentication, monitoring, and seed
  fixtures.

Most initialization and stack choices are superseded. Reusable themes are
contract documentation, quality automation, observability, and fixtures.

### Sprint 1 — Authentication and users (`SP1-001`–`SP1-011`, 32 points)

Proposed work:

- login/SSO, password reset, user CRUD, RBAC, route guards, tests, and mobile
  authentication persistence.

Most behavior is already implemented through Laravel session authentication,
Sanctum device tokens, Spatie permissions, policies, and scoped queries. SSO
remains a separate recommendation.

### Sprint 2 — Dashboard and navigation (`SP2-001`–`SP2-012`, 38 points)

Proposed work:

- application shell, theme, KPIs, charts, map, activity/emergency panels,
  dashboard API/WebSockets, and mobile home.

Role-adaptive navigation and operational surfaces exist in varying maturity.
Dark mode, generalized dashboards, and WebSocket infrastructure are not
accepted baseline requirements.

### Sprint 3 — Intake and Kanban (`SP3-001`–`SP3-011`, 33 points)

Proposed work:

- job model/API, create/edit/duplicate, workflow engine, Kanban, cards, detail
  panel, search/filter, approval, attachments, and mobile list.

Current CT2 already has client/service-request intake, dispatch conversion,
approval, assignment, activation, progression, cancellation, and detail
workspaces. Remaining presentation gaps must be derived from the current
feature catalog rather than rebuilt.

### Sprint 4 — Scheduling and assignment (`SP4-001`–`SP4-011`, 39 points)

Proposed work:

- multi-view calendar, drag/drop, conflicts, availability, three-panel
  assignment, qualification checks, reservations, and mobile assignments.

Server-side eligibility, conflict, assignment, and reassignment rules are
already live. Schedule-board expansion and richer UI are valid crosswalk
targets.

### Sprint 5 — Mobile execution and polish (`SP5-001`–`SP5-012`, 39 points)

Proposed work:

- mobile lifecycle, photos, signatures, offline queue, GPS, push, navigation;
- E2E, performance, accessibility, security, and documentation.

The quality themes remain valuable. Mobile work must follow the accepted
Sanctum, idempotency, optimistic-version, eight-hour outbox, privacy, and
canonical-state contracts.

### Sprint 6 — Fleet and equipment (`SP6-001`–`SP6-010`, 30 points)

Proposed work:

- asset models and views, maintenance, cranes, QR registry, inspections, and
  telematics.

Asset, inspection, maintenance, and release workflows are substantially
server-backed. QR codes, richer analytics/views, and telematics need separate
review.

### Sprint 7 — Fuel and reporting (`SP7-001`–`SP7-010`, 26 points)

Proposed work:

- fuel requests/approval/analytics/fraud rules, reports, exports, mobile fuel,
  and audit viewer.

Fuel and report foundations exist. Routed record UI and private asynchronous
exports remain current gaps; anomaly rules are deferred research.

### Sprint 8 — AI and advanced scheduling (`SP8-001`–`SP8-009`, 33 points)

Proposed work:

- recommendation engine, route optimization, schedule optimization,
  predictive maintenance, UI cards, toggles, and feedback.

This exceeds the accepted bounded GPT recommendation slice and is deferred
unless separately approved.

### Sprint 9 — Live operations and hardening (`SP9-001`–`SP9-010`, 27 points)

Proposed work:

- full-screen map, filters, geofences, traffic/ETA, scale optimization, load,
  disaster recovery, and release preparation.

Tracking exists with polling and a list alternative. Provider-dependent map
features need evidence. Load, recovery, and release-readiness checks remain
valid production gates.

## 3. Source totals

| Range | Proposed points |
| --- | ---: |
| Sprints 0–5 (“MVP”) | 222 |
| Sprints 6–9 (“V1.1”) | 116 |
| Total | 338 |

The totals must not be reused as forecasts. They assume a different stack,
starting point, staffing model, and scope.

## 4. Reusable delivery recommendations

- Keep backend/domain work ahead of dependent UI where contracts are unsettled.
- Run mobile and web in parallel while sharing server rules.
- Use explicit dependency and exit-gate fields.
- Include focused unit, integration, browser, mobile/device, security,
  accessibility, performance, recovery, and documentation checks.
- Reserve capacity for integration and production proof.
- Calibrate estimates from observed team delivery rather than proposal points.

## 5. Rejected or superseded assumptions

- Node/NestJS/Prisma/JWT as the implementation baseline
- greenfield monorepo and service initialization
- Redis/WebSocket/Kubernetes dependencies before measurement
- fixed 338-point or 20-week commitment
- blanket pixel-perfect Figma requirement
- a generic 80% coverage number as proof of critical behavior
- status or scope claims unsupported by current code/tests

## 6. Current planning destination

Use:

- [Roadmap](../../../Roadmap.md) for phase outcomes and implementation evidence;
- [Capstone completion plan](../../../plans/CAPSTONE_COMPLETION_PLAN.md) for
  active execution details; and
- [Consolidated sprint plan](../../03_Sprint_Plan.md) for the standalone
  delivery summary.

