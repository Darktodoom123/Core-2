# Office dispatch workspace

Implemented behavior, updated 2026-09-08.

Core 1 owns project management. Core 2 schedules dispatch jobs, assigns eligible
people and assets, coordinates operational coverage, and follows field execution.
Creating a local coverage record does not create or synchronize a Core 1 project.

## Daily workflow

1. **Incoming work:** review available source handoffs. Use the explicit direct
   dispatch fallback when authorized; unsaved drafts retain exit protection.
2. **Schedule:** the default view starts today. Search and filter permitted jobs,
   select a job, review its requirements and recorded resources, and follow its
   next action. List uses the selected day. Calendar supports day/week/month.
3. **In progress:** follow active dispatches and open their execution details.
4. **History:** search all permitted terminal dispatches and page through their recorded outcomes.

Schedule, In progress and History use a server query with 25 results per page.
Search, source, view and schedule interval apply before pagination. Total results
and the current page are shown; calendar displays the current result page too.
Changing a search filter resets the page. Search failures show a Retry action and
identify the fallback as a limited snapshot. “Needs attention on this page” uses
the page plus loaded approval/resource records; it is not a complete readiness check.

Schedule also contains **Resource coverage** for operating phases, equipment
reservations, crew coverage and linked shifts. Its Week/Month/Quarter timeline
is distinct from the daily dispatch calendar. See [operational coverage](dispatch-project-planning.md).

The **People & assets** panel is available independently of job selection. On wide
desktops it sits beside the work area without moving navigation down. On narrower
screens it opens a focused resource view with job identity, schedule and an
assignment link; closing restores focus to its trigger. It
shows permitted personnel profiles, recorded account/availability state, fleet
readiness, and commitments found in the currently loaded dispatches for a chosen
date. Missing commitments are explicitly not treated as proof of availability.
Asset rows distinguish a maintenance block, a missing inspection clearance, and
a non-dispatchable operational status. Selecting a dispatch continues to show
its assigned personnel and assigned equipment as separate groups.

Each selected dispatch also has **AI assistance**. A dispatch recommendation is
scoped to the selected job and the `dispatch_assignment` purpose, and shows its
proposed crew, equipment, rationale, and recorded constraints. A dispatcher must
review and confirm or decline it. The AI surface does not apply assignments on
its own; the server revalidates authorization, freshness, eligibility, and safety
when a recommendation is accepted.

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
The preparation Resources step and the assigned-resource summary expose an
**Assign resources** entry point when the existing capability allows it. The
picker keeps Employees and Assets in one staged review, with server-backed
search and pagination, eligibility evidence, assigned-resource protection, a
persistent selection summary, and a footer action labelled **Assign selected
resources**. Reassignment uses the same picker with one compatible candidate,
keeps the current assignment visible, and leaves **End** as a separate action.
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
and browsing jobs. People & assets commitments combine the initial snapshot and
the current search page and do not
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
