# Dispatch resource coverage and picker audit plan

Last reviewed: 2026-09-27. Status: Implemented and verified with seeded data.

## Objective and current evidence

Dispatch must show assignable records from the Fleet, Equipment, and Personnel catalogs with accurate eligibility, usable resource details, and truthful pagination. The prior audit found three gaps:

1. Fleet `vehicle` and Equipment `tower_crane` are valid `OperationalAsset.kind` values in their catalogs, but dispatch candidate and assignment request types omit them.
2. The picker exposes Drivers, but the candidate query filters for a nonexistent `driver` role. The assignment service already maps `driver` to the `crane_operator` operational role and requires a valid `driver_license` at the job start.
3. Both candidate queries paginate all records before applying `eligible_only`, so an empty page can hide eligible resources on later pages and display incorrect totals.

Existing local changes already show asset subtype/capacity and restore the saved asset's specifications. Preserve them and all unrelated working-tree changes.

## Implementation sequence

### 1. Align asset kinds from catalog to assignment

- Define one shared list of supported dispatch asset kinds: `truck`, `vehicle`, `crane`, `mobile_crane`, `tower_crane`, `equipment`. Use it in candidate validation and assign/reassign request validation.
- Keep exact kind matching in `DispatchResourceEligibility`, with the existing `crane` → `mobile_crane` compatibility exception. Add visible labels for Vehicle and Tower Crane.
- Add the two kinds to asset candidate types, picker filters, and TypeScript contracts. Route Vehicle to Fleet and Tower Crane to Equipment catalog links. Preserve readiness, maintenance, inspection, rental, and schedule checks.
- Test candidate discovery, valid assignment/reassignment, and rejection of a mismatched kind or unavailable asset.

### 2. Make the driver assignment path explicit

- Treat Driver as an assignment type for an active `crane_operator` account with a valid driver licence. When the dispatcher chooses Drivers, query crane operators and evaluate each as `driver`, including licence expiry and schedule conflicts.
- In the default All view, clearly tell dispatchers that driver eligibility is evaluated with the Drivers filter. Avoid displaying an empty Driver group as though no staff exist. Keep one selected assignment type per user and do not duplicate a person in the default candidate list.
- Use the candidate's returned assignment type in the existing save and replacement paths. Verify that a valid driver can be selected and an expired or missing licence is visibly blocked and rejected server-side.

### 3. Make eligible-only pagination truthful

- Keep the current bounded, batched page query for the default all-candidates view.
- For `eligible_only=true`, evaluate the filtered candidate pool in chunks with the same server-side eligibility logic as assignment. Only then paginate eligible rows, with accurate total and page count. Do not allow page boundaries to hide eligible records.
- Preserve stable ordering by name/code and ID, current job version, schedule fingerprint, and evaluation time in the response. Test mixed eligible/blocked resources across page boundaries, search and type filters, empty results, and page 2. Check query growth on a representative pool.

### 4. Re-audit the dispatcher journey and UI

- Exercise: open a draft dispatch → open Assign resources → switch Employees/Assets → filter Drivers, Vehicles, and Tower Cranes → search → toggle Eligible only → page through results → inspect status, capacity/credential/conflict details → stage a choice → save → inspect the assigned row → replace a resource.
- Review the UI with `ui-ux-auditor`: discoverability of filters, honest result counts and freshness, blocked reasons, empty/loading/error states, keyboard labels and focus, mobile width, and visual consistency with existing tokens.
- Run focused PHP and React tests, TypeScript, PHPStan, lint/format checks, and a browser flow when the local test environment is available. Record observed limitations; do not claim production inventory or visual verification from static tests.

## Completion criteria

- Vehicle and Tower Crane appear from their catalogs and can be assigned only when server eligibility passes.
- Drivers filter evaluates crane operators against driver licences; a real candidate is visible and the saved assignment uses `driver`.
- Eligible-only totals and page contents count only eligible candidates across the full filtered pool.
- The picker explains why a row is blocked and never implies that the current page is the whole inventory.
- Existing authorization, optimistic job versioning, and assignment lock/transaction behavior remain intact.

## Audit result — 2026-09-27

- Vehicle and Tower Crane use the same catalog records, server eligibility checks, and assign/reassign path as the other asset kinds. The Drivers filter evaluates crane operators with driver licences and returns `driver` as the assignment type. The All view keeps one row per person and provides a direct Drivers action.
- Eligible-only filtering evaluates the complete matching pool in 100-record chunks before pagination. Page totals now represent eligible rows. The default unfiltered page keeps its bounded query path. A 201-asset test stayed within 20 SQL queries.
- UI review found page-local eligibility ratios presented without context. Candidate cards now say “on this page”; the footer shows the complete result total even when there is only one page. Driver guidance names the required driver licence. The asset section names fleet vehicles and tower cranes.
- A seeded Chromium flow verified dispatch setup and the Drivers, Vehicles, and Tower cranes controls. A separate 390 px browser flow verified setup navigation and the review rail. Focused PHP, React, static analysis, lint, and production build checks passed; see `.ai-reports/ai-verification-questions.md` for commands and limits.
- At very large inventory sizes, eligible-only requests still evaluate every matching record and retain eligible view models to sort them before pagination. Monitor latency and memory with production-sized data before extending this path to substantially larger fleets. The browser fixture did not prove behavior against the live Fleet, Equipment, or Personnel inventory.
