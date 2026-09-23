# Core Transaction 2 — Visual References

**Last updated:** 2026-08-13

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
- The routed browser tracking slice now also has a MapLibre map/list and
  location outbox; these are implemented web details, not a change to the
  planned mobile boundary.

## Operational & Chat Visual Diagrams

- [chat-system-diagram.excalidraw](./chat-system-diagram.excalidraw) — Visual architecture and sequence diagram for realtime chat/communication flow, WebSocket event dispatching, and core system message orchestration.
- [core2-user-flow.excalidraw](./core2-user-flow.excalidraw) — Interactive visual diagram of end-to-end office operations, field mobile, and managerial user flows.

The authoritative system description is
[Architecture.md](../../architecture/Architecture.md). Product behavior is governed by
[prd.md](../../product/prd.md) and [business_rules.md](../../product/business_rules.md). The
5 core operational modules and tri-modal business flows are defined in [modules.md](../../architecture/modules.md).

## Module and UI/UX map

[module-boundary.md](./module-boundary.md) visualizes the 5 core operational modules,
their submodules, the 3 tri-modal business transaction flows (Service, Rental, Sale),
shared platform services, role-based web and field surfaces, and the
dispatch-to-field operational flow. It is the
preferred visual reference when planning UI/UX information architecture. It
does not replace the authoritative module, feature, or architecture documents.

## Operations ERD & Schema Diagrams

- [core2-erd-simple.md](./core2-erd-simple.md) — Simplified two-service ERD on one A3 landscape page: five Operations modules, shared AI records, and the separate Tracking database. Includes 14 distinct tables, short labels, FK versus application-reference notation, PDF, images, and an editable copy.
- [capstone-erd.md](./capstone-erd.md) — Current five-module ERD and companion schema notes, checked against repository migrations on 2026-09-17. Includes keys, optional relationships, project planning, Dispatch V2, rental/sales records, and the separate Tracking database.
- [capstone-erd-clear.svg](./capstone-erd-clear.svg) — Printable vector view of the 21-table core operational ERD.
- [core2-erd.pdf](../../../output/pdf/core2-erd.pdf) — A2 landscape print edition.
- [capstone-erd.drawio](./capstone-erd.drawio) — Editable diagrams.net source with table shapes and relationship connectors.
- [capstone-erd.schema.json](./capstone-erd.schema.json) — Selected fields, FK targets, cardinalities, and migration evidence for the main diagram.
- [core2-schema.prisma](./core2-schema.prisma) — Earlier operational and platform schema reference for Nimbalyst / visual ERD viewers. It has not been synchronized with the September ERD revision.
- [operations-erd.prisma](./operations-erd.prisma) — Earlier conceptual operational ERD. The `.prisma` extension supports the visual ERD editor; these files are visual schema models and are not used to generate executable migrations.

## Data Flow Diagram (DFD)

[dfd.md](./dfd.md) visualizes external Core 1 as the source of service, rental,
and sale handoffs into Core 2, plus the Level 0 context, Level 1 modular flow,
Level 2 detailed workflows, data stores, and transactional boundaries. Core 1
is context only and is not built by this repository.

## Business Process Architecture (BPA)

[bpa.md](./bpa.md) defines the Level 0 enterprise value streams, Level 1 business process taxonomy, Level 2 cross-functional swimlane workflows, and the organizational RACI matrix.

Laravel migration files are authoritative for the implemented schema.
[database.md](../../architecture/database.md) explains the accepted persistence model,
relationships, integrity constraints, security boundary, and implementation
maturity.

## Authority order

1. Laravel migrations and application code define implemented behavior.
2. Product, business-rule, database, and architecture documents define accepted
   intent and design.
3. Files in this directory visualize those sources for communication.

When a visual reference differs from an authoritative source, update the visual
reference; do not infer a product or schema change from the drawing alone.
