# Office dispatch decision flow

Last reviewed: 2026-09-25.

This is the target interaction map for the office Dispatch desk. Core 1 owns
commercial work and projects. Core 2 owns operational dispatch, resource
assignment, readiness, and field follow-through. The server remains the authority
for permission, eligibility, conflicts, approvals, safety, and activation.

## Journey

```text
Incoming work → Schedule → Prepare → Activate → In progress → History
      │             │          │          │             │
      └ direct      │          │          │             └ recorded outcome
        fallback    │          │          └ server readiness recheck
                    │          └ save people and assets; resolve blockers
                    └ select a job and inspect its next action
```

The office user enters the desk by default. `dispatch_workspace=classic` remains
an explicit compatibility route. Field roles retain their assigned-work view.
The selected job, date, source, search and page should survive a detail visit.

## Screen decisions and states

| Surface       | Dispatcher question                                               | Primary next action                           | Required context and states                                                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incoming work | Which handoff needs conversion, and does it already have a draft? | Review the handoff or possible matching draft | Show source, reference, client, site, requested time, match evidence, and count scope. Separate direct intake. Empty, loading, error and truncated results must say what was actually checked.                   |
| Schedule      | What work is planned for this day or period?                      | Select a job                                  | Show status, schedule, resources, blockers and data freshness. A calendar must identify when its visible period is incomplete. Search and filters must say whether they cover all jobs or only the current page. |
| Selected job  | What is blocking the next step?                                   | Follow the job's next permitted action        | Keep identity, source, schedule, recorded assignments and blocker consequence together. A changed or missing selection must be explicit.                                                                         |
| Prepare       | Which eligible people and assets should be saved?                 | Assign selected resources                     | Distinguish staged choices from saved assignments. Explain candidate eligibility, conflicts and rejection, with server validation on save.                                                                       |
| Activate      | Is the saved job ready now?                                       | Activate dispatch                             | Show the authoritative readiness checklist, approval state, safety blockers and version. A stale or failed attempt must offer refresh and review.                                                                |
| In progress   | What has the field recorded, and what needs office follow-up?     | Monitor or resolve an issue                   | Show recorded milestones, reports, delays, assigned resources, authorized shared location, device capture time and operations receipt time. Do not infer missing evidence or an ETA.                             |
| History       | What was the recorded outcome?                                    | Review the completion or cancellation record  | Search all permitted terminal jobs with a total and pagination; preserve return context.                                                                                                                         |

## Data confidence rule

Every count or availability statement must reveal its scope at the point of use:
all permitted records, the current result page, or a loaded snapshot. No listed
resource commitment does not prove availability. Core 1 reservations not recorded
in Core 2 are outside the resource panel. A stale workspace or failed search must
retain a visible warning and a retry path before an operational decision.

## Delivery order

1. Align the dispatcher entry route and preserve the explicit classic route.
2. Make incoming queue, attention filters, calendar, and resource date scopes clear.
3. Put possible-draft review before conversion.
4. Resolve keyboard structure and selection feedback; review desktop and phone layouts.
5. Validate the complete journey with dispatcher-role tests, large queues and periods,
   stale/error states, keyboard navigation, and live phone walkthroughs.

This record describes the target flow. Where the current implementation still has
limited data coverage, the product specification records the present behavior.
