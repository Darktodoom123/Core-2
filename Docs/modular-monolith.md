# Core Transaction 2 — Modular Monolith Implementation

**Last updated:** 2026-08-01  
**Status:** Implemented application boundary

Core Transaction 2 is a single Laravel deployment and relational database
organized into explicit business modules. This is not a package-based modular
framework or a microservice architecture.

## Code boundary

| Path | Ownership |
| --- | --- |
| `app/Modules/Dispatch` | Client intake, service requests, dispatch jobs, approvals, activation, and field progression |
| `app/Modules/Assignment` | Resource eligibility, personnel/asset assignment, assignment response, and reassignment |
| `app/Modules/Fleet` | Fleet-specific capability evolution |
| `app/Modules/CraneEquipment` | Crane and equipment-specific capability evolution |
| `app/Modules/Fuel` | Fuel-request lifecycle and fuel logs |
| `app/Shared/Assets` | Temporary shared asset registry, inspections, and maintenance persistence |
| `app/Platform` | Identity, audit, attachments, notifications, reporting, tracking, GPT, idempotency, and workspace composition |

Fleet and Crane/Equipment intentionally share the asset kernel while their
records use the common `operational_assets` table. New fleet- or equipment-
specific behavior belongs to its business module; only genuinely generic asset
behavior belongs in `Shared/Assets`.

## Rules

1. A module owns its actions, policies, models, requests, resources, and route files.
2. Cross-module calls use public contracts, DTOs, model IDs, or events; modules do not call another module's controller.
3. Existing cross-module Eloquent relationships remain valid during the transition, but new business behavior should not reach into another module's internals.
4. Actions remain transaction boundaries. Events and queued jobs are reserved for after-commit side effects.
5. `Platform` is limited to cross-cutting capabilities and must not become a catch-all business module.
6. Polymorphic database values retain their historical type names through a morph map so existing records remain readable after namespace moves.

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
shared. React/Inertia code is deliberately not required to mirror backend
modules; frontend features remain organized by user workflow and screen
ownership.

## Enforcement

`tests/Unit/ModuleArchitectureTest.php` prevents new dependencies on the
retired type-first application namespaces. Run `composer ci:check` before
merging boundary changes.
