# Field execution view implementation plan

## Purpose and direction

Operations managers following **Monitor field execution** must land on recorded
execution status, resource information, and field evidence instead of preparation
and activation controls. Preserve the Core 2 Instrument Sans, semantic surfaces,
gold actions, and established dispatch design authority. This is an operational
view within the existing dispatch detail route, not a new dispatch system.

## Implementation sequence

1. Inspect the detail controller/view model, existing field progression, tracking,
   activity, and assignment components. Inventory actual available evidence before
   building. Preserve unrelated working-tree edits and all server authorization.
2. Add an office execution branch for dispatched, accepted, en_route, arrived, and
   working jobs. Keep the existing operator workflow and preparation workflow.
   Make Monitor field execution target an explicit execution anchor. Preserve
   safe return URLs, initial deep links, and assignment-management access.
3. Build a focused execution view: job identity/status and schedule; actionable
   execution issues where supported; current progress; site/location evidence;
   recent recorded activity; and a compact resource/context sidebar. Use a roughly
   65/35 desktop layout and a single mobile column. Keep management secondary.
4. Render only supported facts. Separate job updated time from field-event and
   location time. Never infer arrival, completed milestones, inspection clearance,
   connection state, ETA, or live tracking from job status alone. Reuse existing
   map/tracking components if authorized job-scoped data is available; otherwise
   show honest missing-data states without fabricated markers or a decorative map.
   Do not relabel generic activation blockers as execution incidents.
5. Offer execution/resources/activity navigation only where useful real content
   exists. Manage resources must reach existing permitted reassignment and coverage
   workflows, without displaying preparation/activation banners on active jobs.
   Preserve assignment mutation safeguards and distinct status vs acceptance labels.
6. Add meaningful regression coverage for active office routing, preparation and
   operator preservation, return/deep-link behavior, restricted actions, and absent
   field evidence. Run relevant unit tests, types, lint, format, and build checks;
   verify the local Monitor field execution journey at desktop and phone widths.
7. Review with TypeScript/code/security guidance as applicable, update the dispatch
   documentation and required .ai-reports/ai-verification-questions.md with actual
   checks and limitations. No commit, push, PR, deployment, or data mutations.

## Acceptance criteria

- The supplied Working job opens an execution-focused view from the desk action.
- The execution view contains no preparation stepper or request to activate again.
- Assigned crew/equipment are readable once, and management remains reachable.
- No fake telemetry, milestone timestamps, field updates, or safety assurances.
- Loading, absent evidence, refresh failure, keyboard access, narrow layouts, and
  returning to the originating dispatch filters remain understandable and usable.
- Existing permission checks and field-operator status transitions remain intact.

## Scope boundary

Prefer existing view-model data and small cohesive components. If a missing field
requires backend exposure, use the existing authorized detail boundary and focused
tests. New telemetry integrations, automatic dispatch actions, mobile-app changes,
and redesigning history/preparation are outside this implementation.
