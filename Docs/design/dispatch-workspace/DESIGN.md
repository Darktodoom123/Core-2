---
name: Core 2 dispatch workspace
description: Scoped visual record of the office dispatch desk
colors:
  brand: '#FFBF00'
  brand-soft: '#FFF3C4'
  brand-contrast: '#0F172A'
  canvas: '#f8fafc'
  surface: '#ffffff'
  ink: '#0f172a'
  ink-soft: '#475569'
  line: 'oklch(0.88 0.01 255)'
typography:
  heading:
    fontFamily: 'Instrument Sans, ui-sans-serif, system-ui, sans-serif'
    fontSize: '24px'
    fontWeight: 600
  body:
    fontFamily: 'Instrument Sans, ui-sans-serif, system-ui, sans-serif'
    fontSize: '14px'
    lineHeight: '20px'
rounded:
  control: '8px'
  panel: '12px'
spacing:
  compact: '8px'
  panel: '16px'
  section: '24px'
---

# Dispatch workspace design record

## Overview

Updated 2026-09-23 from the implemented office workspace. This scoped record
extends [the shared design authority](../Design.md); it does not replace it.
The interface is a light operations desk with a compact job list and one selected
job panel. Gold `#FFBF00` identifies selection and primary actions; operational content
sets the hierarchy.

## Colors

Use the shared semantic palette from `resources/css/app.css`. White surfaces sit
on a cool canvas. Ink carries readable text, soft ink carries metadata, and gold
with contrasting dark text identifies the primary action. Status and blocker
colors retain the shared semantic meanings. Dark-mode tokens remain inherited;
warning accents use semantic orange/amber, distinct from brand gold. The final
screenshot review covered light mode only.

## Typography

Instrument Sans is the shared face. Desk headings use a restrained 24px scale,
job headings 20px, controls and body text 14px, and metadata 12px. Meaningful
section headings carry hierarchy without decorative eyebrow labels.

## Layout

The four work views precede filters and the schedule display controls. At the
large breakpoint, List uses a minimum 16rem job column and a wider flexible detail column.
At phone widths, navigation forms two columns and explicit job selection opens
a focused detail view with Back to results, retaining list position and focus.
People & assets sits alongside the work area at the extra-large breakpoint and
replaces the work area with a focused resource view below that breakpoint. The
resource view retains the selected job identity, schedule, and assignment link.
Controls wrap without clipping the work views. Resource coverage owns
its timeline and phase panel; the ordinary job-review panel is absent there.

## Elevation & Depth

Dividers and contrasting surfaces organize the desk. Existing selected-job and
preparation panels retain subtle shared shadows. Do not turn every section into
an elevated card or introduce decorative depth.

## Shapes

Controls generally use 8px corners, review panels 12px. Compact pills identify
statuses. Lucide icons retain the shared stroke style.

## Components

- Work-view buttons retain visible selection and `aria-current` state.
- Schedule display controls expose List, Calendar, and Resource coverage.
- Search, source, attention and date controls keep the user's selection in the URL.
- Job rows combine identity, site, recorded resources, schedule and next action.
- People & assets uses one date, a resource-type switch, search, recorded
  availability/readiness, and loaded commitments. Warning copy names the missing
  readiness condition instead of combining contradictory status labels.
- The selected job shows requirements, separate assigned-personnel and
  assigned-equipment groups, review issues and one primary next-action link. It
  does not certify activation readiness.
- Active office jobs use a focused execution view with a roughly 65/35 main and
  context split on desktop and one column on phones. The view anchors to
  `#field-execution`, keeps assigned resources in a secondary context rail, and
  shows only recorded milestones, reports, and authorized shared locations.
  Capture and receipt timestamps remain separately labeled; absent evidence is
  described as unavailable rather than inferred from dispatch status.
- AI assistance follows the selected job. Suggested crew and equipment remain
  visually subordinate to recorded assignments and require an explicit human
  review action before the existing server workflow can apply them.
- Monitor field execution opens an execution view for active office dispatches.
  Its desktop composition uses a wide execution column with recorded progress,
  site/location evidence, and recent activity beside a compact context and
  assigned-resource column. Mobile stacks execution overview, progress, resources,
  site evidence, and activity in that order. Planned coordinates, authorized last
  shared location, device capture time, and operations receipt time remain distinct;
  absent evidence receives an explicit empty state.
- Preparation uses the existing review → resources → activation sequence.
- Saved readiness and blockers precede preparation steps. Unsaved choices are
  labeled; remaining blockers use a counted disclosure. Empty candidate groups
  stay compact and only matching categories appear after type filtering.
- Server result totals and pagination describe all matching permitted jobs;
  attention checks and resource commitments retain explicit loaded-record scope.
- Inputs and buttons retain visible keyboard focus and shared disabled states.

## Do's and Don'ts

- Do keep status, blocker and next action together.
- Do preserve the shared color roles, typography and responsive wrapping.
- Do distinguish Core 1 project ownership from Core 2 operational coverage.
- Don't repeat preparation headings as decorative labels above headings.
- Don't imply that loaded desk counts represent the complete dispatch database.

Evidence: source under `resources/js/components/workspace/dispatch-desk/`,
`resources/js/pages/dispatch-detail.tsx`, and the shared stylesheet. Captures are
under `.impeccable/review/dispatch-*.png`. Independent visual review covered
filtered Schedule with pending approval, preparation candidates, and desktop
coverage. Its named eyebrow-label correction was scored resolved. The resources
increment was inspected at 1440px and 390px with People, Assets, selected
assignments, and a ready-to-review AI suggestion. Other view content and mobile
preparation/coverage have no independent visual sign-off.
