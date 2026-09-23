# Dispatch intake source graph

This graph defines the decision path behind the single Core 2 **New dispatch** entry. Core 1 identifies the source; Core 2 routes the handoff into the correct workflow. Manual/direct dispatch remains an explicit fallback.

```mermaid
flowchart TD
    NEW["New dispatch"] --> INBOX{"Incoming work or direct fallback"}
    INBOX -->|Core 1 handoff| ROUTE{"Read source type"}
    INBOX -->|No upstream handoff| MANUAL["Direct operational dispatch"]

    ROUTE --> SERVICE["Service request"]
    ROUTE --> RENTAL["Rental delivery"]
    ROUTE --> SALES["Sales delivery"]

    MANUAL --> M1["Gate M1: required operational draft fields"]
    SERVICE --> S1["Gate S1: active request and source-owned fields"]
    RENTAL --> R1["Gate R1: reserved handoff and no dispatch link"]
    SALES --> A1["Gate A1: confirmed delivery and no dispatch link"]

    M1 --> G2["Gate 2: duplicate and idempotency check"]
    S1 --> G2
    R1 --> G2
    A1 --> G2

    G2 --> G3["Gate 3: schedule and collision review"]
    G3 --> G4["Gate 4: readiness and safety prerequisites"]
    G4 --> DRAFT["Create or convert linked draft"]
    DRAFT --> AUDIT["Gate 5: provenance, source link, and audit event"]
    AUDIT --> NEXT["Assignment, activation, and closeout gates"]

    REVIEW["Review unmatched handoffs"] --> MATCH{"Existing manual draft match?"}
    MATCH -->|yes| CONFIRM["Gate R1: human review before linking or converting"]
    MATCH -->|no| ROUTE
    CONFIRM --> G2
```

## Gate contract

| Gate | Applies to | User-facing rule | Enforcement boundary |
| --- | --- | --- | --- |
| 0. Authorization | Every branch | Only users with the dispatch creation capability can see or submit New dispatch. | Capability view model, route middleware, policies |
| 1. Source eligibility | Every branch | The source must be in the allowed lifecycle state and visible to the current user. | Server-side request validation and source-specific action |
| 2. Duplicate/idempotency | Service, rental, sales, reconciliation | Do not create a second operational execution for an already-linked source. | Source link checks and idempotent command/action |
| 3. Schedule/collision | Every dispatch that has a window | A draft can be created, but scheduling or activation must surface temporal and resource conflicts. | Dispatch command layer and conflict review |
| 4. Readiness/safety | Every dispatch before activation | Required technical, site, and safety prerequisites must be explicit before work becomes executable. | Readiness rules, checklist, and activation transition |
| 5. Provenance/audit | Every successful branch | Preserve whether the dispatch is manual, service, rental, or sales-originated, plus the source identifier. | Transactional write and audit event |
| 6. Assignment/closeout | Downstream lifecycle | Assignment, field milestones, condition changes, and closeout remain separate authorized transitions. | Existing dispatch workflow and audit trail |

## Branch semantics

- **Direct operational dispatch** creates a direct Core 2 operational draft. It carries `manual_intake` provenance and does not create a commercial transaction.
- **Service request** preserves the service request link. One request may produce multiple linked draft dispatches when the work is staged or multi-phase.
- **Rental delivery** converts only an eligible reserved rental handoff and keeps the reservation as the source record.
- **Sales delivery** converts only an eligible confirmed sales handoff and keeps the sales order as the source record.
- **Review unmatched handoffs** is a review queue, not a source choice. A suggested manual-draft match is advisory until a human confirms the link or conversion.

The UI may hide unavailable incoming work, but it must never infer authorization from the presence of a card. Every conversion remains server-authoritative and must fail safely when the source becomes stale between render and submit. Automatic routing creates or opens a draft workflow; it never assigns resources or activates work without the downstream gates.
