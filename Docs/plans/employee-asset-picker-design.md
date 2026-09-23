# Module 2: Employee and asset picker
Design handoff — 2026-09-08

## Goal and scope
Operations managers must see and compare employees and equipment before selecting resources for a dispatch. Replace the narrow replacement dropdown with a browsable resource picker. Reuse the same candidate-row design in the preparation assignment step. Preserve the existing execution view, location-name presentation, field operator flow, and server business rules.

Mode: Operate. Visual authority: Docs/design/Design.md and Docs/design/dispatch-workspace/DESIGN.md. Instrument Sans, white surfaces, cool canvas, gold selection/primary action, semantic issue colors. No new UI library required.

## Desktop design
Use a large accessible dialog (about 1100px maximum, viewport minus 32px, maximum height viewport minus 48px). A fixed header and footer frame a scrolling list; a 280px selection rail stays alongside the list. Avoid a small dropdown or nested modal.

    Assign Driver/Operator and Equipment                         [Close]
    DSP reference · Job title · Scheduled date and time
    -------------------------------------------------------------------
    [Employees (selected count)] [Assets (selected count)]
    [Search name or asset code____________] [Role / type] [Eligibility]
    -------------------------------------------------------------------
    CANDIDATES                                  SELECTED RESOURCES
    [initials] Employee name                    Employees (1)
               Driver · Available               Selected name · Driver [Remove]
               Driver license valid
                                      [Select]  Assets (1)
    ------------------------------------------  Code · Model [Remove]
    [initials] Employee name
               Crane operator · Unavailable     Review
               Certification expired            Existing assignments are
                                [Unavailable]   shown separately from changes.
    ------------------------------------------
    Result range / total          [Prev] [Next]
    -------------------------------------------------------------------
    [Cancel]           1 employee · 1 asset selected       [Confirm assignment]

Assets tab replaces employee rows with a real thumbnail when supplied, otherwise an equipment icon; code and model/name; type; readiness; recorded maintenance/conflict details; Select.
The examples above describe layout, not seeded data to insert.

## Candidate rows and filters
- Employees: initials avatar (real image only if authorized data exists), name, assignment role, schedule availability, credential summary, and eligibility reasons.
- Assets: equipment icon, code plus model/name, assignment type, readiness, blocking maintenance and schedule conflicts.
- Use existing candidate properties. Current payload has no guaranteed photos or capacity: omit absent fields; never invent images, availability, capacity, or clearance.
- Entire eligible row can select, with an accessible checkbox for initial assignment or radio for replacement. Keep nested evidence disclosure separately operable.
- Selected rows use gold-tinted background, visible checkmark, and Selected text. Do not rely on color alone.
- Ineligible rows remain readable, with a reason and disabled selection; do not dim their explanatory text.
- Default eligibility filter: All, so the user can see why resources are unavailable. Offer Eligible only.
- Search uses existing server filters; preserve server pagination and totals. Do not search only the first loaded page while claiming global results.
- Keep selected items across tabs, search and pages, using established selection hooks. Already assigned resources show Assigned and cannot be duplicated.
- Evidence uses existing detail disclosures rather than displaying long paragraphs on every row.

## Initial assignment
Primary entry point on the dispatch detail page: a clearly visible Assign resources button alongside the assigned Employees and Assets groups, when allowed by current job state and permissions. The picker must be discoverable from the job page; users should not need to know the preparation step name to find it. When assignment is not allowed, preserve the supported replacement action and explain relevant state restrictions using existing capability data.

The dialog job-context line includes site and the full dispatch start/end window so availability is understood in context. Keep the selected summary visible on desktop. Label the initial submission Assign selected resources. Prefer eligible resources first only when supported across the full server result set; never sort just one page while implying a global order.

Title: Assign Driver/Operator and Equipment.
Both Employees and Assets tabs selectable. Permit multiple selections within existing server rules. Rail groups selected employees and assets with individual Remove controls. Footer confirms all staged changes through the existing preparation assignment flow. Preserve approval, safety and readiness behavior; do not bypass workflow steps or auto-activate the job.
Expose this picker within the existing preparation Resources step; preserve selection and unsaved-change behavior instead of creating a second competing assignment state store.

## Replacement
Reassign beside a person opens Employees; beside equipment opens Assets. Title: Replace operator / Replace driver / Replace equipment as applicable.
A compact current-assignment strip names the resource being replaced and its role/type.
Lock replacement selection to the target kind and compatible assignment type. Other category may be visible as read-only current-assignment context but must not imply cross-kind replacement.
Exactly one eligible replacement is required. Rail shows Current → Replacement and a reassignment reason field using existing validation requirements.
Footer: Cancel and Replace operator/driver/equipment, disabled until a valid replacement is selected.
Remove the No replacement option. End assignment stays a distinct existing confirmed action.
Submit removal plus replacement atomically through the existing reassign endpoint, with current job version; no mutation on row selection.
Validate the selected candidate again immediately before sending. On server conflict preserve context and selections, show the actionable error, and refresh eligibility as needed. Never silently turn a failed lookup into an end-only request.

## Assigned summary on execution screen
Use title Assigned employees and assets, with Employees and Assets subsections. Each employee row: name, role, acceptance, recorded credential issue, Reassign, End. Asset row: code/model, supported state/issue information, Reassign, End.
This summary displays actual assignments only; it is distinct from the picker showing available candidates.
Keep server capability guards. Add-resource controls are shown only when the existing workflow supports them; do not create a new active-job permission.

## Responsive and accessibility
Below about 768px use a full-screen dialog, one list column, sticky tabs/search and footer, and a Selected resources disclosure above the footer. Allow scrolling to every result and reason field, with safe-area spacing.
Use the repo's accessible dialog primitives: focus trapping, labelled heading, Escape, close focus returned to trigger, no background interaction. Dirty selections use established discard protection. Keyboard-operable tabs and choice controls; 44px touch actions; loading status announced; semantic error text.
At 390px long names, asset codes and reasons wrap without horizontal scroll.

## States
Loading: candidate skeleton rows while header and current assignment remain visible.
Empty search: No matching employees/assets, with Clear filters.
No eligible replacements: explain no matching replacement for this role and schedule; retain unavailable rows and Cancel.
Fetch failure: inline retry, distinguish unavailable data from empty results.
Stale candidate page/job version: visibly refresh/revalidate; do not certify eligibility from stale state.
Submission: prevent duplicate submission, show progress, retain errors in dialog; close and refresh actual assignments only on success.
Geocoding and execution layout are outside this change.

## Implementation map
Read applicable AGENTS instructions and the existing implementations first:
- resources/js/components/dispatch-detail/reassignment-modal.tsx
- resources/js/components/dispatch-detail/current-assignments.tsx
- resources/js/components/dispatch-detail/personnel-candidates.tsx
- resources/js/components/dispatch-detail/asset-candidates.tsx
- resources/js/components/dispatch-detail/use-dispatch-assignment.ts (resolve actual hook path)
- resources/js/pages/dispatch-detail.tsx
- resources/js/types/workspace.ts: PersonnelCandidateViewModel, AssetCandidateViewModel, CandidatePageViewModel
- app/Modules/Dispatch/Http/Controllers/DispatchJobController.php
- app/Modules/Assignment/Queries and Actions for existing candidate and mutation contracts.

Inspect existing accessible dialog, selection, candidate pagination, and eligibility components and reuse them. Extract a cohesive shared picker only where it avoids duplication. Keep all unrelated working-tree changes intact.

## Acceptance and verification
1. Clicking Reassign shows visible employee or asset rows with search and eligibility evidence, no replacement dropdown.
2. Initial assignment supports choosing employees and assets and reviewing selections together.
3. Selection persists across search, pages and tabs; assigned/ineligible candidates cannot be selected.
4. Replacement cannot submit empty, incompatible, stale-invalid or duplicate selection; End remains separate.
5. Permissions, version checks, atomic server assignment and operator/preparation workflow are preserved.
6. Desktop and 390px mobile usable, keyboard focus restored, empty/error/loading states distinguishable.
7. Relevant React behavior tests and server tests if contracts change; types, focused lint/format and build. Perform one batched browser review, one fix pass if necessary.
8. Update required verification questions and relevant product docs; disclose preexisting unrelated lint failures. No commit, push, PR or deployment.
