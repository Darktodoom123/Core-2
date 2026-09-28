# Office dispatch workspace

Implemented behavior, updated 2026-09-27.

Core 1 owns project management. Core 2 schedules dispatch jobs, assigns eligible
people and assets, coordinates operational coverage, and follows field execution.
Creating a local coverage record does not create or synchronize a Core 1 project.

## Daily workflow

1. **Incoming work:** review the permission-scoped, server-paginated handoff
   queue. Its total covers all eligible handoffs the current user may review;
   loading and failure states identify when only the workspace snapshot is
   visible. Use the explicit direct dispatch fallback when authorized; unsaved
   drafts retain exit protection.
   Reconciliation marks client-name similarity as a possible draft match and
   sends unmatched rental handoffs through their review screens before
   conversion. The selected handoff is isolated for review, with a way to show
   all loaded handoffs.
2. **Schedule:** the default view starts today. Search and filter permitted jobs,
   select a job, review its requirements and recorded resources, and follow its
   next action. List uses the selected day. Calendar supports day/week/month.
3. **In progress:** follow active dispatches and open their execution details.
4. **History:** search all permitted terminal dispatches and page through their recorded outcomes.

Incoming work, Schedule, In progress and History use server pagination with 25
records per page. Search, source, view and schedule interval apply before
pagination. Totals and page coverage are shown; the calendar displays the current
page and warns when the selected period has additional pages. Changing a search
filter resets the page. Search failures show Retry and identify the fallback as
a limited workspace snapshot.

“Needs attention” and “Needs assignment” counts cover the current permitted
search, source, view and schedule period. Attention filtering runs against the
complete server result set and covers pending approvals, rejected assignments,
unassigned preparation jobs, assignment overlaps, unavailable assigned assets,
and visible dispatch advisories. It summarizes recorded issues and is not a
readiness decision; the detail workflow and server activation check remain
authoritative. “Needs assignment” is available in Schedule, where it includes
drafts and preparation jobs missing either people or assets.

Schedule also contains **Resource coverage** for operating phases, equipment
reservations, crew coverage and linked shifts. Its Week/Month/Quarter timeline
is distinct from the daily dispatch calendar. See [operational coverage](dispatch-project-planning.md).

The **People & assets** panel is available independently of job selection. On wide
desktops it sits beside the work area without moving navigation down. On narrower
screens it opens a focused resource view with job identity, schedule and an
assignment link; closing restores focus to its trigger. It
defaults to the selected job's scheduled date and calls out a manually selected
date that differs from that job. It
shows permitted personnel profiles, recorded account/availability state, fleet
readiness, and commitments found in the currently loaded dispatches for a chosen
date. Missing commitments are explicitly not treated as proof of availability.
Asset rows distinguish a maintenance block, missing or failed workshop inspection clearance, and
a non-dispatchable operational status. Selecting a dispatch continues to show
its assigned personnel and assigned equipment as separate groups.
An Available asset awaiting its first workshop inspection can be selected for
planning, with that inspection shown as an activation constraint. Activation
requires a completed passing workshop inspection. A clean DVIR cannot replace
workshop clearance; a later failed inspection or defective DVIR removes it.
The operator performs the assigned job's signed pre-trip DVIR after activation,
before advancing to route or work. The Ready for service transition retains its
separate post-maintenance verification rule.

Each selected non-terminal dispatch also has **AI assistance**. Completed and
cancelled records show historical resources and recorded outcome evidence without
assignment or AI request controls. With
`OPENAI_BLOCKER_RESOLUTION_ENABLED=true`, it addresses one actionable resource
blocker at a time. For a job with a typed resource plan, it selects the first
incomplete crew role or equipment type after checking existing assignments,
then vets up to three eligible options. When there are two or three options,
OpenAI GPT-6 Luna ranks them and selects which verified fact to emphasize. The
server renders each reason from that fact. With zero or one eligible option,
the server supplies the guidance directly, without a model call or AI quota use;
the card labels this as a recorded eligibility check. **Review option** opens the
existing assignment or reassignment picker with that candidate selected. The
Operations Manager confirms the change there, and the normal authorization, version,
eligibility, conflict, safety, and approval checks still govern saving. Advice
expires after 15 minutes or when its dispatch context changes. If no eligible
option exists, the card gives manual guidance without a model call. Project
shifts guide authorized planners to **Fill coverage** in their project plan.
Approvals, permits, and safety blockers remain in the readiness workflow; AI
advice never clears them.
The blocker card shows the check time and validity window, consistent recorded
availability/credential or asset-readiness and schedule facts, and a named
review action for each option. Governance history links appear only for roles
that can open that section. The dispatch header shows a compact result state.
While the new flow is disabled, the existing `dispatch_assignment` advisory
remains the on-request workspace experience. Its AI-generated explanations
require human verification. The server rejects suggestions with clock times
outside the job's local scheduled window, hydrates proposed resource facts
from vetted candidates, and marks resources beyond recorded typed quantities
as optional and unselected. The manager may select them deliberately. Prior
recommendations stay available in governance history. The server-vetted
blocker flow is disabled by default until a controlled rollout.
Expired or stale proposals are hidden from the job card and require refresh;
manual assignment remains available. If selected resources leave typed crew or
equipment requirements unmet, the confirmation dialog names those remaining
requirements and states that saving the partial assignment does not make the
dispatch ready to activate.

Active dispatches opened through **Monitor field execution** use an execution
focused view for office users. It leads with the recorded dispatch status, recent
field reports and status events, authorized shared location evidence, and current
assigned resources. It distinguishes planned coordinates from a last shared
location and device capture time from the time received by operations. Missing or
permission limited evidence is shown explicitly. Resource reassignment and
administrative controls remain available through their existing authorization
boundaries; preparation and activation controls are not repeated for active work.

## Preparation and safeguards

The detail workflow leads with saved readiness, missing saved assignments and
actionable blockers; additional blockers remain available through a counted
disclosure. Unsaved choices are explicitly distinguished from saved readiness.
Candidate groups use compact empty states and hide unrelated types when filtered.
The existing detail workflow reviews schedule and requirements, selects resources,
and checks readiness before activation. Server authorization, eligibility,
conflicts, safety, approval, optimistic versions and audit behavior remain
authoritative. The desk summarizes recorded issues; it does not bypass checks.
The site weather panel requests Open-Meteo conditions only for pinned site
coordinates. Missing coordinates and provider failures display an unavailable
state. Weather observations do not assert ground bearing, lightning distance,
or lift clearance; site measurements and operational procedure govern those
decisions.
The preparation Resources step and the assigned-resource summary expose an
**Assign resources** entry point when the existing capability allows it. The
picker keeps Employees and Assets in one staged review, with server-backed
search and pagination, eligibility evidence, assigned-resource protection, a
persistent selection summary, and a footer action labelled **Assign selected
resources**. Reassignment uses the same picker with one compatible candidate,
keeps the current assignment visible, and leaves **End** as a separate action.

Direct manual intake records minimum crew counts by role and equipment counts
by type separately from the free-text job brief. A draft may be saved with an
incomplete minimum plan, but activation is blocked until at least one crew
role and one equipment type are recorded and active assignments satisfy every
count. The Operations Manager can revise the plan on a draft or scheduled
dispatch; the change uses the job version and requires another approval when
an approved plan is revised. Older manual jobs without a typed plan also show
a blocker and can be completed from the preparation view. Upstream service and
rental handoffs retain their source-specific requirements until their own
typed mapping is defined.

Returning from detail preserves desk date, filters and selected job. Linked
coverage dispatches retain their phase context, including after mutations.
On phones, selecting a job reveals its details with a Back to results action.
Returning restores the originating row focus and list scroll position, including
after a separate detail-page visit when session storage is available.

Field operators retain the assigned-work interface. The previous office surface
is available with `dispatch_workspace=classic` for compatibility.

Active jobs (`dispatched` through `working`) open the office **Field execution**
view. It presents the recorded job status and schedule, status milestones when
their audit events exist, authorized shared location evidence with separate
device capture and operations receipt times, recent visible field reports, and
the assigned resources. A missing event or location remains explicitly
unrecorded; job status does not imply arrival, completion, telemetry freshness,
inspection clearance, or an ETA. Resource reassignment and lifecycle controls
remain available when their existing permissions allow them, while activation
and preparation controls are omitted from this active view.

## Current limits

The initial workspace snapshot still loads at most 100 jobs, prioritizing active
and preparation work. The paginated desk search removes that limit for finding
and browsing jobs. Possible matching drafts in reconciliation are identified
from the loaded job snapshot, so a match outside that snapshot may not be shown.
People & assets commitments combine the initial snapshot and the current search
page and do not
include Core 1 reservations unless they exist in Core 2's records. Core 1
synchronization is not implemented by this interface rebuild.

## Verification

All 14 relevant browser journeys passed across focused final runs. The final
assignment test uses an independent fixture to prevent order-dependent results.
The dedicated People, Assets, and AI review journey also passes at desktop and
phone widths with scoped Axe checks. Its deterministic advisory fixture avoids a
live-provider dependency while backend and React tests cover request generation.
See [verification evidence](../../.ai-reports/dispatch-workspace-rebuild-verification.md)
and the [scoped design record](../design/dispatch-workspace/DESIGN.md).
The subsequent usability changes are recorded in
[usability verification](../../.ai-reports/dispatch-usability-verification.md).
