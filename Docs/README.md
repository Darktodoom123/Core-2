# Core Transaction 2 Documentation

The accepted business boundary is defined in [Top-level modules](./modules.md).

`Docs/` is the single source of truth for product documentation.

## Status reference

Current implementation status is maintained in the [feature catalog](./features.md)
and [roadmap](./Roadmap.md). The current native acceptance evidence and blockers
are recorded in the [Session 1 readiness status](./session-1-readiness-status.md)
and [Sprint 2 readiness status](./sprint-2-readiness-status.md); this index
intentionally avoids repeating that detail.

## Consolidated deliverables

The [consolidated download package](./consolidated/README.md) reorganizes the
canonical documentation into five standalone deliverables:

1. Product Requirements Document
2. User Story Map
3. Sprint Plan
4. Technical Architecture
5. Design System Specification

These files are maintained summaries for review, submission, and download.
The detailed documents indexed below remain authoritative when a summary omits
detail.

## Document index

- [Top-level modules](./modules.md) - accepted five-module business boundary and ownership rules
- [Modular monolith implementation](./modular-monolith.md) - physical code boundary, dependency rules, and migration compatibility

- [Product requirements](./prd.md) — product purpose, users, goals, scope, and success criteria
- [Long-term product plan](./long-term-plan.md) — strategic vision, mandatory capstone outcomes, and post-MVP expansion
- [Requirements catalog](./requirements.md) — functional and non-functional requirements with maturity status
- [Feature catalog](./features.md) — live backend/UI, partial, prototype, and planned capabilities
- [Sprint 2 readiness status](./sprint-2-readiness-status.md) — durable mobile outbox implementation and Android acceptance evidence
- [User flows](./userflow.md) — primary role and operational journeys
- [Business rules](./business_rules.md) — authorization, safety, workflow, and integrity invariants
- [Database](./database.md) — persistence model, relationships, integrity, and security boundary
- [HTTP API](./API.md) — current session-authenticated routes and contracts
- [Architecture](./Architecture.md) — current system structure, decisions, risks, and recommended evolution
- [Docker operations](./docker.md) — Compose setup, required environment values, runtime commands, persistence, and troubleshooting
- [Product design](./Design.md) — experience principles, visual foundations, layout, states, and accessibility
- [Roadmap](./Roadmap.md) — phased delivery outcomes, exit gates, and risks
- [Phase 0 baseline decisions](./phase-0-baseline.md) — accepted frontend, brand, HTTP, topology, delivery, reliability, retention, attachment, and GPT limits

## Supporting artifacts

- [`Diagrams/README.md`](./Diagrams/README.md) — authority and maintenance rules for visual references
- [`Diagrams/operations-erd.prisma`](./Diagrams/operations-erd.prisma) — conceptual, non-executable database ERD
- [`Diagrams/system-overview.excalidraw`](./Diagrams/system-overview.excalidraw) — web, mobile, Laravel, persistence, and dispatch overview
- [Supplemental source library](./consolidated/supplements/README.md) —
  non-canonical proposal material, source crosswalks, and recommendation
  dispositions
- [BSIT Capstone System Requirements Questionnaire](./consolidated/supplements/capstone-requirements-questionnaire.md) —
  empirical field survey and requirements baseline from operational personnel at Bestlink College of the Philippines
- [CT2 supplemental-source integration plan](./plans/CT2_SUPPLEMENTAL_SOURCE_INTEGRATION_PLAN.md)
  — governance, conflict handling, promotion rules, and validation for the
  supplemental proposal set
- [`plans/CAPSTONE_COMPLETION_PLAN.md`](./plans/CAPSTONE_COMPLETION_PLAN.md) — active execution plan for the remaining native, routed-workflow, resilience, and production-readiness gates
- [`plans/PHASE_2_DISPATCH_LIFECYCLE_PLAN.md`](./plans/PHASE_2_DISPATCH_LIFECYCLE_PLAN.md) — historical Phase 2 dispatch-lifecycle session plan
- [`plans/RBAC_IMPLEMENTATION_PLAN.md`](./plans/RBAC_IMPLEMENTATION_PLAN.md) — historical authorization implementation plan
- [`plans/SUPABASE_ERD_ALIGNMENT_PLAN.md`](./plans/SUPABASE_ERD_ALIGNMENT_PLAN.md) — historical schema-alignment plan

## Authority and maintenance

- These documents define product intent, requirements, design, and planned evolution.
- Laravel migrations and application code are authoritative for behavior currently implemented in the repository.
- Mark capabilities as live backend/UI, partial, prototype, or planned; do not present prototype behavior as production functionality.
- Update affected documents in the same change as product, workflow, schema, API, architecture, or design decisions.
- Historical plans are superseded snapshots retained for decision context; the main documents above represent the current accepted direction.
- When a main document summarizes a Phase 0 value, [phase-0-baseline.md](./phase-0-baseline.md) is the canonical detailed decision record.
