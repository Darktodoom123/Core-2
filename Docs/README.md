# Core-2 Documentation

Last reviewed: 2026-09-16.

Core-2 is organized as an isolated two-service monorepo:
- `apps/operations/`: Operations Monolith & BFF (Laravel 13, Inertia 3, React 19, Vite 8, Tailwind CSS v4, Pest 4) with dedicated queue workers (`operational`, `ai`, `reports`, `emergency`).
- `apps/tracking/`: Standalone Tracking microservice with dedicated database (`core2_ms_tracking`) and HMAC-signed telemetry REST API.
- `packages/field-mobile/`: Native Expo React Native field mobile client (Expo 57, React Native 0.86, Expo SQLite offline outbox, Detox E2E).
- `infra/docker/`: Container definitions, multi-stage Dockerfiles, Nginx configs, and Supervisor process topologies.

---

## 🗂️ Documentation Landscape & Git Tracking Policy

Per the repository's `.gitignore` policy:
- **Tracked in Git**: `Docs/README.md`, `Docs/references/alibaton-website.md`, `Docs/microservice/**`, `Docs/architecture/docker.md`, and `Docs/architecture/deployment.md`.
- **Workspace-Local Documentation**: `Docs/product/`, `Docs/architecture/` (remaining files), `Docs/prds/`, `Docs/design/`, `Docs/plans/`, `Docs/runbooks/`, and `Docs/archive/` exist locally in the development workspace.

Implementation, manifests, lockfiles, migrations, and passing tests show actual behavior; product documents show intended behavior. Surface material contradictions rather than inventing requirements.

---

## 🧭 Navigation Index

### 1. Architecture & Technical Specifications (`Docs/architecture/`)

Technical specifications describing backend patterns, database models, API contracts, real-time infrastructure, and containerization:

| Document | Purpose & Scope |
| :--- | :--- |
| [Architecture.md](architecture/Architecture.md) | High-level system architecture, 5 operational modules, 3 canonical roles, tri-modal business flows, and platform services. |
| [modular-monolith.md](architecture/modular-monolith.md) | Architectural rules and boundaries for the Operations Monolith (`apps/operations`). |
| [modules.md](architecture/modules.md) | Comprehensive module catalog: controllers, actions, commands, services, and models across the 5 operational modules. |
| [database.md](architecture/database.md) | Relational database schema, table relationships, Supavisor connection pooling, and multi-database isolation. |
| [API.md](architecture/API.md) | Complete REST API reference (v1 and v2) covering endpoints, parameters, error contracts, and responses. |
| [realtime-workspace-architecture.md](architecture/realtime-workspace-architecture.md) | WebSocket integration with Laravel Reverb and Laravel Echo for real-time workspace updates. |
| [authentication-and-recovery.md](architecture/authentication-and-recovery.md) | Authentication architecture, username-first normalization, Sanctum tokens, and password recovery. |
| [docker.md](architecture/docker.md) | **(Tracked in Git)** Production Docker Compose stack, worker topologies, volume persistence, and troubleshooting. |
| [deployment.md](architecture/deployment.md) | **(Tracked in Git)** HostForge Platform deployment architecture, domain mapping (`core-2.alibaton-ph.com`), and runtime environment. |
| [hr-workforce-integration.md](architecture/hr-workforce-integration.md) | Boundary between enterprise Core HR / Workforce Management and Core-2 Operations. |
| [ADR-DISPATCH-BACKEND-V2-DOMAIN-CONTRACT.md](architecture/ADR-DISPATCH-BACKEND-V2-DOMAIN-CONTRACT.md) | Architectural Decision Record for Dispatch V2 domain commands, idempotency keys, and audit lineages. |

### 2. Product Requirements & Business Rules (`Docs/product/`)

Authoritative product specifications defining commercial boundaries, business rules, and user experiences:

| Document | Purpose & Scope |
| :--- | :--- |
| [prd.md](product/prd.md) | Master Product Requirements Document for Core Transaction 2. |
| [alibaton-business-scope.md](product/alibaton-business-scope.md) | Alibaton commercial business scope, heavy lifting context, and Core 1 vs. Core 2 boundaries. |
| [business_rules.md](product/business_rules.md) | Statutory DOLE 10h fatigue rules, DVIR safety lockouts, monotonic fuel meters, and demurrage billing. |
| [features.md](product/features.md) | Functional feature breakdown across all 5 operational modules. |
| [requirements.md](product/requirements.md) | Detailed functional and non-functional requirements. |
| [dispatch-workspace.md](product/dispatch-workspace.md) | Live web dispatch operations workspace specification and user flows. |
| [dispatch-project-planning.md](product/dispatch-project-planning.md) | Multi-phase long-term project planning, phase allocations, and shift rostering. |
| [core-hr-workforce-boundary.md](product/core-hr-workforce-boundary.md) | Upstream HR employee master vs. Core-2 operational personnel profiles and credentials. |
| [userflow.md](product/userflow.md) | End-to-end user journey flows across System Administrator, Operations Manager, and Operator roles. |

### 3. Native Field Mobile Client (`Docs/prds/`)

Specifications and testing guides for the React Native / Expo field client (`packages/field-mobile`):

| Document | Purpose & Scope |
| :--- | :--- |
| [mobile-lifecycle.md](prds/mobile-prd/mobile-lifecycle.md) | Field asset tracking, HoS duty progression, offline SQLite outbox, and DVIR inspection workflows. |
| [AGENT-ORCHESTRATION-AND-E2E-GUIDE.md](prds/mobile-prd/AGENT-ORCHESTRATION-AND-E2E-GUIDE.md) | 8-phase master lifecycle matrix, edge cases, and Detox/Maestro E2E testing guide. |

### 4. UI/UX Design & System Tokens (`Docs/design/`)

Design system tokens, color palettes, typography, and visual diagrams:

| Document | Purpose & Scope |
| :--- | :--- |
| [Design.md](design/Design.md) | Visual identity, gold palette tokens, Instrument Sans typography, and Tactical HUD dark mode tokens. |
| [Diagrams/README.md](design/Diagrams/README.md) | Index of system diagrams including BPA, DFD, ERD, and module boundary diagrams. |

### 5. Microservice Architecture & Implementation (`Docs/microservice/`)

**(Tracked in Git)** Specifications, invariants, and implementation records for the 2-service monorepo restructuring:

| Document | Purpose & Scope |
| :--- | :--- |
| [README.md](microservice/README.md) | Implementation handoff guide and status for Plan A (2-Service Model: Operations + Tracking). |
| [architecture.md](microservice/architecture.md) | 2-Service target architecture, data ownership, worker isolation rationale, and invariants. |
| [progress.md](microservice/progress.md) | Comprehensive implementation and verification log (Phases 0 through 7 verified). |
| `phase-00-baseline.md` to `phase-08-deployment.md` | Detailed phase briefs for extraction, isolation, and deployment. |

### 6. Operational Runbooks (`Docs/runbooks/`)

Procedures for emergency response and operational governance:

| Document | Purpose & Scope |
| :--- | :--- |
| [field-emergency-sos.md](runbooks/field-emergency-sos.md) | Field Emergency SOS responder workflows, 180s escalation timer, and enablement checklist. |

### 7. External References (`Docs/references/`)

**(Tracked in Git)** Research into external systems and company resources:

| Document | Purpose & Scope |
| :--- | :--- |
| [alibaton-website.md](references/alibaton-website.md) | Alibaton Construction Inc. corporate website reference, crane categories, model specs, and brand identity. |

### 8. Plans & Roadmaps (`Docs/plans/`)

Strategic planning documents, feature roadmaps, and UX plans:

| Document | Status | Scope |
| :--- | :--- | :--- |
| [Roadmap.md](plans/Roadmap.md) | Active | Feature delivery sequence and outcome gates. |
| [fleet-fuel-reports-ux-plan.md](plans/fleet-fuel-reports-ux-plan.md) | Active | Web UX plan for Fleet, Fuel, and Job Reports parity. |
| [employee-asset-picker-design.md](plans/employee-asset-picker-design.md) | Active | Dispatch resource assignment picker design. |
| [resource-picker-refinement.md](plans/resource-picker-refinement.md) | Active | Candidate filtering and conflict detection UX. |
| [field-execution-view.md](plans/field-execution-view.md) | Active | Field execution view model and telemetry indicators. |
| [microservices-migration.md](plans/microservices-migration.md) | **Superseded** | Earlier 4-service proposal (2026-09-08); superseded by Plan A in `Docs/microservice/`. |

### 9. Historical Archives (`Docs/archive/`)

Historical context and early sprint audits. **These documents represent historical records and must not be used as current implementation specifications**:
- `Docs/archive/CAPSTONE_COMPLETION_PLAN.md`: Early milestone completion plan.
- `Docs/archive/consolidated/`: Initial project requirements, user story maps, and draft sprint plans.
- `Docs/archive/reports/`: Historical sprint execution audits (Sprints 4, 5, 6, 7).
- `Docs/archive/phase-0-baseline.md`: Initial phase 0 environment baseline.
