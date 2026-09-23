# Core Transaction 2 — Operations Modular Monolith Architecture

**Last updated:** 2026-09-16  
**Status:** Implemented application boundary

The Core Transaction 2 Operations service (`apps/operations`) is structured as a pragmatic modular monolith with dedicated queue worker pools (`operational`, `ai`, `reports`). It coordinates with the extracted Tracking microservice (`apps/tracking/`) via HMAC-signed internal APIs.

## Code boundary (`apps/operations/`)

### 5 Main Operational Business Modules
| Path | Ownership & Purpose |
| --- | --- |
| `apps/operations/app/Modules/Dispatch` | Client intake, service requests, project planning (`Planning/`), dispatch jobs, approvals, activation, and field progression |
| `apps/operations/app/Modules/Assignment` | Resource eligibility, personnel/asset assignment, assignment response, reassignment, and integrated Hours of Service (`app/Modules/HoursOfService`) compliance |
| `apps/operations/app/Modules/Fleet` | Fleet-specific vehicle management, truck/trailer catalogs, roadworthiness, and integrated Driver Vehicle Inspection Reports (`app/Modules/Dvir`) |
| `apps/operations/app/Modules/CraneEquipment` | Crane/equipment specifications, certifications, load capacities, rigging gear inspections, and pre-use safety |
| `apps/operations/app/Modules/Fuel` | Fuel-request lifecycle, independent approval, and verified fuel logs |

### Tri-Modal Inbound Business Flow Adapters (Core 1 Ingestion)
| Path | Flow Adapter Scope |
| --- | --- |
| `apps/operations/app/Modules/Rental` | Rental reservation lifecycle, condition evidence diffs, and Rental-owned asset conflict checks |
| `apps/operations/app/Modules/Sales` | Catalog, quote, order, inventory reservation, ownership lifecycle, and Sales-owned asset conflict checks |

### Shared Platforms & Kernels
| Path | Platform Scope |
| --- | --- |
| `apps/operations/app/Shared/Assets` | Shared asset registry kernel, inspections, and maintenance persistence |
| `apps/operations/app/Platform/Safety` | Statutory safety governance (DOLE OSHS Rule 1410 & DO 198-18): Toolbox Meetings (TBM), Critical Lift Plans, Work Stoppage Orders (WSO), Safety Hazards |
| `apps/operations/app/Platform/Sos` | SOS emergency response system: floating distress jewel, cradle notch, Reverb WebSocket broadcast, responder escalation and resolution |
| `apps/operations/app/Platform` | Identity, audit, attachments, notifications, reporting, tracking client, GPT, idempotency, and workspace composition |

Fleet and Crane/Equipment intentionally share the asset kernel while their
records use the common `operational_assets` table. New fleet- or equipment-
specific behavior belongs to its business module; only genuinely generic asset
behavior belongs in `Shared/Assets`. Rental and Sales serve as specialized operational
flow adapters that bridge Core 1 commercial pipelines into the 5 main operational modules.

## Rules

1. A module owns its actions, policies, models, requests, resources, and route files.
2. Cross-module calls use public contracts, DTOs, model IDs, or events; modules do not call another module's controller. Rental and Sales do not import or query each other's internals.
3. Existing cross-module Eloquent relationships remain valid during the transition, but new business behavior should not reach into another module's internals.
4. Actions remain transaction boundaries. Events and queued jobs are reserved for after-commit side effects.
5. `Platform` is limited to cross-cutting capabilities and must not become a catch-all business module.
6. Polymorphic database values retain their historical type names through a morph map so existing records remain readable after namespace moves.
7. `Shared/Assets` exposes the typed `AssetUsageConflictChecker` contract,
   request/source/conflict DTOs, and `OperationalAssetAvailability`. Rental,
   Sales, and Assignment register their own tagged checkers; Shared combines
   safe results and locks affected asset rows in ascending ID order but does not
   import product-module models.
8. External Tracking integration routes through `Platform/Tracking/` using `TrackingClientInterface` (`HttpTrackingClient` for remote microservice, `FakeTrackingClient` for tests).

## Framework composition

`app/Http/Controllers/Controller.php` remains the only root HTTP class: it is
Laravel's base controller. Identity middleware belongs in
`Platform/Identity/Http/Middleware`; Inertia workspace middleware belongs in
`Platform/Workspace/Http/Middleware`; shared transport exceptions belong in
`Shared/Http/Exceptions`. Console commands are registered by their owning
provider, such as `Platform/Tracking/TrackingServiceProvider`, rather than
being discovered from a global console folder. Events, commands, jobs, and
exceptions introduced in the future must be owned by their relevant module or
platform capability.

## Routing and frontend

Root route files compose module-owned route files. URLs, names, middleware, and
controller behavior are preserved. Assignment owns the nested dispatch-resource
commands while retaining their existing dispatch-job URLs. Fleet and
Crane/Equipment own filtered asset catalogs at `/operations/fleet/assets`,
`/operations/equipment/assets`, `/api/v1/fleet/assets`, and
`/api/v1/equipment/assets`; generic registration, inspection, maintenance, and
status commands remain in `Shared/Assets` while the single asset table is
shared. Rental and Sales are intentionally session-authenticated JSON-only
transitional backend/API slices; they are not routed UI or Core 1 receiving
endpoints. React/Inertia code is deliberately not required to mirror backend
modules; frontend features remain organized by user workflow and screen
ownership.

## Enforcement

`apps/operations/tests/Unit/ModuleArchitectureTest.php` prevents new dependencies on the
retired type-first application namespaces. Run `composer ci:check` before
merging boundary changes.
