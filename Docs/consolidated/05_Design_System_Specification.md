# Core Transaction 2 — Consolidated Design System Specification

**Document status:** Consolidated product-interface specification  
**Last consolidated:** 2026-07-28  
**Design authority:** [Product Design](../Design.md),
[Phase 0 baseline decisions](../phase-0-baseline.md), and implemented tokens in
`resources/css/app.css`

## 1. Experience direction

CT2 should feel like a dependable operations instrument: decisive,
accountable, calm, information-rich, and safety-conscious. It is light-first
for bright dispatch offices and outdoor field use.

The interface prioritizes operational context and the next safe decision. It
does not use decoration to imply sophistication.

Avoid:

- decorative dashboard card grids;
- purple gradients or sparkle/AI branding;
- sci-fi control rooms and neon maps;
- ornamental motion;
- deeply nested cards;
- status communicated by color alone; and
- language implying that GPT automatically applied an operational decision.

## 2. Design principles

1. Put the next operational decision in view.
2. Preserve job, resource, owner, and consequence context around every action.
3. Explain conflicts, safety blocks, approvals, and disabled actions before
   confirmation.
4. Show freshness, sharing, current owner, synchronization, and uncertainty.
5. Adapt navigation and information density by server-provided capability.
6. Keep field actions touch-first, one-handed, and safe under poor connectivity.
7. Pair semantic color with text and an icon or shape.
8. Treat GPT as a reviewable recommendation, never an authority.

## 3. Information architecture

The top-level product structure contains five business modules:

1. Dispatch Job and Scheduling
2. Driver/Operator and Equipment Assignment
3. Fleet Management
4. Crane and Equipment Management
5. Fuel Management

Authentication, personnel administration, tracking, reports, attachments,
notifications, archive, audit, exports, and GPT assistance are shared platform
services.

Navigation is permission-filtered for usability, while Laravel remains
authoritative for access.

### Role adaptations

| Role/context | Primary information pattern |
| --- | --- |
| Dispatcher | Dense schedule, request context, eligibility/conflicts, decision workspace, review rail, tracking |
| Operations Manager | Pending approvals, live exceptions, resource conflicts, fuel decisions, review history |
| Driver/Crane Operator | Today's assigned work, one next action, safety/job context, location, fuel, sync |
| Field Technician | Inspection/maintenance queue, blocking defects, release evidence, fuel verification |
| System Administrator | Users, roles, status, credentials, audit, archived records |

The target is one role-adaptive live web shell. Prototype fixtures remain
design references until converted to typed, server-backed behavior.

## 4. Visual foundations

### 4.1 Typography

**Primary typeface:** Instrument Sans

| Token/use | Size | Weight guidance |
| --- | --- | --- |
| Metadata/caption | `0.75rem` | 400–500 |
| Secondary UI/body | `0.875rem` | 400–500 |
| Primary body/control | `1rem` | 400–600 |
| Section heading | `1.125rem` | 600 |
| Page heading | `1.5rem` | 600 |

Use tabular numerals for schedules, meters, quantities, costs, and operational
identifiers. Keep headings compact and descriptive; avoid oversized marketing
type inside work surfaces.

### 4.2 Spacing

Use a 4px base grid.

| Step | Value | Typical use |
| --- | --- | --- |
| 1 | 4px | Icon/text micro-gap, compact internal separation |
| 2 | 8px | Control groups, badge content, dense rows |
| 3 | 12px | Standard control padding, related field groups |
| 4 | 16px | Panel padding, mobile section gap |
| 6 | 24px | Section separation |
| 8 | 32px | Major workspace separation |

Prefer spacing, headings, and dividers over nesting additional containers.

### 4.3 Shape

| Element | Radius |
| --- | --- |
| Controls | 8px |
| Panels | 12px |
| Primary workspaces/dialogs | 16px |

A panel may use a border or elevation for separation, but should not stack both
decoratively.

### 4.4 Icons

Use one consistent Lucide icon vocabulary. Icons support scanning but do not
replace visible labels on critical actions or statuses.

### 4.5 Motion

- Default state-change motion: 150–250ms ease-out.
- Toast entrance may use the implemented 180ms ease-out animation.
- Avoid looping, ornamental, or spatially disorienting motion.
- Under `prefers-reduced-motion`, transitions and animations become effectively
  instant.
- Never delay validation, conflict, or safety information for animation.

## 5. Color system

Amber owns brand, primary action, selection, focus, current navigation, and the
main route/map accent. Warning/conflict uses a distinct orange-red role.
Cobalt is informational, red is critical/destructive, and green is successful
or synchronized.

The implemented CSS tokens use OKLCH:

| Token | Value | Role |
| --- | --- | --- |
| `--color-canvas` | `oklch(0.965 0.006 255)` | App canvas |
| `--color-surface` | `oklch(1 0 0)` | Primary surface |
| `--color-surface-subtle` | `oklch(0.945 0.009 255)` | Recessed/subtle surface |
| `--color-ink` | `oklch(0.18 0.03 255)` | Primary text |
| `--color-ink-soft` | `oklch(0.4 0.03 255)` | Secondary text |
| `--color-muted` | `oklch(0.42 0.025 255)` | Muted text |
| `--color-line` | `oklch(0.88 0.01 255)` | Standard border/divider |
| `--color-line-strong` | `oklch(0.78 0.01 255)` | Strong border/scrollbar |
| `--color-brand` | `oklch(0.55 0.13 72)` | Primary amber |
| `--color-brand-strong` | `oklch(0.43 0.11 68)` | High-contrast brand text/action |
| `--color-brand-soft` | `oklch(0.95 0.055 82)` | Selection/brand tint |
| `--color-brand-contrast` | `oklch(0.99 0.005 80)` | Text/icon on brand |
| `--color-success` | `oklch(0.55 0.145 151)` | Confirmed/available/synchronized |
| `--color-success-strong` | `oklch(0.36 0.105 151)` | High-contrast success |
| `--color-success-soft` | `oklch(0.96 0.035 151)` | Success tint |
| `--color-warning` | `oklch(0.56 0.17 42)` | Warning/conflict |
| `--color-warning-strong` | `oklch(0.38 0.12 38)` | High-contrast warning |
| `--color-warning-soft` | `oklch(0.95 0.045 42)` | Warning tint |
| `--color-danger` | `oklch(0.57 0.2 27)` | Blocked/critical/destructive |
| `--color-danger-soft` | `oklch(0.96 0.035 27)` | Danger tint |
| `--color-info` | `oklch(0.55 0.14 250)` | Informational/cobalt accent |
| `--color-info-strong` | `oklch(0.38 0.105 250)` | High-contrast information |
| `--color-info-soft` | `oklch(0.95 0.035 250)` | Information tint |

### Semantic rules

- Brand amber must not double as warning.
- Red is reserved for blocked, destructive, or critical outcomes.
- Green means confirmed/available/synchronized, not merely “active.”
- Information blue must not become the primary brand.
- Status badges include a text label and icon/shape.
- Map markers and routes have a synchronized list alternative and text status.
- Validate token combinations against WCAG 2.2 AA in their real component
  sizes and states.

## 6. Layout system

### 6.1 Web shell

- Collapsible 248px sidebar.
- Flexible primary workspace.
- Permission-filtered navigation and role-aware labels.
- Dense tables, schedules, timelines, maps, and review rails instead of uniform
  card grids.
- Sticky or persistent context only when it does not obscure keyboard focus or
  mobile content.

### 6.2 Guided dispatch

Use three conceptual regions:

1. Request/job context
2. Decision workspace
3. Review/approval rail

Keep schedule, requirements, selected resources, conflicts, approval state,
and activation readiness visible before confirmation.

### 6.3 Manager surfaces

- Two-column review layouts may be used at wide widths.
- Collapse to one clear sequence at tablet widths.
- Keep pending decision, requester, affected records, reason, and consequence
  in the same reading flow.

### 6.4 Field web and native

- Below 768px, field workflows use full-screen, touch-first layouts.
- Primary targets are at least 44×44px.
- Keep the next action in comfortable thumb reach.
- Preserve job identity, site, safety, progress, and sync state around the
  primary action.
- Respect safe-area insets.
- Native navigation may follow platform conventions while keeping the same
  canonical state and action language.

## 7. Component specifications

### 7.1 Buttons and actions

- Use explicit verb–object labels: “Activate dispatch,” “Release asset,”
  “Approve fuel request.”
- Use one visually dominant primary action per decision area.
- Destructive actions require clear consequence copy and an intentional
  confirmation.
- Processing disables repeated submission and retains a visible progress label.
- Disabled actions explain the unmet rule when disclosure is safe.
- Do not use icon-only controls for irreversible or uncommon actions.

### 7.2 Forms

- Associate every field with a visible label.
- Put help and validation near the relevant field.
- Preserve entered data after validation failure.
- Identify required fields in text, not only color or symbol.
- Use correct input modes and autocomplete where appropriate.
- Group schedule, location, requirements, resource, and evidence fields by
  operational meaning.

### 7.3 Tables and dense lists

- Use concise columns, sticky headers where helpful, and tabular numerals.
- Preserve row identity when horizontal space collapses.
- On narrow screens, convert rows to structured lists without losing labels.
- Support keyboard row/action access.
- Paginate or virtualize large bounded datasets; do not load unbounded history.

### 7.4 Status and progress

- Use canonical server states.
- Pair label with icon/shape and semantic color.
- Show the current state, immediate next state, and terminal state.
- Do not offer skipped or reverse transitions.
- Separate assignment response from dispatch progression.
- Explain when a state is waiting for another role or approval.

### 7.5 Conflict and safety messaging

- Name the affected person, asset, schedule, credential, maintenance block, or
  version when authorized.
- Distinguish resolvable conflict, warning, and hard safety block.
- Preserve server authority: client conflict hints never imply that a blocked
  action will be accepted.
- A stale-version message provides a direct refresh-and-review action.

### 7.6 Dialogs, menus, and popovers

- Avoid clipping within panels and scroll containers.
- Move focus into modal content and restore it to the trigger on close.
- Support Escape and complete keyboard operation.
- The confirmation names the record, action, consequence, and approval
  requirement.

### 7.7 Feedback

- Loading uses skeletons for stable page structure.
- Empty states explain why the space is empty and the next useful action.
- Validation is inline and summarized when needed.
- Success is concise and announced to assistive technology.
- Errors distinguish retryable network failure, validation, authorization,
  stale conflict, and terminal state.
- Toasts supplement persistent state; they do not carry the only explanation.

## 8. Operational state model

Every relevant surface explicitly handles:

| State | Required treatment |
| --- | --- |
| Loading | Stable skeleton or progress indicator with accessible label |
| Empty | Reason plus next useful action |
| Validation error | Field-level message, preserved data, focus/summary |
| Authorization denied | Clear safe message; no protected data leakage |
| Disabled/safety blocked | Visible rule or reason when safe to disclose |
| Stale/concurrent | Distinct conflict message and refresh/review path |
| Success | Updated authoritative state and announced feedback |
| Terminal/completed | No invalid next action; durable completion context |
| Offline | Explicit network state; no implication of server success |
| Queued | Command stored locally and awaiting replay |
| Syncing | Replay in progress with repeated submission locked |
| Failed | Retry/discard guidance based on failure class |
| Conflict | Automatic replay stopped; user reviews current server state |
| Synchronized | Server confirmation and last sync time |

## 9. Tracking presentation

### Freshness thresholds

| State | Threshold |
| --- | --- |
| Fresh | Received within 2 minutes |
| Delayed | More than 2 and up to 10 minutes |
| Stale | More than 10 minutes |
| Offline | Client reports no network or no update for 30 minutes |

### Tracking rules

- Show capture time and server receive time.
- Show whether sharing is enabled.
- Never represent stale or absent coordinates as live.
- Keep map and list selection synchronized.
- Provide filtering without hiding the freshness legend.
- Use text/icon/shape as well as marker color.
- Keep precise coordinates scoped to authorized roles and active work.

## 10. Offline and synchronization UX

- A field command visibly moves through queued, syncing, synchronized, failed,
  or conflict state.
- A durable queued command survives application restart.
- Retrying reuses the same command UUID.
- Validation/authorization failures do not retry indefinitely.
- A version conflict stops replay and shows the safe current server snapshot.
- Resolution offers refresh/review and a deliberate new action; it never
  silently forces the old payload over newer data.
- Logout/suspension explains what happens to queued commands without exposing
  sensitive payloads.

## 11. GPT presentation

- Label content “Recommendation” or “Proposal.”
- Show reasons, assumptions, conflicts, source freshness, creation time,
  expiry, and model state.
- Distinguish generation, review, acceptance, and operational activation.
- “Accept recommendation” must not visually or semantically equal “Activate
  dispatch.”
- Revalidate at acceptance and show newly discovered conflicts.
- Show the responsible human in history.
- Use neutral operational iconography; do not use sparkle branding.
- Provider errors, expiry, or timeouts fail closed and cannot look like success.

## 12. Accessibility acceptance

- Meet WCAG 2.2 AA contrast and semantics.
- Provide skip navigation and a complete logical keyboard flow.
- Use visible `:focus-visible` treatment with at least a clear 3px focus ring.
- Give controls accessible names and descriptions.
- Announce asynchronous success, failure, queue, and conflict results.
- Preserve meaningful reading and focus order as layouts collapse.
- Support reduced motion and functional layouts at 200% zoom.
- Maintain minimum 44px field targets.
- Never rely on color alone.
- Provide a synchronized list alternative for maps.
- Support forced-colors/high-contrast modes.
- Restore focus after dialogs, popovers, and destructive confirmations.

## 13. Content guidelines

### Preferred

- “Activate dispatch”
- “Approval required before activation”
- “Location received 6 minutes ago — delayed”
- “This job changed. Refresh and review before trying again.”
- “Recommendation expired. Generate a new proposal.”

### Avoid

- “Submit” when the specific action is known
- “Something went wrong” without a useful failure class
- “Live” for stale or missing telemetry
- “AI assigned these resources”
- “On hold,” “Dispensed,” or “Offline” as persisted domain states unless an
  explicit mapping is approved

## 14. Responsive acceptance

### Desktop

- Dense information remains scannable.
- Context and review rails do not force unnecessary navigation.
- Tables, maps, and schedules preserve keyboard access.

### Tablet

- Two-column manager/dispatch layouts collapse without changing reading order.
- Primary action and safety/approval state remain visible.

### Mobile web/native

- No horizontal page scrolling at 320px minimum width.
- Primary actions remain reachable and at least 44px.
- Safe-area padding prevents system UI overlap.
- Forms use platform-appropriate keyboard/input behavior.
- Status, sync, and safety context remain visible before action.

## 15. Design QA checklist

- Is the next decision visible without losing job context?
- Are safety blocks, permissions, and approvals unmistakable?
- Does each role see only relevant navigation and data?
- Are live data and prototype fixtures clearly separated?
- Are loading, empty, error, stale, disabled, offline, queued, conflict, and
  completed states present where needed?
- Are field actions one-handed and at least 44px?
- Is status understandable without color?
- Do map and list views contain equivalent operational information?
- Does every dialog/menu work by keyboard and restore focus?
- Does 200% zoom remain functional?
- Is reduced motion respected?
- Is GPT framed as advisory and human-controlled?
- Do real token/component combinations meet WCAG 2.2 AA?
