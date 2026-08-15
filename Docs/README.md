# Core-2 Documentation Index

Welcome to the documentation repository for Core Transaction 2. Documentation is organized into clear domain areas below.

---

## 📦 Product & Business Specifications (`Docs/product/`)
- [Alibaton Business Scope](product/alibaton-business-scope.md) — Alibaton heavy equipment rental, sales, and service domain boundaries.
- [Business Rules](product/business_rules.md) — Domain business rules, validation criteria, and approval constraints.
- [Feature Catalog](product/features.md) — Comprehensive functional catalog across Dispatch Intake, Scheduling, Approvals, Tracking, Shared Surfaces, and Native Field Mobile.
- [Product Requirements (PRD)](product/prd.md) — Product goals, target user personas, system workflows, and operational requirements.
- [Requirements Catalog](product/requirements.md) — Detailed functional and non-functional requirements.
- [Userflows](product/userflow.md) — Step-by-step user journeys and operation state transitions.

---

## 🏛️ System Architecture & Engineering (`Docs/architecture/`)
- [Overall Architecture](architecture/Architecture.md) — System components, tech stack boundaries, and integration principles.
- [HTTP API Specification](architecture/API.md) — Endpoint contracts, payload schemas, and authentication models.
- [Database Schema & Models](architecture/database.md) — Eloquent models, migration standards, table relations, and indexing.
- [Domain Contract ADR](architecture/ADR-DISPATCH-BACKEND-V2-DOMAIN-CONTRACT.md) — Backend V2 state machines, capabilities, readiness, approval, attempt, and archive semantics.
- [Modular Monolith Architecture](architecture/modular-monolith.md) — Domain boundaries and module encapsulation principles.
- [Top-Level Modules](architecture/modules.md) — Backend domain modules, Web React/Inertia architecture, and React Native field mobile structure.
- [Realtime Workspace Architecture](architecture/realtime-workspace-architecture.md) — WebSocket (Reverb) event channels and dynamic state distribution.
- [Tri-Modal Orchestration & Mobile Architecture](architecture/tri-modal-orchestration-and-mobile-architecture.md) — Graph engineering, verification gauntlet, and multi-stream service/rental/sales operational lifecycle alignment.
- [Docker Operations Guide](architecture/docker.md) — Container setup, runtime commands, persistence, and local environment setup.

---

## 🎨 UI/UX & Visual Design (`Docs/design/`)
- [Design System & UI Guidelines](design/Design.md) — Visual tokens, component standards, and design system rules.
- [Design Concepts](design/design-concepts/) — Extended design specifications and interface mockups.
- [Diagrams](design/Diagrams/) — Operational ERDs, data flow diagrams (DFD), and system visual references.

---

## 🗓️ Plans & Roadmaps (`Docs/plans/`)
- [Project Roadmap](plans/Roadmap.md) — High-level milestone tracking and delivery phases.
- [Long-Term Plan](plans/long-term-plan.md) — Multi-stage roadmap and feature expansion vision.
- [Capstone Completion Plan](plans/CAPSTONE_COMPLETION_PLAN.md) — Comprehensive capstone execution matrix.
- [Dispatch Backend V2 Execution Plan](plans/DISPATCH_BACKEND_V2_EXECUTION_PLAN.md) — Dependency-gated execution phases 0–6.
- [Dispatch Backend V2 Phase Handoff](plans/DISPATCH_BACKEND_V2_PHASE_HANDOFF.md) — Phase verification gates and execution state.

---

## 📁 Archive & Historical Snapshots (`Docs/archive/`)
Historical sprint plans, point-in-time readiness reports, legacy phase specifications, and execution audits are preserved for context:
- [Phase 0 Baseline Decisions](archive/phase-0-baseline.md)
- [Session 1 Readiness Status](archive/session-1-readiness-status.md)
- [Sprint 2 Readiness Status](archive/sprint-2-readiness-status.md)
- [Username Login Migration](archive/username-login-migration.md)
- [Consolidated Initial Specifications](archive/consolidated/)
- [Core 1 Integration History](archive/core1/)
- [Sprint Audit Reports](archive/reports/)

---

## 🛡️ AI Quality Verification & UI Execution Reports
- [AI Quality Verification Answers](../.ai-reports/ai-verification-questions.md) — Responses to the 4 mandatory AI verification questions across execution phases.
- [Final UI Execution Report](../.ai-reports/ui-execution/FINAL-EXECUTION-REPORT.md) — UI execution history, test matrices, and release readiness.
