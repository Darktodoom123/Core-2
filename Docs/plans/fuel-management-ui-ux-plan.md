# Fuel Management UI/UX Plan

Last updated: 2026-09-25  
Status: Implemented (2026-09-25) in the working tree; the linked images remain concepts, not screenshots. See "Implementation status" below.

## Goal and scope

Give field personnel a clear path from requesting fuel to recording what was actually received, and give authorized office staff a web workspace for reviewing requests and inspecting fuel logs and receipt evidence. This plan covers three connected surfaces:

1. Native mobile **Request fuel** form and request status.
2. Native mobile **Record refueling** form with receipt evidence.
3. Web **Fuel Management** queue, selected-request detail, and linked log/receipt view.

The request is a proposal for fuel. The later log records the actual quantity and receipt. Keep those amounts and stages distinct throughout the UI.

## Implementation status (2026-09-25)

The earlier gap notes are resolved in the working tree:

- **Mobile request:** [FuelRequestForm](../../packages/field-mobile/src/components/fuel/fuel-request-form.tsx) defaults to the server-resolved current unit/job (`defaults` from `GET /api/v1/fuel-options`), offers tank level, urgency, and needed-by quick picks, shows field-level errors, and restores persisted drafts with a discard option. Outbox items read **Waiting to sync**, **Syncing**, or **Needs attention**; only a server reference is shown as submitted.
- **Mobile refuel:** [FuelLogForm](../../packages/field-mobile/src/components/fuel/fuel-log-form.tsx) opens only for `verified` requests, keeps requested and actual litres separate, shows the meter matching `meter_type` (no meter when the asset has none), records PHP cost and an optional receipt/OR number, and requires a receipt photo or a no-receipt reason (**Other** needs a note). Receipts stay in durable storage through outbox replay.
- **Mobile status:** [FuelRequestDetail](../../packages/field-mobile/src/components/fuel/fuel-request-detail.tsx) shows the timeline, decline reason, withdrawal, and the logged amount with receipt or exception state. Fuel push notifications open the named request.
- **Web:** [FuelRequestCard](../../apps/operations/resources/js/components/workspace/fuel/fuel-request-card.tsx) shows urgency, tank level, needed-by, withdrawal, one **Review Decision** action for reviewers with both rights (reason required to reject), requester-only withdrawal, and a receipt-exception block with **Mark exception reviewed** for verifiers. [FuelSurface](../../apps/operations/resources/js/components/workspace/fuel/fuel-surface.tsx) adds a **Receipt review** filter.
- **Known limits:** Web requests are not scoped to the requester's assignments (mobile requests are). No tank-capacity field exists, so the tank level is a manual estimate. Receipt OCR is out of scope.

## Source of truth and original gaps (superseded)

- The native [FuelScreen](../../packages/field-mobile/src/screens/FuelScreen.tsx) already creates requests, lists their stages, and opens logging only for a server-verified request. Its [draft store](../../packages/field-mobile/src/storage/fuelDraftStore.ts) and command outbox preserve submissions for offline sync.
- The native [request types](../../packages/field-mobile/src/types/fuel.ts) currently include optional equipment and job, requested litres, fuel type, and purpose. The working-tree server request rules also accept optional urgency, needed-by time, and manually entered fuel-level percentage. These three fields need mobile type, draft, outbox, and form work before the request concept can be implemented as shown.
- The native [FuelLogForm](../../packages/field-mobile/src/components/fuel/fuel-log-form.tsx) records actual litres, the asset-appropriate meter, optional PHP total cost, source, remarks, and one receipt photo. The working-tree server rules require a receipt **or** a no-receipt reason, and accept a receipt number. The native form still treats the photo as optional and has no reason or receipt-number input. Reconcile that contract before releasing the new receipt flow.
- The web [FuelSurface](../../apps/operations/resources/js/components/workspace/fuel/fuel-surface.tsx) already has Requests & Approvals, Fuel Logs, and Consumption sections; counted filters; a queue and selected detail; and an explicit note that counts and summaries cover the loaded page. The web [FuelRequestCard](../../apps/operations/resources/js/components/workspace/fuel/fuel-request-card.tsx) exposes stage actions and linked receipt evidence. Preserve server authorization and the independent-review rule.
- [Core-2 design guidance](../design/Design.md) sets a light-first field/office UI, gold `#FFBF00` as the primary accent, explicit status text, and touch targets of at least 44 px. Existing [web UX planning](./fleet-fuel-reports-ux-plan.md) requires honest requested-versus-dispensed amounts and no fabricated receipt verification.

## End-to-end journey

| Step    | Field/mobile experience                                                                                                                 | Office/web experience                                                                                                          |
| :------ | :-------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------- |
| Request | Choose an assigned equipment/job when relevant; enter litres, fuel type, purpose, and optional urgency, needed-by time, and fuel level. | New request appears in the authorized queue after the server accepts it.                                                       |
| Sync    | Show **Saved on this device**, **Syncing**, or **Submitted to office** as separate outcomes. Retain the same command ID on retry.       | Do not show an unsynced device draft as a received office request.                                                             |
| Review  | Show submitted/awaiting approval, rejection reason, or next stage; allow withdrawal only when the server permits it.                    | An independent authorized reviewer forwards and decides. The UI follows per-record permissions and never offers self-approval. |
| Verify  | Show **Ready to refuel** only after server verification.                                                                                | Verification remains distinct from approval and logging.                                                                       |
| Record  | Enter actual litres and the correct meter; attach one receipt or give a supported no-receipt reason.                                    | Show actual log values, receipt evidence or exception, and any follow-up review separately from request approval.              |

The canonical stages remain `submitted → forwarded → approved → verified → logged`, with `rejected` and `withdrawn` as applicable exits. A combined web review action may record multiple audited stages internally; the visible history must still reflect the actual server state.

## Screen plan

### 1. Native mobile: Request fuel

**Primary task:** Send a complete, correctly scoped fuel request with minimal typing outdoors.

- Header: **Request fuel**, back action, and a compact connection/sync indicator.
- Context: authorized assigned equipment and matching job pickers, each clearly optional; show a general-request path when no equipment is assigned.
- Fuel needed: requested quantity with a persistent `L` unit, Diesel/Gasoline choice, and required purpose. If included, urgency uses **Normal**, **Urgent**, and **Critical — work stopped** with text as well as color; needed-by date/time and current fuel level are optional manual inputs.
- Footer: one prominent **Submit fuel request** action and copy explaining office review. Preserve entered values on field or network errors. Disable duplicate submission while a command is pending.
- After submission: show a local queue confirmation immediately, then a distinct server-confirmed request reference when available. Never call a queued command approved or submitted to the office before acknowledgement.

Concept image: [mobile fuel request](../design/mobile-fuel-request-concept.png).

### 2. Native mobile: Record refueling and receipt

**Entry condition:** The selected request is server-verified and the user can record it.

- Show request reference, asset/job, **Ready to refuel** stage, and requested amount as context.
- Make **Actual quantity received** the first editable value. Show the asset-appropriate **Engine hours** or **Odometer (km)** input; never substitute one meter for the other.
- Show total cost in **PHP**, source/station, optional remarks, and optional receipt number when the contract is wired in mobile.
- Give the receipt image a clear capture/retake/remove affordance and an **Attached** label. The alternative **No receipt available** path asks for a supported reason; **Other** also asks for a note. Attachment alone does not mean the office verified it.
- **Save refueling** creates a permanent log. Show queued, uploading, needs-attention, and server-saved outcomes distinctly; keep the photo in durable device storage until replay completes. Prevent a second active log for the same request.

Concept image: [mobile fuel receipt](../design/mobile-fuel-receipt-concept.png).

### 3. Web: Fuel Management workspace

**Primary task:** Find the next request needing action, inspect its facts, and review the authorized next stage; inspect actual logs and receipts without confusing them with requests.

- Keep the established light workspace shell and Fuel Management navigation. Put **New request** in the heading, then the three existing sections: **Requests & Approvals**, **Fuel Logs**, **Consumption**.
- Above the queue, show compact stage filters, a search field, and the scope of page-level counts. Avoid summary numbers that imply the full archive when only the loaded page is present.
- At desktop width, show the request queue beside a selected detail. Queue rows lead with reference, equipment, requested litres/fuel type, stage, and urgency when applicable. At narrow widths, use a queue followed by a dedicated detail view with a clear return action.
- The detail shows full purpose, requester, asset/job context, requested amount, decision reason, needed-by time, stage history, and only actions currently allowed by server policy. Rejection requires a reason. A logged request has no approval action.
- The linked log shows **actual dispensed litres** separately, correct meter/unit, PHP cost, source, receipt number when available, and receipt **Attached** or an explicit no-receipt reason. Show exception review only to authorized users. A receipt thumbnail is evidence, not a verification badge.

Concept image: [web Fuel Management workspace](../design/web-fuel-management-concept.png). The selected sample is logged so both the earlier request and later receipt can be seen in one frame.

## Material states to design and review

| State                                    | Required treatment                                                                                      |
| :--------------------------------------- | :------------------------------------------------------------------------------------------------------ |
| Loading or no history                    | Show progress separately from an instructional empty state.                                             |
| Permission denied or no assigned context | Explain the unavailable action; offer the general-request path only when allowed.                       |
| Invalid field or mismatched job/asset    | Put a specific error by the field and keep the draft.                                                   |
| Offline draft or queued command          | Say it is saved on this device; show retry/sync status without implying office receipt.                 |
| Sync conflict or uncertain retry         | Keep the original command identity and offer a safe retry path.                                         |
| Rejected or withdrawn request            | Show the reason/history and only the next action the server permits.                                    |
| Verified request                         | Expose **Record refueling** only to authorized users.                                                   |
| Missing receipt                          | Require a supported reason and an explanatory note for **Other** before saving.                         |
| Logged request                           | Show requested and actual litres, receipt evidence, and any anomaly/exception status as separate facts. |

Use text and icons with semantic color, readable contrast in bright outdoor conditions, 44 px minimum touch targets, labeled inputs, accessible alerts, and visible keyboard focus on the web. Check the web queue/detail layout at desktop and phone widths; do not shrink operational text to force a table onto a phone.

## Copy-ready visual prompts

**Mobile request:** Create a high-fidelity Android Core-2 **Request fuel** screen at 390 × 844. Use the existing cool slate/white/graphite palette and restrained gold `#FFBF00`. Show online state, optional assigned equipment and job, requested litres, Diesel/Gasoline, Normal/Urgent/Critical urgency, optional needed-by and current fuel level, required purpose, and one gold submit action. Say that the office will review after submission. Keep all controls touch-friendly. Show no price, receipt, or approval control on this screen.

**Mobile receipt:** Create a matching Android **Record refueling** screen for a request marked **Ready to refuel**. Show its reference and requested litres, then separate inputs for actual received litres, asset-appropriate meter, PHP total cost, source, optional receipt number, and one attached receipt photo with retake/remove controls. Provide a no-receipt-reason path for cases without an image. End with **Save refueling** and copy that this creates a permanent fuel log. Do not label an attached photo as verified.

**Web workspace:** Create a high-fidelity light desktop Core-2 **Fuel Management** workspace with the existing sidebar, heading action, three sections, scoped filters/search, a scannable request queue, and a selected detail panel. Show one logged sample request with requested and dispensed litres as different values, truthful stage history, a linked refueling log, and receipt evidence. Keep review actions tied to the selected stage and capability. Use representative sample data and label it as such; omit decorative KPI grids and invented totals.

## Delivery and verification plan

1. Confirm the working-tree fuel contract, especially urgency/needed-by/fuel level, `withdrawn`, receipt number, and receipt-or-reason validation. Update native types, draft persistence, outbox payloads, and API parsing together before relying on the new fields visually.
2. Implement mobile request states and validation, then mobile receipt capture/reason states and durable replay. Cover valid submission, offline retry, unauthorized context, wrong meter, missing receipt/reason, duplicate log, and rejected/withdrawn cases in existing mobile and Operations tests.
3. Refine the web queue/detail and log/receipt surfaces against the same contract. Verify independent review, per-record actions, truthful page-scoped counts, receipt access, keyboard operation, and narrow-width navigation.
4. Exercise the connected journey on an Android emulator/device and the web at desktop and phone widths. Record the observed UI and server state at each transition. Planned checks include `npm run types:check:mobile`, `npm run test:mobile`, `npm run test:unit`, relevant Operations Pest tests, and browser/native journey tests where the local environment supports them. These checks are future acceptance work; creating this plan and the concept images does not run them.

## Acceptance criteria

- An authorized field user can create and track a request online or offline without duplicate submissions or false server-confirmation copy.
- A verified request alone permits refueling entry; requested and actual litres remain separate in mobile and web views.
- A saved fuel log has a receipt or an allowed no-receipt reason, and a linked receipt is shown as attached evidence.
- Office review respects permission and self-review restrictions, and each visible stage matches the persisted server state.
- The three concepts can be implemented within the current Core-2 design system without losing field accessibility or web queue scanability.
