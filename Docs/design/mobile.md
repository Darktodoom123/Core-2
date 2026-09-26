# Core Transaction 2 — Field Mobile Design (Native Android)

**Last updated:** 2026-09-26
**Authority:** Canonical design specification for the native field client in
`packages/field-mobile`. It extends [Design.md](Design.md); where the two differ
for the native client, this file wins. The machine-readable token layer is
`packages/field-mobile/DESIGN.md` (read by Impeccable); its colors mirror
`src/theme/tokens.ts`.

## Scope and precedence

The field client ships to Android only (`"platforms": ["android"]` in
`packages/field-mobile/app.json`). iOS-specific guidance does not apply.

When sources disagree, resolve them in this order:

1. Safety and regulatory guardrails (root `AGENTS.md`, the mobile lifecycle PRD
   safety rules).
2. Server behavior. Laravel is authoritative; code and passing tests show
   what actually happens.
3. This file.
4. [Design.md](Design.md) for shared principles, color roles, required states,
   labels, and GPT presentation.
5. Android platform conventions (Material 3).
6. Skill defaults (`expo-native-ui`, `impeccable`, `apple-design`). See
   [Skill guidance that does not apply](#skill-guidance-that-does-not-apply).

The [mobile lifecycle PRD v1.1](../prds/mobile-prd/mobile-lifecycle-v1.1.md)
defines behavior. It does not define colors or visual styling; this file does.

## Recorded decisions (2026-09-26)

| Decision | Outcome |
| :--- | :--- |
| Home-screen tile grid | Kept as the approved launcher pattern, with the rules in [Home screen tiles](#home-screen-tiles). |
| Dark HUD mode | Supported as an opt-in mode. See [Dark HUD mode](#dark-hud-mode). |
| Typeface | Android system font. Instrument Sans is not loaded on native. |
| Sales Delivery tile | Removed from scope. Core 2 does not receive or fulfill sale handoffs. |
| Warning color | Warning uses a semantic orange family, separate from brand gold. |
| Sync pill severity | `attention` (conflicts, unresolved outcomes, retryable failures, sign-in required) is a warning: orange in both modes. `failed` (a non-retryable server rejection, or an expired SOS) is critical: red in both modes. |
| Hours of Service limit color | The shift gauge and limit counter follow the DOLE flags: orange from the 9.0h warning, red at the 10.0h cap. Individual clocks turn orange at 1 hour or less remaining and red at zero. |

## Carried over from Design.md unchanged

- The six experience principles, especially: next operational decision in view,
  freshness and sync state visible, one-handed field actions, and color paired
  with text and an icon.
- Every state in [Required states](Design.md#required-states), including
  offline, queued, syncing, conflict, and synchronized.
- Component rules: verb–object labels, errors near the action, explained
  disabled actions, and confirmations that name the record and consequence.
- The heavy-crane driver flow (Drive mode, Park and secure, Crane setup mode).
- GPT presentation rules.
- Bans on decorative gradients, sparkle/AI branding, sci-fi control rooms,
  neon maps, and ornamental motion.

## Typography

- Use the Android system font (Roboto). Do not add `expo-font` or a custom
  typeface without updating this file.
- Monospace (`fontFamily: 'monospace'`) is reserved for asset codes, meters,
  counters, and telemetry values.
- Scale, in sp:

  | Role | Size | Weight |
  | :--- | :--- | :--- |
  | Metadata, captions | 12 | 400–500 |
  | Secondary UI | 14 | 400–500 |
  | Body | 16 | 400 |
  | Section heading | 18 | 700 |
  | Screen heading | 20–22 | 700 |

- **12sp is the floor.** Do not introduce text smaller than 12sp; it is not
  readable outdoors or at arm's length in a cab.
- Use weights 400, 500, and 700. Reserve 800 for the primary action label only.
- Use sentence case for action labels and body text. Uppercase is limited to
  short section labels of three words or fewer.
- Use `fontVariant: ['tabular-nums']` on changing counters (shift timers,
  elapsed hours, fuel volumes).

## Spacing, shape, and touch targets

- Units are dp. Spacing uses a 4dp base: 4, 8, 12, 16, 24, and 32.
- Radii: 8dp chips, badges, and small controls; 12dp buttons, inputs, and
  tiles; 16dp panels and cards; 24dp bottom-sheet top corners; pill shapes
  only for the bottom nav, sync pill, SOS button, and count badges.
- Depth: resting surfaces (panels, cards, tiles) use a border, not a shadow.
  Shadows are for floating layers only: bottom nav, sheets, sync pill, SOS.
- Touch targets:
  - **48dp minimum** for every interactive element. This is the Android
    baseline; the 44px figure in Design.md is the web minimum.
  - **52dp or more** for primary field actions.
  - **56dp or more** for safety-critical actions (SOS, Start Unit, lockout
    confirmations).
  - At least 8dp between adjacent targets. Operators may wear gloves.

## Color

### Sources

The client currently has two palettes:

- `src/theme/tokens.ts`, read through `useTheme()`. It has light and dark HUD
  values for every role, including the warning family.
- `src/components/nativeStyles.ts` (`colors`). It is light-only and older.

Rules for new and touched code:

- Use `useTheme()` tokens so the screen works in both modes.
- Do not add new hex literals in components. If a role is missing, add it to
  `tokens.ts` in **both** modes first, with a contrast test in
  `src/__tests__/formattersAndTheme.test.ts`.
- For warnings, use `warningOrange` (icons, borders, fills),
  `warningOrangeLight` (warning surfaces), and `warningOrangeText` (text). The
  light values equal `nativeStyles` `warning`, `warningLight`, and
  `warningDark`, so migrating a screen does not change its light appearance.
- Text in a state color uses that role's `*Text` token (`brandAmberText`,
  `successEmeraldText`, `hazardRedText`, `warningOrangeText`). The base state
  colors are for icons, borders, and fills; as small text on their soft
  backgrounds they fail WCAG AA. Icons on a soft state background (for
  example an alert icon on `hazardRedLight`) also use the `*Text` token; the
  base color is under 3:1 there in dark HUD.
- Build a component's styles with `useThemedStyles(createStyles)`, where
  `createStyles = (theme: ThemeColors) => StyleSheet.create({...})` is defined
  at module scope. One style set then covers both modes, with no `dark*`
  duplicates or `isDarkHud &&` style branches.
- A migrated screen is added to `src/__tests__/designTokenAdoption.test.ts`,
  which fails on any hex or `rgba()` literal or `nativeStyles` import in it.
  Migrated so far: `DvirScreen.tsx` and `src/screens/dvir/`, `HosScreen.tsx`
  and `src/screens/hos/`, the home header (`field-header.tsx`,
  `profile-summary.tsx`, `sync-status-pill.tsx`), the shared
  `tile-screen-header.tsx`, and the Dispatch shell (`DispatchOrdersScreen.tsx`,
  `AssignmentResponseCard.tsx`). Dispatch's `JobListItemCard.tsx` and
  `ReportDelayModal.tsx` are not migrated yet.
- The tile screen header's category eyebrow is a label, so it uses
  `textSecondary`, not gold or a per-screen accent.

### Roles

| Role | Use for | Never use for |
| :--- | :--- | :--- |
| Brand gold `#FFBF00` | Primary action fill, selection, focus, active navigation | Warnings, delayed or stale status, tile decoration |
| Gold text `#806000` | Gold-family text or icons on light surfaces (plain `#FFBF00` fails contrast as text on white) | Body text |
| Warning orange (`warningOrange*` tokens) | Warnings, conflicts, delayed telemetry, approaching limits (9.0h HoS alert) | Brand or primary actions |
| Red | Blocked, critical, destructive, SOS, hard limits exceeded, stale telemetry | Navigation or decoration |
| Green | Confirmed, cleared, available, synchronized, fresh telemetry, live sharing active | Navigation or decoration |
| Cobalt | Informational accents only | Primary actions or brand |
| Neutral slate | Surfaces, borders, secondary text, offline telemetry | Status that needs attention |

### Duty status colors

Hours of Service is the one place with a categorical palette: the ELD graph,
duty badges, and the shift log show duty type by color, always with its label
(`OFF`, `BRK`, `DRV`, `ON`, or the badge text).

| Duty status | Token | Light | Dark HUD |
| :--- | :--- | :--- | :--- |
| Operating / On duty | `dutyOnDuty` | `#134E4A` | `#67E8F9` |
| Driving | `dutyDriving` | `#2563EB` | `#60A5FA` |
| Standby | `dutyStandby` | `#6D28D9` | `#A78BFA` |
| On break | `successEmerald` | | |
| Off duty | `textSecondary` | | |

Duty colors are never gold, orange, or red, so they cannot be read as an
action, a warning, or a violation. They reach 3:1 on `surface`, and text on a
duty fill uses `textInverse`. Every pair of graph colors (break, driving, on
duty, standby), and each against gold, orange, and red, is at least 17 apart
in CIEDE2000, so the small graph dots stay tellable. Contrast alone does not
catch this: the earlier teal On Duty passed 3:1 but looked like Break green.
Both checks live in `formattersAndTheme.test.ts`. Use duty colors only for
duty type, not elsewhere.

Put dark text (`#0F172A`) on gold fills.

### Telemetry freshness

Match the web dispatch map so operators and dispatchers see the same status.
The server classifies freshness in
`apps/operations/app/Platform/Tracking/Models/LocationUpdate.php`:

| Status | Server rule | Role | Icon required |
| :--- | :--- | :--- | :--- |
| Fresh | ≤ 3 minutes | Green | Yes |
| Delayed | > 3 and < 15 minutes | Warning orange | Yes |
| Stale | 15–30 minutes | Red | Yes |
| Offline | > 30 minutes, or reported offline | Neutral | Yes |

Always show a text label and an icon with the color. Do not add glow or pulse
effects to status markers.

## Home screen tiles

The launcher grid is the approved home-screen pattern. The home screen is
`AssignedJobsListScreen.tsx`, and the grid is
`components/layout/home-tile-grid.tsx`.

- Tiles are **navigation, not status**. A tile's identity is its icon and
  label.
- Tile surfaces are neutral (`surface` with `border`). Do not give each tile its
  own decorative hue. Semantic color on a tile is limited to a status badge.
- Status on a tile uses a badge with text or a count plus a semantic color, for
  example a pending-dispatch count or "DVIR required".
- Hide tiles for features that are not shipped. Do not show them disabled.
  Drive Routes is currently hidden.
- Prefer showing every tile without horizontal scrolling. If swiping is
  unavoidable, show a visible affordance and make sure the most-used tiles
  appear first.
- Out of scope: Sales Delivery and any sales, CRM, billing, or rental-contract
  tile. The older concept image
  `mobile-operator-home-tile-refinement.png` predates this decision.

## Dark HUD mode

- Light is the default and the recommended mode for outdoor and sunlight use.
- Dark HUD is an opt-in mode for night shifts and low-light cabs, toggled from
  the field header.
- Every color role must exist in both modes and meet WCAG 2.2 AA contrast in
  both.
- Semantics do not change between modes.
- `hudGlow*` tokens mark active or selected state only. They are not decoration,
  and Design.md's ban on sci-fi control-room and neon styling still applies.

## Icons

- Render icons only through `src/components/common/Icon.tsx`. It wraps
  `Ionicons` and `MaterialCommunityIcons` from `@expo/vector-icons`.
- To add an icon, add a name to the `IconName` union. Do not import icon
  families directly in screens.
- Lucide (web) and SF Symbols (iOS) do not apply to this client.
- Icon-only controls need an `accessibilityLabel`.

## Motion and haptics

- Motion is 150–250ms and communicates state change only.
- Check `AccessibilityInfo.isReduceMotionEnabled()` and remove non-essential
  motion when it is on.
- Do not add Reanimated or another animation dependency without updating this
  file.
- Short vibration may confirm safety-critical actions (SOS hold completion,
  Start Unit). Vibration is never the only feedback.

## Android behavior

- **System back:** closes the topmost sheet, modal, or sub-view before leaving
  the screen. Keep this consistent with the existing `BackHandler` handling in
  `AppNavigator.tsx`.
- **Safe areas:** use `react-native-safe-area-context`.
- **Sheets vs dialogs:** use bottom sheets for choices, details, and pickers.
  Use dialogs only for confirmations that name the record, consequence, and
  approval requirement.
- **Permissions (location, camera, notifications):** explain the purpose before
  the system prompt, and handle the denied state with a route to settings.
  Background location copy must say that telemetry stays off until the operator
  confirms they are on site.
- **Offline:** show outbox state (queued, syncing, failed, conflict,
  synchronized) before and after an action. Never imply the server accepted a
  queued write.

## Accessibility

- Meet WCAG 2.2 AA contrast in both modes.
- Give controls `accessibilityRole` and `accessibilityLabel`, and set
  `accessibilityState` for selected, disabled, checked, and busy.
- Announce async results with `accessibilityLiveRegion` or
  `AccessibilityInfo.announceForAccessibility`.
- Never disable `allowFontScaling`. Layouts must stay correct at 130% font scale
  and remain usable at 200%.
- Never rely on color alone for status.
- Avoid gesture-only actions. The SOS 2-second hold is a deliberate safety
  design and must show visible hold progress.
- Every map has a synchronized list alternative.
- Test with TalkBack on the primary lifecycle flow.

## Skill guidance that does not apply

`expo-native-ui` is written for iOS-first projects that use expo-router. For
this client, ignore its guidance on:

- expo-router, stacks, and `expo-router/react-navigation` imports (the client
  uses its own `AppNavigator`)
- the `Color` / `PlatformColor` semantic color API (the client uses the brand
  palette above)
- SF Symbols and `expo-image` icons (use `Icon.tsx`)
- Apple Human Interface Guidelines styling
- Reanimated entering and exiting animations
- kebab-case file naming and inline-styles-only rules (match the existing folder)

Its guidance on safe-area context, `useWindowDimensions`, tabular numbers, and
selectable data text does apply.

`apple-design` does not apply. For Impeccable, `packages/field-mobile/PRODUCT.md`
records the Android platform so its native guidance loads. Its web detector and
live browser mode do not apply.

## Known deviations (migration debt)

The current code predates this file. Do not add to this debt, and fix it
opportunistically in code you touch:

- Two palettes (`theme/tokens.ts` and `components/nativeStyles.ts`). 50
  files still import the light-only `nativeStyles` colors (2026-09-27).
- 47 component and screen files contain hex literals, and `#FFBF00` appears
  245 times outside `src/theme` (2026-09-27).
- Resting panels combine a border with a shadow (`sharedStyles.panel`,
  `shadows.md`).
- `createMachinedStyles` in `src/theme/index.tsx` (uppercase "pedal" buttons and
  panels) has no callers.
- Very large screen files: `AppNavigator.tsx` is over 3,000 lines.
  `HosScreen.tsx` and `DvirScreen.tsx` were split into `src/screens/hos/` and
  `src/screens/dvir/` (largest files 667 and 737 lines); their section
  components still receive raw state setters (for example `setIsSaved`) and
  could take intent-named callbacks instead.

## Mobile design QA checklist

- Is the next action reachable with one hand, and at least 48dp (56dp if
  safety-critical)?
- Are sync, outbox, and telemetry freshness visible before the action?
- Does every status have text and an icon as well as color?
- Does the screen work in both light and dark HUD modes?
- Is all text 12sp or larger, and does the layout hold at 130% font scale?
- Does system back close the topmost layer first?
- Were any new hex literals or icon imports added outside the theme and
  `Icon.tsx`?
