# Core Transaction 2 — Design System Proposal

**Document class:** Supplemental source — normalized reference edition  
**Source version:** 1.0  
**Source date:** 2026-07-27  
**Original status:** Draft for Design Review  
**Imported:** 2026-07-30  
**Authority:** Alternative visual system and component recommendation source  
**Review register:** [Recommendation register](../RECOMMENDATION_REGISTER.md)

## 1. Source principles

The proposal emphasizes:

1. operational awareness;
2. speed over decoration;
3. hierarchy through structure;
4. consistent language and behavior;
5. progressive disclosure; and
6. WCAG 2.1 AA accessibility by default.

These principles largely align with the canonical design direction. CT2 now
targets WCAG 2.2 AA.

## 2. Alternative visual foundations

The source proposes:

- blue `#0D5A99` as primary action color;
- Inter for UI text and JetBrains Mono/Fira Code/SF Mono for code;
- a 4 px spacing foundation;
- 6/8/12/16/20 px radii;
- light and dark neutral systems;
- semantic green/orange/red/blue status colors;
- 100–400 ms motion durations;
- Lucide React icons; and
- dark mode.

Blue and Inter are not canonical. Accepted CT2 direction uses amber for brand
actions/focus/selection and Instrument Sans. The spacing, radius, motion, icon,
and semantic-role ideas may be compared individually with implemented tokens.

## 3. Source status mapping

The source visually maps New Request, Pending Review, Approved, Scheduled,
Assigned, Dispatched, On Route, Arrived, Working, Completed, Closed,
Cancelled, Delayed, and Critical.

Presentation labels must derive from canonical Laravel state values. Delayed
and Critical may be conditions rather than persisted dispatch states; Closed is
not a canonical dispatch state.

## 4. Component recommendations

### KPI cards

The source recommends a metric name/value/trend/detail anatomy, 40 px icon
container, 12 px radius, 24 px padding, and subtle hover lift. Use selectively:
canonical CT2 prefers decision-oriented workspaces over generic card grids.

### Data tables

Recommended behavior includes:

- search, filters, export, add action, sorting, selection, pagination;
- 56 px rows and hover/selected states;
- inline actions;
- skeleton loading; and
- actionable empty states.

Behavior is reusable after adapting to canonical tokens and real permissions.

### Dispatch cards and Kanban

The source recommends 280 px cards with priority, job reference, client,
location, time, assignments, assets, progress, and estimate, plus drag feedback.
Any drag/drop experience needs a keyboard-accessible alternative and canonical
state/authorization enforcement.

### Status chips

The source recommends compact pill labels with a dot and semantic color. CT2
requires text and an icon/shape so color is never the only signal.

### Side panels and dialogs

Recommended behavior includes sticky context/actions, focus trapping, Escape
handling, focus restoration, responsive full-width mobile presentation,
explicit destructive consequences, and restrained entry motion.

### Toasts and feedback

The source recommends semantic toasts with bounded stacking and persistent
warning/error messages. Canonical CT2 also requires persistent inline state;
toasts must not carry the only explanation.

### Forms and buttons

Recommended behavior includes visible labels, helper/corrective text, strong
focus, loading/disabled variants, explicit button hierarchy, and 40–48 px
controls. Field mobile targets remain at least 44 px.

### Calendar and timeline

The source proposes 15-minute timeline increments, assignment/availability
blocks, overlap treatment, priority cues, and resize/drag behavior. Reuse
interaction concepts only with server conflict revalidation and non-color
indicators.

### Map markers

The source proposes job, resource, and cluster markers with selection rings,
tooltips, direction/status cues, and count scaling. Canonical CT2 additionally
requires a synchronized list alternative and freshness/sharing state.

## 5. Source layout proposal

The source specifies:

- 64 px top navigation;
- 256 px expanded and 72 px collapsed sidebar;
- 32 px content padding and 1920 px maximum;
- a 12-column grid with 24 px gaps; and
- responsive breakpoints below 640, 640, 768, 1024, 1280, and 1536 px.

Canonical web shell uses a 248 px expanded sidebar and role/density patterns in
[Product design](../../../Design.md). Exact dimensions are implementation
decisions, not independent source authority.

## 6. Accessibility recommendations

Reusable source guidance includes:

- semantic HTML and accessible names;
- visible focus and logical tab order;
- Enter/Space/Escape/arrow behavior;
- table-header associations;
- modal focus traps and restoration;
- live regions for asynchronous feedback;
- minimum contrast;
- color-independent status; and
- `prefers-reduced-motion`.

Normalize all acceptance to WCAG 2.2 AA, 200% zoom, synchronized map/list
information, and current project testing practices.

## 7. Proposed component organization

The source suggests design tokens, primitive/composite/layout components,
theme/toast/modal hooks, and a typed class-name utility. Reuse existing
`resources/js` and `resources/css` conventions instead of creating a second
application root.

## 8. Initial disposition

| Proposal family | Initial disposition |
| --- | --- |
| Operational principles | Accepted/duplicate |
| Blue primary palette | Rejected as canonical |
| Inter typeface | Rejected as canonical |
| Dark mode | Deferred/needs evidence |
| Component anatomy | Accepted with changes |
| Keyboard, focus, reduced motion | Accepted with WCAG 2.2 normalization |
| Generic KPI grid | Use selectively |
| Schedule/drag patterns | Needs server-authoritative and keyboard behavior |
| Map markers | Accepted with freshness and list requirements |
| Token/component folder taxonomy | Adapt, do not duplicate |

## 9. Canonical destination

Use the maintained
[Consolidated design system](../../05_Design_System_Specification.md),
[Product design](../../../Design.md), [Phase 0 baseline](../../../phase-0-baseline.md),
and implemented `resources/css/app.css` tokens before applying any source
recommendation.
