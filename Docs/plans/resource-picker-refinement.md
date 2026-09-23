# Dispatch resource picker refinement
Date: 2026-09-08. Approved scope: design, Luna xhigh implementation in a new task, parent review, then integration only after review passes.

## Purpose and visual direction
Operate mode. Help dispatch managers compare eligible employees/equipment and confidently replace one resource or assign several. Preserve Instrument Sans, existing white/cool-gray surfaces, gold selection/primary action, semantic statuses, design tokens and all domain rules. Refine this picker only.

## Problems demonstrated in supplied screenshot
Disabled Employees (0) tab suggests unavailable functionality during equipment replacement; zero selected counts look like zero results. Oversized rows repeat Select, Eligible and maintenance boilerplate. The gold current-resource strip can imply a warning without an actual problem. Header metadata is one long run-on line. Outer body scroll and forced dialog height leave blank space below footer and push decision information offscreen.

## Desktop composition
Dialog width up to 1080px, bounded by viewport with 24px margins. Content-driven height with a maximum of viewport minus 48px; never reserve empty space after footer. Use a properly constrained flex/grid shell: header, bounded content, footer. At ordinary desktop height the list scrolls independently, while search and action footer remain visible; review rail can scroll if its content exceeds available height. Avoid nested list scroll plus outer body scroll. Inspect shared Modal before choosing a scoped sizing override; avoid changing all dialogs inadvertently.

Header: Replace equipment (or Replace operator/driver), close at right. Under it two readable metadata lines: job reference + job title; site + start/end window. Wrap naturally. Keep actual complete context accessible.

Replacement body: main candidate list (flexible) + right review column about 280px separated by a subtle divider. Remove category tabs completely for replacement; heading reads Available cranes / Available operators according to compatible type, but if all eligibility states shown use Cranes / Operators instead. Do not imply every result is available. Fixed compatible type is a short text label, not a disabled select.
Toolbar: search takes remaining width; existing Eligible only filter; result count from actual server total, clearly distinct from selection count.
List rows target about 88–104px when collapsed, naturally taller for long names/issues. Radio at left, compact icon, asset code/name primary, type/readiness secondary, ONE eligibility status aligned right. Remove redundant Select text. Neutral healthy details go in Details disclosure; meaningful blocking reason stays visible. Keep all evidence accessible. Use same hierarchy for employee role/credential/availability. No invented recommendation, capacity, distance or qualification claims. Selected row gets subtle gold background, radio/check and accessible selected state.
Review rail heading Replacement, not Selected resources with a zero badge. Current resource: code/name and type. Chosen replacement: matching identity and status, or concise Choose a resource from the list. Arrow relationship can be vertical. Reason field remains labelled, uses existing required/optional semantics, compact 3-line textarea. One clear note: current assignment remains until confirmation. No warning styling unless actual issue.
Footer spans full dialog width at its true bottom: Cancel left; concise selection/missing-selection status and Replace equipment right. Disabled button remains readable with explanation nearby. No blank tail after footer.

## Initial assignment
Retain Employees / Assets tabs only here. Counts must explicitly mean selected (e.g. Employees · 2 selected) and must not masquerade as candidate totals. Reuse compact rows with checkboxes and grouped Selected resources review rail. Preserve separate totals/pagination for each category, selections across pages/tabs/search and existing Assign selected resources action.

## Small screens and short viewports
Below 768px full-screen dialog using dynamic viewport support with fallback, safe area footer padding. Single column; review/notes accessible in an expandable Review replacement or Selected resources section in content. Never cram full review sidebar alongside list. Keep actions visible, at least 44px targets; verify 390x844 and short desktop 1280x720. Long titles/codes/reasons wrap, no horizontal overflow. Scrolling reaches every candidate, pagination and notes. Only one main vertical scroll surface on mobile. On desktop verify 1440x900 as well.

## Behavior and accessibility
Keep native labelled radios/checkboxes, keyboard navigation, focus trap/Escape/return focus, screen-reader selected state, disclosure keyboard access and existing dirty-selection handling. Search/pagination loading, errors/retry, empty results, stale candidate/version invalidation, already assigned and incompatible resources remain correct. Exactly one eligible compatible replacement required. End remains separate. No backend eligibility/permission changes, new dependencies, unsafe assignment mutations or service/environment changes.

## Implementation and review gate
Read current resource-picker.tsx, reassignment-modal.tsx, shared ui/modal.tsx, candidate types and tests. Keep changes local and preserve preexisting uncommitted execution/location/fuel edits. Add behavior tests only where changed interaction needs protection, not literal styling snapshots.
Run focused React tests, types, scoped lint/format, build and diff check. Review live desktop + mobile in one batched pass, fix defects together, confirm at most once. Do not submit actual assignments in browser.
Return exact changed files, checks, screenshot paths for desktop/mobile before selection and selected replacement if possible, and limitations. Parent must inspect diff and screenshots before approving integration. If worktree cannot host preview, explain and provide safe preview procedure; don't claim visual verification.
No commit/push/deployment. Source worktree must remain separate until parent review approves. After approval integrate only the refinement diff into saved project, preserving all other work; user has explicitly authorized this integration once satisfactory.
