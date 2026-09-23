# Fleet, fuel requests, and job reports: implementation brief

Date: 2026-09-07. Status: finalized implementation handoff. Planning is complete; implementation and runtime verification remain to be performed by the execution team.

## Outcome and scope

Help office operations users identify the correct record, understand its current condition, and take the next permitted action without deciphering promotional copy or opening unrelated screens. Treat “not AI slow” as both avoiding AI-slop presentation and keeping interactions responsive. Confirmed scope: office web app, including responsive tablet/phone layouts; native field application is outside this plan. The user prioritizes all three equally: correct necessary information, fewer confusing steps, and an uncluttered responsive interface.

Preserve Core 2's Instrument Sans, gold identity, semantic tokens, existing navigation, and backend workflows. Authority: `Docs/product/`, `Docs/architecture/`, `Docs/design/Design.md`, and current code. Core 1 owns commercial/project management. Do not invent billing readiness, tank telemetry, dispatch readiness, compliance, customer acceptance, or integration completeness.

This is a source-based audit, not a rendered-screen accessibility or performance certification. Usability score and contrast scores are deliberately unmeasured until browser review. Existing strengths: typed view models, explicit server fuel transitions, fleet list/detail structure, report review structure, and shared status components.

## Five-module and capstone boundaries

The five main modules remain unchanged. Job reports are a shared platform service, not a sixth business module.

| Main module | Scope of this delivery | Preservation check |
| --- | --- | --- |
| Dispatch Job and Scheduling | Preserve the existing workflow and links from the improved screens | An existing dispatch still opens and progresses through its authorized workflow. |
| Assign Driver/Operator and Equipment | Display existing assignment context where supplied; no assignment-engine rewrite | Assigned operator/asset identities remain correct, and existing qualification/availability checks still apply. |
| Fleet Management | Improve the live fleet list, details, tracking clarity, and operational actions | Safety blocks, inspections, maintenance, and location freshness retain their actual meaning. |
| Crane and Equipment Management | Preserve equipment categories and shared asset behavior | Representative crane records retain capacity units, inspections, safety lockouts, and maintenance-release behavior; no truck-only assumptions. |
| Fuel Management | Improve requests, stage decisions, verification, logs, and evidence | The full ordered workflow and independent-review requirement remain enforced. |

Capstone title: “Design and Implementation of a GPT Mini Powered Dispatch and Resource Management Platform with Mobile Application for Real Time Tracking for Field Service Monitoring.” This delivery supports operations and field monitoring; it does not establish completion of the entire title.

Final integration evidence must distinguish verified capabilities from gaps:

- GPT Mini assistance: demonstrate the existing configured dispatch/resource advisory flow, its actual model configuration, and human confirmation. Ordinary fleet, fuel, and report actions must not wait for an AI response. Do not introduce a new AI feature or silently switch models in this UI delivery.
- Dispatch/resource management: demonstrate an authorized dispatch with actual assigned personnel and equipment; verify links and resource safety checks survive these changes.
- Mobile and real-time tracking: using the existing mobile application, demonstrate a real assigned-asset location update reaching the web workspace and subsequently displaying delayed/stale state correctly. A seeded marker or manually edited database coordinate does not prove mobile real-time integration.
- Field service monitoring: demonstrate an actual field report reaching web review with the correct job, author, interval, and evidence, plus the related fuel workflow where supported.

These are integration checks against existing capabilities, not authorization to build missing native/GPT/dispatch features. Record any unavailable device/service or missing capability as a separate capstone gap with evidence. UI delivery may be complete while capstone validation remains incomplete; never label both complete merely because screenshots look correct.

## Confirmed findings to fix first

### Current mobile compatibility addendum (source audit, 2026-09-07)

The web refinement is compatible in scope, but mobile feature parity is incomplete. These findings describe the repository source, not a verified installed-device build. Keep native fixes as a separate workstream; the web implementation must accommodate the actual payload rather than assume the mobile PRD is fully implemented.

| Area | Current implementation evidence | Required compatibility behavior / separate gap |
| --- | --- | --- |
| Fuel integration | `packages/field-mobile/src/screens/EquipmentInspectionScreen.tsx` initializes a sample fuel log and stores additions in local state. Its call site in `src/navigation/AppNavigator.tsx` does not supply `onLogFuelReceipt`. `src/services/apiClient.ts` and outbox command types contain no fuel-request operation. | Do not claim mobile fuel receipts populate the web queue. A future mobile integration must create/link a real request and respect submitted → forwarded → approved → verified → logged; local receipt capture cannot bypass those stages or become an approved server log. |
| Fuel units/currency | Mobile `FuelReceiptTab.tsx` labels cost in dollars and captures odometer; the web fuel form labels PHP and supports asset-appropriate meters. | Separate mobile gap: align currency and meter types with the domain contract before integration. Never silently convert currency or map crane engine hours into odometer kilometres. |
| Report submission | Mobile `AppNavigator.tsx::handleTransitionStatus` enqueues a report through `commandOutbox` and `/api/v1/job-reports`, including summary, ending meter and signer metadata. That call omits started/ended times, coordinates, and attachments; `SubmitJobReport` stores absent interval/location as null. | Web displays “Not recorded” and zero attachments accurately. Do not make those optional shared API fields required during a web UI change. Work interval/evidence collection is a separate mobile enhancement. |
| Signature evidence | `DigitalSignatureModal.tsx` captures drawing strokes, but the navigator's submitted report contains signer name/role/time, not strokes or a signature image. | Describe persisted information as recorded sign-off details. Do not display a fabricated signature, assert that a signature image is stored, or equate this metadata with manager approval. Signature persistence is a mobile/API gap. |
| Summary reliability | The mobile signature form begins with a generic completion summary; the navigator has a fallback summary asserting tasks were completed. | Web treats summary as submitted text, not independently verified work. Replacing unsupported defaults with operator-entered content belongs in the separate mobile follow-up. |
| Offline completion | Report submission and dispatch completion are separate queued commands. Queue state is local and not equivalent to server report status. | Do not assume completed dispatch guarantees a received/approved report, or invent a server-side “pending mobile upload” state without evidence. Test report failure/retry, independent dispatch status, duplicate prevention, and delayed arrival. |
| Tracking freshness | `app/Platform/Tracking/Models/LocationUpdate.php` derives freshness from `received_at` (fallback `captured_at`) and maps sharing disabled to offline. The mobile baseline describes some released/paused cases as stale/last-known. | Preserve actual server enums. Show capture time and receipt time distinctly when available; recently received older coordinates must not be described as a current GPS fix. Retain last-known location independently of sharing/connection status. Do not silently change freshness rules in this UI task. |

Additional non-regression rules:

- Assignment acceptance, HoS clock-in, active unit binding, telemetry sharing, inspection outcome, and dispatchability are separate facts. Do not infer active GPS or a safe asset from an accepted assignment or on-duty operator. Validate existing pause/release/handover behavior against current runtime before marking it demonstrated.
- Keep `/api/v1` status strings, request fields, optionality, `command_id` handling, and existing offline retry semantics compatible. Web view-model status objects and API string statuses are different representations; do not reuse the web shape as a replacement mobile API response.
- Mobile compatibility acceptance includes an actual current mobile report payload with missing interval/location/attachments, sign-off metadata without an image, delayed command replay, and a location whose capture time differs materially from receipt time.
- Reuse `packages/field-mobile/src/__tests__/liveContractsE2E.test.ts`, API-client/outbox tests, and relevant backend tests if shared contracts are touched. Mocked contract tests are not substitutes for a physical-device/emulator integration demonstration.

The capstone fuel demonstration must currently be reported as a web/server workflow unless a real mobile-to-server fuel implementation is independently established. A local fuel-receipt success message is not that evidence.

### Web findings

| Priority | Evidence | User impact and correction |
| --- | --- | --- |
| High | `resources/js/components/workspace/live-workspace-sections.tsx`, fleet row `hasLiveGps` checks coordinates only | Old coordinates can appear as “GPS Live.” Use supplied freshness status and observation time. Missing location must say “Location not recorded,” not “Base Yard.” Do not fabricate a capacity unit either. |
| High | `resources/js/components/workspace/fuel/fuel-surface.tsx`, `kpis` | Requested quantities across statuses are labelled “Total Volume.” Label requested litres explicitly; actual dispensed litres come only from logs. No logs/insufficient baseline cannot mean “All within baseline burn rate.” |
| High | Same file, status grouping | `verified` and `logged` are grouped as “Verified & Logged,” although verification precedes logging. Give each operational stage its own label and next action. |
| High | `resources/js/components/workspace/reports-workspace-section.tsx`, empty state and stats | No records claims all reports are verified; attachments are called verified merely because they exist; approvals imply ready for billing. Replace with recorded facts. |
| High | Same file, `selectedReport` | Selection searches the unfiltered array, so a detail can remain visible after its row is filtered out. Select only within visible results or clear the selection. Apply the same invariant to fleet, whose fallback can also select outside an empty filtered list. |
| Medium | Same file, search placeholder | Promises client/crew search while predicate searches job reference/title, author, summary, remarks, and job ID. Name supported fields; only add client search with a verified, authorized payload extension. |
| High | `app/Platform/Workspace/Http/Controllers/OperationsWorkspaceController.php`, bounded queries; reports capped at 100 | Client filtering and array totals are not complete historical search or global totals. Make scope explicit and add server pagination/search before presenting a complete archive. |
| Medium | Fuel page KPI strip and always-open create form; report KPI strip duplicates filters | Routine queue work starts below nonessential content. Replace with a short heading, compact counted filters, and a queue. Open creation on demand. |

Audit coverage: mental-model and data-truth issues above are confirmed in source; click economy, responsive hierarchy, keyboard operation, focus, and contrast require the acceptance pass below. No numeric usability score should be invented.

## Visual and interaction contract

- Use Operate mode: a calm working surface with useful density. Page heading, toolbar, queue, selected-record detail. No hero, gradient, sparkle icon, decorative chart, four-card KPI template, giant empty state, or marketing subtitle.
- Titles: “Fleet management,” “Fuel requests,” “Job reports.” Helpful copy explains the next task or missing information; avoid “telematics,” “role-gated,” and claims of automated verification in general headings.
- Use existing tokens and primitives. Main row information should generally be 14px, supporting metadata at least 12px. Do not build essential information out of 10px uppercase badges. Use tabular numerals and explicit units for comparable amounts.
- Desktop: queue beside a wider detail panel at widths that fit both legibly (start at 1280px and validate with the sidebar open). Below that, queue then a dedicated detail view with “Back to results,” preserved filters, scroll, and focus. At 390px, no page-wide horizontal scroll and no two narrow columns.
- A selected record has an explicit heading/reference. One prominent next action in its decision area. Secondary actions remain visible with text; destructive actions are separated. Never make a tooltip the only source of a blocker or required fact.
- Filters show selection and scope. Persist search/filter/record state in existing navigation conventions, including browser Back. A record outside the results must not silently remain in the detail panel.
- Local selection/filter feedback is immediate; no artificial delays, animated counts, staggered rows, or continuous pulsing. Retain existing 150–250ms state transitions only where useful; reduced motion is immediate.
- Loading is not an empty result. Keep the existing queue while refreshing, expose pending/error feedback, preserve input on failure, and show success only after the server confirms a mutation. Realtime updates must not steal focus or reset a draft.

## Information contract by screen

### Fleet management

Primary question: “Which asset needs attention, and what do I need to know before using it?” Default to the fleet list; keep Map as a secondary view. Retain the existing equipment category boundary and tracking entry point.

Queue rows, in order: code and name; registration when present; canonical asset status; dispatchability/blocker; operator; location freshness. Keep the blocking reason legible. Use short stacked metadata on phone. Search code/name/registration and supported asset attributes. Provide category and operational-status filters; a safety/maintenance attention filter must be based on actual supplied lockout/work-order facts.

Detail order:

1. Asset identity, status, dispatchability, prominent active lockout and reason.
2. Current operator and recorded duty status; latest inspection result/time and blocking maintenance count. Unknown inspection is “No inspection recorded,” not passed. Avoid converting HoS data into a new legal-compliance verdict.
3. Last known location with freshness and timestamp; meter value with its actual meter type/unit. No coordinates means no marker. Unknown speed is not zero. A map failure leaves the asset list usable.
4. Existing inspection/maintenance history and authorized actions. Preserve safety lockdown, inspection, status update, and maintenance-release behavior; do not add a one-click bypass.
5. Specifications as secondary information. Capacity needs its recorded unit. Current job is only shown if an authorized relationship is supplied; do not infer it from asset status or GPS.

Sources: `AssetViewModel`, `LocationUpdateViewModel` in `resources/js/types/workspace.ts`; `AssetsSurface` and its detail in `live-workspace-sections.tsx`. Fleet subcomponents exist in `components/workspace/fleet/`; `FleetAssetCard` is not the live entry point and changing it alone does not fix the routed screen.

### Fuel requests

Primary question: “What fuel was requested, for what purpose, and what action can I take at this stage?” Compact stage filters and an anomaly filter replace KPI cards. Default to All until per-record allowed actions can reliably define “Needs my action.”

Queue columns: reference; asset or explicit “No asset linked”; requester; requested litres and fuel type; stage; next action. Submission time becomes a column only after adding its real source to the payload. Detail shows purpose without truncation, job link if present, requested amount, decision reason, recorded stage timestamps, actual log quantities/costs/meter/station/receipt, and anomaly evidence.

Do not conflate requested and dispensed amounts. Label any aggregate with unit, date range, and whether it represents visible results or all authorized matching records. Null cost is “Not recorded”; zero is a recorded zero. No baseline/prior meter means “Not enough data to assess consumption,” not normal consumption.

Preserve the exact workflow implemented by `app/Modules/Fuel/Actions/TransitionFuelRequest.php`:

| Current stage | Permitted next stage/action, subject to authorization |
| --- | --- |
| submitted | Forward for review → forwarded |
| forwarded | Approve → approved; Reject → rejected; independent reviewer required |
| approved | Verify → verified |
| verified | Record fuel log → logged |
| rejected / logged | Show decision/history; no invented reopen or skip action |

Remove the competing “Review Decision” and “Quick Approve” path in favor of reviewing the selected request with facts in view. Make self-review restrictions understandable before clicking. Per-record allowed actions should come from server policy/action rules, not just a broad capability or client-side role name.

“New request” opens a focused form using current validation: optional asset/job linkage as supported, fuel type, quantity with litres, and purpose. Keep requiredness aligned with `StoreFuelRequest`; do not silently substitute a made-up operational purpose. If job selection is enabled, use authorized job options rather than an arbitrary ID input. Record-fuel form preserves actual quantity, applicable meter, cost fields, station, receipt, field errors, and duplicate-submit protection.

Sources: `components/workspace/fuel/fuel-surface.tsx`, `fuel-request-card.tsx`, `fuel-log-modal.tsx`, `fuel-variance-badge.tsx`; `app/Modules/Fuel/ViewModels/FuelWorkspaceViewModel.php`, policies, requests, and transition action. Current request payload lacks creation/submission timestamp and per-record actions: these are explicit contract tasks, not guessed UI fields.

### Job reports

Primary question: “What work was reported, what evidence supports it, and can I approve it or explain a rejection?” Use counted status filters and the existing queue/detail concept. An authorized reviewer can start at Submitted; other users start at All. Explain an empty Submitted view and provide All, so completed/rejected records remain discoverable.

Queue: job reference/title; report identifier (existing numeric ID if no report reference exists); author; work interval; submission time; status. Evidence count is secondary and labelled “attachments,” never “verified attachments.” Search copy names job, author, or report text unless the actual search contract expands.

Detail order:

1. Job/report identity, author, status, submitted time; rejection reason and resubmission count prominently when applicable.
2. Full work summary, started/ended times, meter type/value, remarks. Any elapsed duration derived from the interval must be labelled elapsed time, not productive/billable hours.
3. Attachments with filename/type and authorized preview/download; customer sign-off with signer/role/time or “No sign-off recorded.” Report approval and customer sign-off remain different facts.
4. Delay records and existing DVIR/fuel cross-references as secondary sections. Preserve reported facts; no invented demurrage calculation or billing readiness.
5. Review action area: approve, or reject with a visibly required reason according to backend validation. Resubmission preserves the rejection context and existing rules. No automatic approval or client-only workflow changes.

Keep create/draft/resubmit routes and job-prefill deep links working. Isolate errors to the form/action that produced them; the current page-error heuristic must not open the create form for unrelated review/export errors. Switch between records without carrying a previous record's review note into a new submission. Export is a secondary action with existing asynchronous status, expiry, and download permissions.

Sources: `components/workspace/reports-workspace-section.tsx`, `components/workspace/reports/*`, `JobReportViewModel`; `app/Platform/Reporting/{Actions,Policies,Http/Requests}`. Job client/site/assigned asset are not in the report's nested job payload: omit or add verified authorized fields deliberately.

## Delivery sequence and teamwork ownership

The following is a handoff structure, not a claim about `/teamwork-preview` syntax. Use that workflow's installed instructions; do not invent agent commands. Gemini should implement one bounded phase at a time and report files, validation, and unresolved constraints.

### Phase 0 — establish baseline and contract (lead, before parallel edits)

Read repository instructions and the sources above. Confirm the live route renders `resources/js/pages/workspace.tsx` via `OperationsWorkspaceController`; `resources/js/pages/operations.tsx` is a separate implementation. Capture the three live screens on desktop and phone with realistic authorized records. Record existing failures separately.

Write a field-to-source checklist covering every proposed column, timestamp, count, action, and null state. For each field mark: already supplied, persisted but needs authorized exposure, or unavailable. Use supplied fields first; unavailable optional fields are omitted or honestly marked unknown. Count/search scope must be explicit from Phase 1. Freeze the minimal shared type contract before agents begin; defer full-history query expansion to Phase 3. No migration is expected for presentation of existing facts.

Validate the proposed queue/detail hierarchy against the three running screens before restructuring. If no browser/session is available, record that limit and keep runtime visual approval outstanding rather than calling the composition validated. Do not make baseline capture dependent on a new design system, native build, or unrelated infrastructure repair.

### Phase 1 — correct factual and selection defects (lead integrates)

Fix the factual-label and selection defects before visual restructuring. Add behavior tests for old GPS data, unknown fields, quantity/state semantics, filtered selection, and honest empty states. Until Phase 3, label bounded results as loaded/recent records and explicitly identify local search; do not claim complete archive coverage. Expose minimal timestamp and per-record action data only when necessary for correct decisions and backed by actual persisted data and authorization. Risk: medium because changes may touch shared payloads and counts. Exit gate: factual-display and selection regressions pass independently of the later layout work.

### Phase 2 — independent screen work after contract freeze

| Owner | Edit boundary | Deliverable |
| --- | --- | --- |
| Fleet | New focused files under `resources/js/components/workspace/fleet/` | Fleet queue/detail composition and preservation of inspection/maintenance/tracking behavior. Propose extraction of existing asset code; lead makes edits to shared `live-workspace-sections.tsx`. |
| Fuel | `resources/js/components/workspace/fuel/` | Stage queue, focused create/log forms, reviewed action flow, truthful quantity/anomaly display. |
| Reports | `resources/js/components/workspace/reports-workspace-section.tsx` and `reports/` | Review queue/detail, record-specific form state, honest evidence/sign-off display and retained creation/resubmission/export behavior. |
| Lead | Shared types, controller/view models, `workspace.tsx`, `live-workspace-sections.tsx`, shared primitives/tokens | Contract, integration, query behavior, reviewer coordination, final verification. |

No two agents edit the same file. Assign screen-specific test files to each owner; shared backend tests remain with the lead. Agents propose shared changes to the lead rather than widening their boundary. Extract focused components/hooks where responsibilities justify them; do not introduce a universal workflow engine or redesign unrelated workspace sections. Risk: medium; shared routing and permission regressions are the main integration concern.

### Phase 3 — bounded backend enhancements (lead, after screen integration)

Make query expansion a separate, testable change. Inventory each surface's actual query cap and authorized scope. When a cap can hide actionable records or prevents access to older reports/requests needed for the workflow, implement narrow server search/filtering and pagination with matching authorized totals. This is required before calling that surface a complete queue/archive. Do not remove limits, load the entire database, or introduce a broad reporting rewrite. Preserve existing partial reloads, visibility scopes, stable ordering, and filter navigation.

Expose additional persisted context only when it resolves a concrete decision problem in this plan. New business data, migrations, new lifecycle states, and new integration features remain outside scope. Optional data such as client/site/current-job detail must not delay the core UI when it has no verified source. Exit gate: query/count authorization and more-than-100-record coverage pass where the cap applies; any intentionally bounded surface remains clearly labelled and is not presented as a complete archive.

### Phase 4 — verify, demonstrate, and document

Use the relevant TypeScript/code reviewer and security reviewer for payload/action/attachment changes. Run one batched desktop/phone visual review across all three screens, fix the discovered defects together, and do one confirmation pass. Record screenshots, actual test results, and limitations. Update `.ai-reports/ai-verification-questions.md` with implementation evidence for the four required questions. Do not commit, push, or open a PR without an explicit request.

Run the five-module preservation checks and capstone integration scenarios above. Report UI implementation status and capstone evidence status separately. A failed relevant regression must be resolved before marking the affected UI flow complete; an unrelated pre-existing capstone gap is documented without expanding this implementation silently.

## Acceptance scenarios

| Area | Required proof |
| --- | --- |
| Fleet truth | Fresh/delayed/stale/offline records render distinctly; coordinates alone never imply live. Null location, unit, speed, operator, or inspection never produces an invented fact. A safety lockout is visible before any state-changing action. |
| Fuel workflow | Test every valid transition and blocked skip, unauthorized actor, self-review, duplicate log, wrong meter/unit, validation failure, and receipt access. A verified request still needs a log; requested and dispensed litres are distinguishable. |
| Report review | Selecting A, typing a note, and selecting B cannot submit A's note for B. Filtering A out clears/replaces its detail. Rejection requires reason; resubmission and draft/job-prefill still work. Approval never asserts billing completion. |
| Dataset completeness | Phase 1: local/loaded scope is explicit. Phase 3: wherever bounded data hides actionable or required historical records, more than 100 records remain discoverable through authorized server query/navigation. Totals and filters share scope; unauthorized records never affect counts or results. No complete-archive claim for a deliberately bounded view. |
| Form recovery | Invalid submission retains inputs and shows connected field errors. Pending action prevents duplicates. Server rejection/stale state gives actionable feedback and refreshed facts, without falsely reporting success. |
| Accessibility | At 1440, 1024, and 390px: readable rows, no obstructed actions, no whole-page horizontal overflow. Keyboard can search, select, inspect evidence, submit, cancel, and return focus. Labels are associated; focus is visible; text contrast checked; status uses text, not only color; phone actions have 44px targets. |
| Performance | Measure before/after on the same device/build with realistic maximum page data. Target local selection/filter response under 100ms; investigate repeatable long tasks over 50ms during that interaction. These are targets, not measured claims. Map code/data should not block list use; no per-row repeated location scan when a keyed lookup suffices; preserve lazy maps and scoped payloads. |
| Robustness | Empty dataset, zero matches, long names/reasons, null relations, failed map, expired download, permission loss, and realtime change while editing have intentional recovery. Review target never changes under the user's cursor. |

Extend existing tests rather than replacing them: `tests/Feature/Operations/FuelAndTrackingWorkflowTest.php`, `FuelConsumptionVarianceAndAnomalyTest.php`, `JobReportWorkflowTest.php`, `JobReportResubmissionTest.php`, `JobReportSecurityAuditTest.php`, `TrackingWorkspaceContractTest.php`, `OperationsWorkspaceViewModelTest.php`, and `tests/Feature/Performance/OperationsWorkspacePerformanceTest.php`. Add focused React tests under `tests/React/Components/` for selection/form and factual-display regressions, and browser journeys under `tests/Browser/` for the three live surfaces.

Use repository scripts: focused `npm run test:unit -- <test path>` and `php artisan test <test path>` while iterating; then `npm run types:check`, `npm run lint:check`, `npm run format:check`, and `npm run build`. For changed PHP run `composer lint:check`, `composer types:check`, and relevant feature tests. Run the implemented browser journeys with `npm run test:e2e -- <spec path>` and relevant accessibility checks. Report unavailable services and pre-existing failures honestly. Resolve current library syntax with Context7 when implementing; this plan does not prescribe unverified library APIs or upgrades.

## AI quality gate: design-stage answers

1. **Most secure?** The plan preserves server authorization and state transitions, adds per-record action clarity, scopes search/counts, and retains private evidence access. Actual implementation needs security review and adversarial tests; UI hiding alone is insufficient.
2. **Most efficient?** Reuse existing list/detail and map primitives, bounded queries, and partial payloads. Remove repeated decorative UI and unnecessary interaction steps. Measure before adding caching, virtualization, or new dependencies.
3. **Possible regressions?** Permission leakage in aggregates, mistaken GPS/readiness claims, lost selection/drafts on reload, cross-record notes, broken report deep links, fuel stage skips, wrong meter units, attachment access, maintenance actions, and prototype/live divergence. Address with the scenarios above.
4. **Tests before shipping?** Contract and policy tests for changed payloads/actions; React interaction tests for selection and forms; browser evidence for core workflows, responsive layout, keyboard use, and measured performance. Document executed results after implementation, not anticipated passes.

## Copy into Gemini after invoking your teamwork workflow

> Follow the finalized `Docs/plans/fleet-fuel-reports-ux-plan.md`, including its mobile compatibility addendum. This execution starts with Phase 0 and Phase 1 only: establish the live-screen baseline and minimal field contract, then fix factual information and selection defects. Preserve the five main modules, existing Core 2 identity, backend rules, and mobile API/offline compatibility. Present the changed files, actual test results, before/after evidence, and remaining limitations at the first checkpoint; wait for my instruction before starting Phase 2. Do not expand into native mobile changes, new GPT features, or unrelated backend work. Do not commit, push, or create a PR.

## Execution checkpoints and subsequent work

The first Gemini run is deliberately bounded to Phases 0–1. At its checkpoint, review whether GPS freshness, fuel amounts/stages, report evidence labels, selection behavior, and dataset scope are now truthful. Require executed tests and live-screen evidence where available; missing runtime access must be disclosed. A plan, screenshot, or passing type check alone is not proof that a workflow works.

After reviewing that checkpoint, use this continuation prompt:

> Continue with Phases 2–4 of `Docs/plans/fleet-fuel-reports-ux-plan.md`. Use the frozen shared contract and stated ownership boundaries for parallel screen work. Complete the screen improvements, necessary bounded backend enhancements, and verification. Preserve mobile compatibility and all five modules. Report actual tests, before/after visual evidence, module-preservation results, and capstone integration results separately. Keep native changes and missing GPT features out of scope; record them as follow-ups. Do not commit, push, or create a PR.

Once the web work is verified, plan a separate mobile integration workstream in this order:

1. **Fuel integration:** replace local/sample receipt behavior with real authorized requests and linked receipt/log handling; align PHP currency and asset meter types; retain the ordered server workflow. Define offline persistence, upload recovery, and duplicate prevention before implementation.
2. **Report completeness:** collect actual operator-entered work summaries and available work times, location, attachments, and persisted signature evidence. Define missing-data handling and signature storage/access explicitly; preserve compatibility with existing queued commands and distinguish recorded sign-off from approval.
3. **End-to-end reliability:** verify report/dispatch command failures and retries, delayed location uploads, unit binding, pause/release/handover, and authorized web review using the actual mobile client.

These are prioritized follow-ups, not implementation-ready native specifications or part of this web execution. Inspect the mobile code and define their contracts/tests in a separate plan before changing it. The final capstone demonstration is dispatch → assignment → mobile execution/tracking → report submission → office review, with the real fuel workflow and existing GPT-assisted resource decision demonstrated separately. Track gaps honestly until each capability has working evidence.

