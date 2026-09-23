---
name: Dispatch Project Planning
description: Scoped implementation record for the existing Dispatch workspace.
colors:
  brand: "#FFBF00"
  brand-contrast: "#0F172A"
  brand-soft: "#FFF3C4"
  surface: "#ffffff"
  surface-subtle: "oklch(0.95 0.009 255)"
  ink: "#0f172a"
  ink-soft: "#475569"
  line: "oklch(0.88 0.01 255)"
typography:
  headline:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: "2rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: "1.75rem"
  body:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    lineHeight: "1.25rem"
  label:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    lineHeight: "1rem"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-contrast}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 14px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
---

# Design System: Dispatch Project Planning

## Overview

**Creative North Star: "Dependable operations instrument"**

Project plans extends the incumbent Dispatch workspace with an information-rich timeline and focused review surfaces. It retains Instrument Sans, `#FFBF00` gold emphasis, neutral surfaces, and the existing UI primitives. This is a scoped implementation record; [the shared design authority](../Design.md) remains authoritative and unchanged by this document.

The implementation follows the [project planning product specification](../../product/dispatch-project-planning.md) and [workforce boundary](../../product/core-hr-workforce-boundary.md). Runn and Rentman informed functional patterns, not an exact visual comparison or replacement identity. Core 1 project ownership and Workforce Management corporate rosters remain outside this surface.

**Key Characteristics:**

- Expandable project, phase, reservation, and maintenance hierarchy.
- Calendar-based time alignment with contained horizontal scrolling.
- Role requirements and consequences visible before confirmation.
- Existing Dispatch navigation and return context preserved.

This record was extracted on 2026-09-04 from `resources/css/app.css`, the shared UI button, form, badge and card components, `project-planning-workspace.tsx`, and its `timeline.ts`, `phase-panel.tsx`, `shared.tsx`, `coverage.tsx`, and `forms.tsx` modules. Frontmatter records the light-theme subset used here; the global stylesheet remains the implementation source and supplies semantic statuses and dark-theme overrides. The colocated [sidecar](.impeccable/design.json) is scoped documentation, not a replacement root design file.

## Colors

### Primary

Gold `#FFBF00` marks primary actions, phase bars, selected role requirements, active navigation, and keyboard focus. The soft gold surface supports selection without filling the whole workspace with accent color.

### Neutral

Surface and subtle surface separate the working area, header, panels, and review summaries. Ink carries primary content; soft ink carries dates and supporting context. Line separates aligned rows and form groups.

Semantic success, warning, and danger colors reuse the global stylesheet: reservations use success, maintenance and pending decisions use orange/amber warning accents, and rejected decisions or errors use red. Keep their visible labels and maintenance icon alongside color.

**The State Has Words Rule.** Status color accompanies readable operational state or a labeled timeline legend.

## Typography

Instrument Sans supplies the complete hierarchy. The workspace heading uses the headline role; phase titles and coverage counts use the title role. Dialog titles sit between them and body copy at 18px. Body text supports forms, row titles, and decisions; labels carry dates and supporting details. Section headings use semibold body text. Global tabular numerals keep counts and time-related data steady.

**The Decision First Rule.** Use size and weight to distinguish the phase, required counts, and action; supporting dates and references remain subordinate.

## Layout

The timeline uses a fixed 20rem label column with a flexible time region and a 760px minimum content width. Its own horizontal scroll region contains overflow on narrow screens. Workspace controls wrap, project search expands to full width on mobile, and forms move from one to two columns at the small breakpoint.

Four Week, Month, or Quarter intervals share exact timestamp boundaries between header labels, lane grid lines, and bars. Month and quarter intervals use calendar boundaries, allowing unequal proportional widths. Expanding a project reveals phases; asset reservations and maintenance sit beneath their phase.

The phase panel is a native modal dialog, full width on mobile and 30rem wide from the small breakpoint. It scrolls independently with a sticky header. Editors use a centered native dialog capped at 90dvh and 48rem, with a one-rem viewport gutter. Repeated gaps and padding follow the frontmatter spacing steps.

## Elevation & Depth

Neutral surfaces and borders carry the main hierarchy. Shared panels and buttons have restrained shadows. Modal editors and the phase panel use stronger diffuse elevation and a backdrop to establish the active task. The phase backdrop is lighter than the centered editor backdrop. Existing color transitions and reduced-motion handling come from the global stylesheet; this surface introduces no decorative motion.

## Shapes

Small corners fit timeline bars; medium corners fit compact buttons and removable crew chips. Larger corners fit fields and requirement selectors; the largest recorded corners fit panels and centered dialogs. Status badges retain the shared pill shape. The phase panel keeps a straight viewport edge and a separating border.

## Components

### Buttons and fields

Primary gold actions identify creation and confirmation. Bordered secondary actions and quiet icon controls retain the shared hover and keyboard focus treatments. Standard controls have a 44px minimum height; compact shared variants use 36px. Fields use visible labels, border changes on focus, and the shared invalid and disabled states. Errors remain visible in alert regions.

### Navigation and status

Dispatches and Project plans are adjacent views in the existing Dispatch workspace. The active view has a gold underline and a current-page state. Status badges pair compact pill surfaces with explicit state text.

### Phase panel

Baseline approval, asset allocations, and weekly crew coverage are grouped into readable sections. The native modal establishes keyboard focus containment and Escape handling; closing the panel restores focus to its connected trigger. Nested editors retain a separate modal focus boundary.

### Coverage editor

Operators, riggers, and drivers appear as requirement selectors above selected crew and eligible candidates. Counts compare selected people to required coverage. Switching roles immediately hides candidates belonging to the previous request. Loading and empty states occupy the candidate region. Recorded commitments are inspectable, and crew changes show the proposed change and approval consequence before confirmation.

### Timeline and previews

Phase, reservation, and maintenance bars share a date coordinate system. Allocation changes, including the optional drag shortcut, enter a preview before confirmation. Linked dispatch details preserve the project, phase, scale, timeline date, and coverage context for the return action. Product lifecycle rules remain in the product specification rather than being redefined as design tokens.

### Review evidence and scope

The final review disposition is **ship for the three-fix batch**: native phase-dialog mobile keyboard focus, Escape and restoration; aligned calendar ticks and grid; and immediate stale-role candidate removal. No remaining findings were reported for that batch. This is not a claim of a new whole-product audit.

The implementation handoff reports 46 Pest tests with 382 assertions, five React tests, and passing PHPStan, Pint, TypeScript, scoped ESLint, Prettier, and build checks. Browser gap replacement and linked-detail return context were verified against an isolated SQLite preview. The operational database migration was not applied; upstream Core 1/WFM integration was not validated by that walkthrough.

Captured evidence: [desktop](../../../.impeccable/review/desktop.png), [mobile](../../../.impeccable/review/mobile.png), [phase desktop](../../../.impeccable/review/phase-desktop.png), [phase mobile](../../../.impeccable/review/phase-mobile.png), and [coverage desktop](../../../.impeccable/review/coverage-desktop.png).

## Do's and Don'ts

### Do:

- **Do** retain the incumbent workspace typography, semantic colors, and shared controls.
- **Do** align timeline labels, grid lines, and bars to the same timestamps.
- **Do** put role requirements and change consequences before confirmation.
- **Do** preserve modal keyboard behavior and linked-detail return context.

### Don't:

- **Don't** treat this scoped record as authorization to replace the shared visual system.
- **Don't** present candidates from an obsolete role request as current options.
- **Don't** use color alone to explain reservations, maintenance, or approval state.

Not canonized: screenshot-specific spacing, demo content, and reference-product compositions are not reusable design rules. The sidecar's synthesized tonal ramps are visualization aids, not new application palette tokens. No unresolved defect from the reviewed three-fix batch is promoted into this system.
