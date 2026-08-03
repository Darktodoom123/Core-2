# Core Transaction 2 — Product Requirements Proposal

**Document class:** Supplemental source — normalized reference edition  
**Source version:** 1.0  
**Source date:** 2026-07-27  
**Original status:** Draft for Stakeholder Review  
**Original author:** Product & Design Team  
**Imported:** 2026-07-30  
**Authority:** Non-canonical  
**Use:** Recommendation and traceability source only  
**Supersession rule:** Accepted `Docs/` decisions and current implementation
prevail  
**Review register:** [Recommendation register](../RECOMMENDATION_REGISTER.md)

## 1. Source vision

The proposal describes CT2 as an enterprise operations platform for logistics,
heavy equipment, crane rental, and field-service organizations. Its intended
request-to-completion journey covers intake, approval, scheduling, staffing,
dispatch, tracking, field execution, closure, and audit.

It names Microsoft Dynamics 365, SAP Fiori, Jira, ServiceNow, and Linear as
quality references and proposes:

- real-time operational awareness;
- rapid dispatch and resource optimization;
- complete auditability and compliance;
- AI-assisted decisions; and
- mobile-first field execution.

These are proposal goals, not current capability claims.

## 2. Proposed objectives and measurements

| Objective | Source target | Integration treatment |
| --- | --- | --- |
| Dispatch speed | Dispatch-to-departure under 8 minutes | Candidate KPI; define timestamps and baseline |
| Resource utilization | Greater than 85% | Candidate KPI; define eligible/available denominator |
| Conflict resolution | Under 2 minutes | Candidate KPI; define conflict start/end |
| Field productivity | Jobs per shift up 20% year over year | Needs operational baseline and quality guardrail |
| Auditability | 100% audit-trail completeness | Align with canonical critical-write audit rules |
| Fuel anomaly detection | Greater than 95% accuracy | Deferred research; define labels and false-positive cost |
| Adoption | 100% dispatchers and 90% field staff daily active in 30 days | Rollout hypothesis, not an accepted target |
| Completion efficiency | 25% reduction in average job duration in 90 days | Needs comparable job cohorts |
| Satisfaction | Operations-manager NPS above 50 | Candidate product metric |
| Reliability | 99.9% uptime and critical APIs below 500 ms | Conflicts with/extends accepted capstone baselines |

## 3. Proposed personas

| Persona | Source needs |
| --- | --- |
| System Administrator | Stable configuration, manageable permissions, audit visibility, integrations, and backups |
| Dispatcher | Rapid assignment, conflict avoidance, real-time location, and schedule integrity |
| Operations Manager | Utilization, cost, compliance, predictive insight, and reporting |
| Driver | Clear assignments, navigation, offline execution, and simple field reporting |
| Crane Operator | Requirement clarity, certification/equipment readiness, and operational logging |
| Field Technician | Complete briefs, checklists, evidence capture, and materials/incident reporting |

The roles align broadly with canonical CT2 personas. Specific navigation and
permissions remain server-authoritative.

## 4. Proposed functional inventory

The following identifiers are preserved as source references.

### Dashboard — `DASH-001` through `DASH-007`

- KPI cards, drill-down charts, live operational map, activity timeline, and
  emergency/approval alerts
- role-based dashboard customization and persistent dark mode
- proposed real-time refresh and export behavior

### Dispatch operations — `DISP-001` through `DISP-006`

- an eleven-column Kanban proposal with drag/drop, detail side panel, bulk
  actions, saved filters, and WebSocket updates
- cards showing priority, client, location, requested time, assignments,
  progress, and duration

The proposed stages were New Request, Pending Review, Approved, Scheduled,
Assigned, Dispatched, On Route, Arrived, Working, Completed, and Closed, with
Cancelled terminal from any stage. These labels must not be persisted without
mapping to the canonical Laravel dispatch enum.

### Schedule board — `SCHD-001` through `SCHD-008`

- daily, weekly, monthly, and timeline views
- drag/drop scheduling, conflict prevention, shift visualization, reservations,
  availability, and color-coded resource categories
- deferred AI scheduling recommendations

### Live operations center — `LOC-001` through `LOC-008`

- full-screen map, vehicle/crane/technician GPS, job markers, traffic,
  geofences, ETA, filters, and streamed updates
- proposed five-second position latency and two-hour trails

### Personnel and assignment — `PERS-001` through `PERS-005`

- three-panel assignment workspace
- qualification, licence, workload, availability, and shift context
- drag-to-assign, ranked recommendations, and hard qualification blocks

### Fleet — `FLEET-001` through `FLEET-005`

- fleet cards and grid/table/map views
- maintenance timeline, inspection evidence, and utilization/cost analytics

### Cranes — `CRANE-001` through `CRANE-003`

- capability/certification/inspection profiles
- utilization and inspection records with evidence and signatures

### Equipment — `EQUIP-001` through `EQUIP-005`

- categorized registry, QR codes, maintenance, inspections, and storage
  location

### Fuel — `FUEL-001` through `FUEL-004`

- submit/review/approve/issue/verify/log proposal workflow
- usage/cost analytics, fraud indicators, and approval queue

The source vocabulary must be mapped to the accepted fuel state machine before
reuse.

### Reports — `RPT-001` through `RPT-004`

- multi-dimensional filters
- heatmaps, tables, KPIs, line/bar/pie charts
- PDF/Excel/CSV exports and scheduled delivery

### Administration — `ADMIN-001` through `ADMIN-009`

- users, roles/permissions, departments, job types, notification templates,
  audit logs, system settings, integrations, and backup management

These are shared platform services in the accepted module model.

### Mobile companion — `MOB-001` through `MOB-012`

- today's assignments, navigation, start/pause/resume/complete, photos,
  signatures, offline work, GPS, voice notes, push, incidents, fuel, and
  inspections
- proposed 60-second background location interval

Canonical mobile commands, statuses, privacy, cadence, and offline rules take
precedence.

### AI features — `AI-001` through `AI-009`

- dispatch and schedule recommendations
- route optimization
- predictive maintenance
- fuel anomalies and operational risk
- duration prediction, reassignment suggestions, and weekly insight cards

The source UX rule says AI should appear as contextual cards rather than chat.
Accepted CT2 policy is stricter: GPT remains bounded, explainable, advisory,
expiring, human-reviewed, and unable to mutate operations directly.

## 5. Proposed non-functional requirements

### Performance and scale

- dashboard load under 2 seconds and subsequent navigation under 1 second;
- API p95 under 500 ms;
- GPS updates under 5 seconds and status updates under 2 seconds;
- more than 500 simultaneous dispatchers;
- horizontal API scaling, operational-data sharding, and CDN use.

These are unvalidated source targets. Adopt only through measured acceptance
criteria or an architecture decision.

### Security and privacy

- granular RBAC and SSO via SAML/OAuth/OIDC;
- encryption at rest and TLS 1.3 in transit;
- audit logging for modifications; and
- GDPR/CCPA compliance.

The intent is useful, but compliance and cryptographic claims require
provider-specific evidence, jurisdiction, ownership, and policy review.

### Reliability and data

- 99.9% uptime, failover, replication, point-in-time recovery, and offline-first
  mobile;
- seven-year active operations/media retention, ten-year audit retention,
  two-year GPS retention, and indefinite job archives.

The GPS proposal conflicts with the accepted 30-day precise-coordinate limit.
Other retention periods require the canonical policy owner and implementation
evidence.

### Accessibility and support

- WCAG 2.1 AA, keyboard access, screen-reader support, and color-safe palettes;
- latest desktop browsers, iOS 15+, Android 10+, and responsive widths from
  375–1920 px.

The current project uses the stricter WCAG 2.2 AA target and separately
recorded supported mobile versions.

## 6. Proposed data and integrations

The source identifies Jobs/Service Requests, Personnel, Vehicles, Cranes,
Equipment, Dispatches, and Fuel Requests as core entities. The conceptual
inventory is useful, but [Database](../../../database.md) and Laravel migrations
govern current entities and integrity.

Proposed integrations include:

- Geotab/Samsara telematics and Google Maps/HERE;
- SAP/Oracle/Dynamics ERP and Salesforce/HubSpot CRM;
- Workday/BambooHR HRIS;
- QuickBooks/Xero accounting;
- weather and traffic providers; and
- Twilio/SendGrid communications.

Each integration needs a business owner, data contract, authorization model,
privacy review, reliability behavior, cost, and rollout horizon.

## 7. Source exclusions

The proposal excludes a customer portal, billing/invoicing, broad warehouse
management, payroll, multilingual support, white-label/multi-tenant
customization, non-GPS IoT, and field video streaming from its V1.

These exclusions are useful planning evidence but do not independently alter
canonical non-goals.

## 8. Source risks

The source highlights remote GPS accuracy, battery drain, adoption resistance,
legacy ERP complexity, real-time scaling, and initially weak AI accuracy. Its
mitigations include offline/manual fallback, configurable location cadence,
training and phased rollout, middleware/manual import, event/caching options,
and human-in-the-loop AI.

These risks should be reused only after mapping to current owners and accepted
architecture.

## 9. Initial disposition

| Proposal family | Initial disposition |
| --- | --- |
| Personas and operational pain points | Accepted with changes |
| Feature/acceptance inventory | Crosswalk; duplicate, defer, or accept individually |
| KPI and scale targets | Needs evidence |
| Eleven-stage persisted workflow | Rejected unchanged; map to canonical states |
| Two-year GPS retention | Rejected |
| SSO and enterprise integrations | Deferred/needs evidence |
| Advanced AI/ML features | Deferred research |
| Contextual recommendation cards | Accepted with canonical GPT safeguards |
| Accessibility intent | Accepted with WCAG 2.2 AA normalization |

