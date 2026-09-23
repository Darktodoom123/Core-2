# Core Transaction 2 — Product Design

**Last updated:** 2026-09-04  
**Authority:** Canonical product and interface design specification; informed by the current workspace and interactive prototype

## Experience direction

Core Transaction 2 should feel like a dependable operations instrument: decisive, accountable, calm, information-rich, and safety-conscious. It is light-first for bright dispatch offices and outdoor field use.

Core 1 is an external upstream system and is not designed or built in this
repository. Core 2 interfaces present the operational processing of service,
rental, and sale handoffs; they must not imitate or claim Core 1 customer-facing
CRM, sales, rental-contract, billing, or project-management screens.

Avoid decorative dashboard card grids, purple gradients, sparkle/AI branding, sci-fi control rooms, neon maps, ornamental motion, and language suggesting GPT automatically applied a decision.

## Experience principles

1. Put the next operational decision in view.
2. Explain recommendations, conflicts, and consequences before confirmation.
3. Show freshness, current owner, and synchronization state.
4. Adapt navigation and density by capability and work context.
5. Keep field actions safe, touch-first, and usable with one hand.
6. Pair semantic color with text and an icon or shape.

## Information architecture

The operational backbone is built upon the **5 Main Operational Business Modules**:
1. **Dispatch Job and Scheduling (Real-Time Activation)** (including Project Planning)
2. **Assign Driver/Operator and Equipment** (incorporating Hours of Service [HoS] compliance)
3. **Fleet Management** (incorporating Driver Vehicle Inspection Reports [DVIR])
4. **Crane and Equipment Management** (including load charts and crane safety)
5. **Fuel Management** (bowsers, logs, and anomaly detection)

Tracking, reports, administration, audit, notifications, attachments, and GPT assistance are shared platform services rather than separate business modules. Upstream Core 1 transactions flow in via the 3 Tri-Modal Inbound Flows (Service, Rental, and Sales). Navigation is permission-filtered, but Laravel remains authoritative. See [Top-level modules](../architecture/modules.md) and [Core 1 involvement in Core 2](../README.md).

Service, rental, and sale handoffs use one shared Dispatch Workspace and one
shared dispatch execution backbone. They all use the same scheduling,
personnel and asset availability, qualification, conflict, assignment,
approval, activation, tracking, and field-progression patterns. Rental and
sale records add source-specific requirements and completion evidence, but
they are not separate dispatch products or separate field execution shells.
Core 2 receives these operational handoffs from Core 1 and does not recreate
the originating commercial transaction. Authorized users may also use manual
intake for Service, Rental, or Sale when a Core 1 handoff is not yet available.
Manual intake creates a clearly labelled draft operational dispatch with
`manual_intake` provenance; it does not create a commercial transaction. A
later Core 1 handoff must be linked or reconciled instead of creating a
duplicate dispatch.

- The office **New dispatch** action opens an incoming-work queue. Core 1 source
  metadata routes each item to the Service, Rental, or Sales workflow without
  asking the user to choose among those categories.
- **Create direct dispatch** is the explicit fallback for work without a Core 1
  handoff. It creates a manual operational draft and preserves
  `manual_intake` provenance.
- **Review unmatched handoffs** is a separate review action, not another
  dispatch source. Queue rows show the source label, source reference, client,
  status, and the next review action.
- Incoming-work rows use pressed state, 44px touch targets, concise
  descriptions, and source-specific color only as a supporting cue.
  Authorization, source lifecycle, duplicate checks, readiness, and audit
  remain server-authoritative.
  See the [dispatch intake source graph](./Diagrams/dispatch-intake-source-graph.md).

- Office roles use dense schedules, tables, maps with list alternatives, and review rails.
- The routed dispatch schedule board opens with explicit **Day**, **Week**, and
  **Month** planning views. Day provides selected-date navigation, date-overlap
  filtering, and a 7 AM–5 PM hourly timeline; Week provides a seven-day
  resource grid; Month provides a six-row calendar with job counts and conflict
  indicators. A year view remains future scope for higher-level planning and
  reporting rather than dispatch execution.
- Drivers and operators prioritize today's assigned work, job status, safety checks, location, fuel, and sync state.
- For mobile-crane driver assignments, the field surface starts in a heavy-vehicle
  **Drive mode** with a route preview, current position, site entrance or staging
  point, ETA, and route freshness. It must not assume that a car route is safe for
  the assigned crane.
- Selecting a heavy-crane asset for a Driver assignment changes the assignment
  summary and field copy to identify the crane. Driving access alone never
  unlocks crane-operation controls; those controls are permission- and
  assignment-gated.
- Technicians prioritize inspections, maintenance tasks, blocking defects, release evidence, and handover.

The current routed workspace and richer prototype are separate implementations.
The richer role-adaptive experience is the canonical target and will be
progressively connected to live, typed Laravel data on the existing Inertia
route.

## Visual foundations

- **Typeface:** Instrument Sans, weights 400, 500, and 600.
- **Scale:** 0.75rem metadata, 0.875rem secondary UI, 1rem body, 1.125rem section heading, 1.5rem page heading.
- **Spacing:** 4px base; common steps 4, 8, 12, 16, 24, and 32px.
- **Radii:** 8px controls, 12px panels, 16px primary workspaces.
- **Motion:** 150–250ms ease-out for state change only; instant under reduced-motion preference.
- **Icons:** One consistent Lucide vocabulary.

### Color roles

- White/cool blue-gray: canvas and surfaces.
- Graphite: primary text; slate: secondary text.
- Gold `#FFBF00`: brand, primary action, selection, focus, and current
  navigation across web and field mobile.
- Warning and conflict states use semantic orange/amber tokens, distinct from
  brand gold, with explicit state text and icons. Use readable dark-orange text
  on light warning surfaces and pale orange text in dark mode.
- Cobalt: optional informational or data-series accent, not the primary brand.
- Red: blocked, critical, or destructive.
- Green: confirmed, available, or synchronized.

The shared gold family replaces the previous yellow, amber, and orange palette
in both clients. `#FFBF00` is the primary accent; supporting tints and darker
tones preserve readable text, borders, and focus states. Status badges pair
their color with explicit text and an icon; cobalt remains informational.

## Layout patterns

- Web uses a collapsible 248px sidebar and flexible workspace.
- Guided dispatch uses request context, decision workspace, and review rail.
- Schedules and maps use dense tables/rails instead of card grids.
- Manager surfaces collapse from two columns at tablet widths.
- Below 768px, field workflows become full-screen mobile layouts.
- Mobile targets are at least 44px and keep safety/sync state visible.
- Responsive web and the focused React Native field application are parallel
  capstone workstreams. They share interaction language and state vocabulary,
  but native field workflows may use platform-appropriate navigation.

### Heavy-crane driver mobile flow

- **Drive mode:** Use a compact route card on the assigned-work screen and open
  the full map for deliberate review. Show the current position, destination,
  site gate or staging area, ETA, and route freshness. If routing data supports
  them, surface heavy-vehicle constraints such as clearance, weight, access,
  or turning restrictions; do not invent restrictions that the server has not
  provided.
- While the crane is moving, keep instructions glanceable and voice- or
  haptic-friendly. Do not require typing or map panning to advance the job.
- **Park and secure:** Arrival is not the same as readiness to operate. Require
  an explicit parked-and-secured confirmation before exposing crane setup or
  operation actions.
- **Crane setup mode:** After the vehicle is secured, show the site map, setup
  point, work zone, exclusion area, hazards, and required safety checks. Keep
  operation controls blocked until all blocking prerequisites are confirmed.
- If one person has both driver and operator responsibilities, the mode switch
  must be explicit. If responsibilities are split, expose setup/operation
  surfaces only to the authorized role.
- Offline or stale maps must be labeled with their last-synced time and must not
  imply that the server accepted a status change. Provide a synchronized list
  alternative for map information.

### Assignment workspace flow

- Dispatch detail hands off to a focused setup workspace that keeps the job
  reference, schedule, site, and version visible while resources are selected.
- The setup sequence is explicit: review dispatch, assign eligible resources,
  then activate dispatch after the server readiness check passes.
- The progress map remains visible, but only the active stage is expanded.
  Completed and next stages are compact summaries that expose their status and
  one clear route into the next review or action.
- Resource selection and the save action stay together in a left work area and
  persistent review rail; current assignments and activation blockers remain
  visible without competing with the selection task. Activation details stay
  collapsed until the user opens the readiness review or the assignment is
  ready for activation.

### Field tracking preview

The dashboard preview uses one compact equipment workspace, with a narrow unit
list beside a larger map on desktop and a Map/List switch on phones. Search,
asset type, assigned jobsite, and attention filters apply to the list and map
together. Assigned jobsite is job context, not proof of a unit's GPS position.

The heading is **Field tracking**. A summary reports unit and freshness counts;
feed connection state is separate from whether equipment reports are fresh.
**Needs attention** includes delayed, stale, or offline reports and active SOS.
It must not imply a machine-health or maintenance diagnosis.

Rows lead with asset ID or personnel name, then equipment identity, assigned
jobsite when known, freshness, and report age. Selecting a unit synchronizes its
map marker and detail summary. Units without coordinates remain inspectable.
Captured and received timestamps have distinct labels, and old coordinates are
identified as last reported locations rather than current positions.

Overlapping markers expose the number of units and let the operator choose each
unit, even at identical coordinates. SOS priority determines both grouping and
the rendered anchor, keeping the urgent state with its group marker. Large
result sets retain visible cluster counts and selected-member state; an SOS
overlay opens a synchronized chooser for the units beneath it. Zoom and fit
controls stay accessible; secondary controls are grouped under **Map options**.
Map attribution, provider restrictions, and the synchronized list fallback
remain.

The interaction references are Trackunit Manager's equipment map and Cat
VisionLink's assigned-jobsite organization, adapted to the existing Core 2
visual system and supported telemetry. Do not add synthetic weather, health,
utilization, or movement claims to fill the interface.

## Component rules

- Use explicit verb–object labels such as “Activate dispatch” and “Release asset.”
- A panel uses border or elevation, not both decoratively.
- Avoid nested cards; use headings, spacing, and dividers.
- Loading uses skeletons; empty states explain the next useful action.
- Errors stay near the field/action and preserve entered data.
- Disabled actions explain the unmet rule when safe to disclose.
- Menus and dialogs escape clipping and restore focus on close.
- Confirmations name the record, consequence, and approval requirement.

## Required states

Every operational surface deliberately handles loading, empty, validation error, authorization denied, stale/concurrent update, success, disabled/safety blocked, and—where relevant—offline, queued, syncing, conflict, synchronized, live, delayed, stale, and offline telemetry.

The routed live workspace now implements loading skeletons, instructional empty
states, field validation, typed success/error notices, a two-minute stale-data
notice, explained disabled actions, and responsive navigation/detail layouts.
The assigned field route also implements a direct `Today's work` list,
44px-or-larger actions, text-and-icon status steps, inline consequence-specific
confirmation, processing lockout, success announcement, recoverable errors,
stale-version refresh, focus restoration, and a completed terminal state.
The routed tracking surface also implements MapLibre map/list views with a
configurable Stadia basemap, visible attribution, freshness filters, measured
15-second polling, location sharing, and browser outbox states for queued,
syncing, failed, conflict, and synchronized writes. Map/style/tile/WebGL
failures preserve the synchronized list alternative. Stadia Free is limited to
local development/evaluation; paid provider configuration is required before
operational deployment.
Native field offline behavior remains a later live slice.

Location presentation uses the accepted thresholds: fresh within 2 minutes,
delayed through 10 minutes, stale after 10 minutes, and offline when reported
by the client or after 30 minutes without an update.

## Accessibility acceptance

- Meet WCAG 2.2 AA contrast and semantics.
- Provide complete keyboard flow, skip navigation, and visible focus.
- Give controls accessible names/descriptions and announce async results.
- Support reduced motion and functional layouts at 200% zoom.
- Never rely on color alone for status or map markers.
- Provide a synchronized list alternative to every map.
- Preserve focus after dialogs/popovers close.

## GPT presentation

- Label output as a recommendation or proposal, not an action.
- Show reasons, assumptions, conflicts, source freshness, and model time.
- Separate “Accept recommendation” from “Activate dispatch.”
- Revalidate conflicts at acceptance time.
- Show the responsible human in history.

## Design QA checklist

- Is the next decision visible without losing job context?
- Are safety blocks and approvals unmistakable?
- Does each role see only relevant navigation and data?
- Are mobile primary actions reachable with one hand?
- Are stale, offline, and queued states visible before action?
- Is status understandable without color?
- Are fixture/prototype data and live server data clearly separated during development?

## Reusable design implementation prompt

Use this prompt when asking an implementation agent to create or refine a CT2
interface. Replace the bracketed fields and include the relevant product
documents for the workflow.

```text
You are implementing Core Transaction 2 (CT2), a safety-conscious operations
platform built with Laravel 13, Inertia 3, React 19, TypeScript, Tailwind CSS 4,
and Lucide React.

Surface or workflow: [NAME]
Primary user and context: [ROLE, DEVICE, AND OPERATING ENVIRONMENT]
Operational decision or task: [WHAT THE USER MUST UNDERSTAND OR COMPLETE]
Required data and actions: [INPUTS, OUTPUTS, AND ACTIONS]
Known constraints: [AUTHORIZATION, BUSINESS RULES, OR TECHNICAL LIMITS]

Before editing:
1. Read Docs/README.md, Docs/Design.md, Docs/phase-0-baseline.md, and the
   product documents relevant to the workflow.
2. Inspect the affected Laravel route, policy, request/action, view model,
   React components, CSS tokens, and focused tests.
3. Treat product documents as intended behavior and migrations/application
   code/tests as current implementation evidence.
4. Use Docs/consolidated/05_Design_System_Specification.md for the maintained
   standalone component, state, layout, accessibility, and content contract.
5. Treat Docs/consolidated/supplements as non-canonical recommendation sources.
   Do not copy a supplemental stack, state, target, palette, or typeface unless
   the recommendation register and canonical documents explicitly accept it.

Canonical design direction:
- Instrument Sans is the UI typeface.
- Gold `#FFBF00` owns brand, primary action, focus, selection, and active
  navigation in both clients. Semantic orange/amber is reserved for warning
  and conflict states.
- Cobalt is informational, not the primary brand.
- Warning/conflict states use explicit labels and icons with semantic
  orange/amber tokens; red remains reserved for blocked, critical, or
  destructive states.
- The interface is light-first, calm, dense where operations require it, and
  organized around the next safe decision.
- Use a 248px collapsible web sidebar and full-screen field layouts below
  768px where the workflow requires them.
- Use current tokens in resources/css/app.css; do not introduce a parallel
  blue/Inter visual system.

Required behavior:
- Keep Laravel authoritative for permissions, validation, state transitions,
  safety rules, optimistic concurrency, transactions, and audit behavior.
- Use explicit verb-object labels and name the record and consequence before
  destructive, dispatch, assignment, approval, or release actions.
- Handle loading, empty, validation error, authorization denied,
  stale/concurrent update, success, and explained disabled/safety-blocked
  states. Add queued, syncing, failed, conflict, synchronized, live, delayed,
  stale, and offline states where relevant.
- Frame GPT output as an expiring, explainable recommendation. Keep acceptance
  separate from the real operational action and revalidate before mutation.
- Keep live server data and fixture/prototype behavior visibly separate.

Accessibility and responsive acceptance:
- Meet WCAG 2.2 AA.
- Preserve complete keyboard flow, visible focus, async announcements, focus
  restoration, reduced motion, and functional 200% zoom.
- Pair status color with text and an icon or shape.
- Provide a synchronized list alternative for maps.
- Keep field targets at least 44px and safety/sync context visible.

Implementation quality:
- Reuse established Inertia, React, TypeScript, CSS, and mobile patterns.
- Do not invent backend fields, permissions, production integrations, or live
  capabilities.
- Add focused tests for externally visible authorization, validation, state,
  conflict, audit, accessibility-critical semantics, and meaningful failures.
- Update affected canonical documentation and feature maturity in the same
  change.

Before finishing, verify the relevant focused checks and report any check that
could not run.
```

The alternate blue/Inter component proposal is retained only as a
non-canonical source in the
[supplemental design-system reference](../archive/consolidated/supplements/2026-07-27-proposal/05_Design_System_Specification.md).
