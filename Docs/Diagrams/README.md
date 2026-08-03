# Core Transaction 2 — Visual References

**Last updated:** 2026-07-31

The files in this directory are visual aids for understanding Core Transaction
2. They summarize accepted documentation and implemented concepts, but they do
not independently define product behavior, architecture, or database structure.

## System overview

[system-overview.excalidraw](./system-overview.excalidraw) illustrates:

- Office users working through the Inertia 3 and React 19 web application
- Field users working through the mandatory, planned React Native application
- Session-authenticated web requests and the planned versioned mobile JSON API
- Shared Laravel 13 validation, authorization, domain actions, transactions,
  state transitions, and audit recording
- PostgreSQL persistence and the main dispatch lifecycle
- Human-controlled GPT recommendations
- The routed browser tracking slice now also has an OpenStreetMap map/list and
  location outbox; these are implemented web details, not a change to the
  planned mobile boundary.

The authoritative system description is
[Architecture.md](../Architecture.md). Product behavior is governed by
[prd.md](../prd.md) and [business_rules.md](../business_rules.md). The accepted
five-module product boundary is defined in [modules.md](../modules.md).

## Module and UI/UX map

[module-boundary.md](./module-boundary.md) visualizes the accepted five-module
business boundary, each module's submodules, shared platform services,
role-based web and field surfaces, and the dispatch-to-field operational flow.
It is the preferred visual reference when planning UI/UX information
architecture. It does not replace the authoritative module, feature, or
architecture documents.

## Operations ERD

[operations-erd.prisma](./operations-erd.prisma) illustrates the conceptual
operational entities and their relationships. The `.prisma` extension supports
the visual ERD editor; this file is not an executable application schema and
must not be used to generate migrations.

## Data Flow Diagram (DFD)

[dfd.md](./dfd.md) visualizes the Level 0 (Context Diagram), Level 1 (Decomposed Modular DFD), and Level 2 (Detailed Workflow DFDs) data flow diagrams, external entities, system processes, data stores, and transactional boundaries.

## Business Process Architecture (BPA)

[bpa.md](./bpa.md) defines the Level 0 enterprise value streams, Level 1 business process taxonomy, Level 2 cross-functional swimlane workflows, and the organizational RACI matrix.

Laravel migration files are authoritative for the implemented schema.
[database.md](../database.md) explains the accepted persistence model,
relationships, integrity constraints, security boundary, and implementation
maturity.

## Authority order

1. Laravel migrations and application code define implemented behavior.
2. Product, business-rule, database, and architecture documents define accepted
   intent and design.
3. Files in this directory visualize those sources for communication.

When a visual reference differs from an authoritative source, update the visual
reference; do not infer a product or schema change from the drawing alone.
