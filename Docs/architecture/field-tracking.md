# Field Tracking & Asset Telemetry Architecture

Last reviewed: 2026-09-17.

## Overview

Core-2 implements an asset-centered field tracking system that tracks operational equipment across job sites, depots, and transport routes. Telemetry is gathered from operator mobile devices (`packages/field-mobile`) and dedicated IoT/telematics devices, ingested via the Operations BFF or Redis Streams, projected in the isolated Tracking microservice (`apps/tracking`), and synchronized with the Operations dispatch workspace (`apps/operations`) via Laravel Reverb WebSockets.

---

## Core Domain Principles: Separation of Three Concepts

The tracking system enforces strict conceptual separation between three orthogonal dimensions:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ASSET TRACKING STATE MODEL                       │
├─────────────────────────┬─────────────────────────┬─────────────────────┤
│      1. ASSIGNMENT      │    2. OPERATIONAL STATUS│ 3. LOCATION FRESH   │
├─────────────────────────┼─────────────────────────┼─────────────────────┤
│ • Assigned (to Job)     │ • Available             │ • Fresh (<= 180s)   │
│ • Unassigned            │ • Working               │ • Location not      │
│                         │ • Under maintenance     │   current (> 180s)  │
│                         │ • Decommissioned        │ • No GPS report     │
│                         │                         │ • Sharing paused    │
└─────────────────────────┴─────────────────────────┴─────────────────────┘
```

1. **Assignment**: Indicates whether the asset is currently allocated to an active dispatch job (`Assigned · Job [Ref]` vs `Unassigned`).
2. **Operational Status (Availability)**: The canonical asset lifecycle state managed by fleet operations (`Available`, `Working`, `Under maintenance`, etc.).
3. **Location Freshness**: The currency and availability of reported coordinates (`Fresh`, `Location not current`, `No GPS report`, `Sharing paused`).

> [!IMPORTANT]
> **Orthogonality Invariant**: Losing location updates, experiencing network partitions, or ending operator shifts must **never** alter an asset's operational status or job assignment. Conversely, unassigning an asset must never mark it "offline" or delete its last valid position.

---

## Unassigned Asset Telemetry Rules

1. **Authorized Inventory Visibility**:
   - All authorized assets visible to the dispatcher or operations manager appear in the tracking list, even if no operator is assigned and no GPS sample has ever been recorded.
   - Display format: domain status alongside assignment badge (e.g. `Available · Unassigned`).

2. **Recorded Yard Location vs Coordinates**:
   - Assets in depot yards without GPS hardware show their recorded base location: `"Recorded location: [Yard Name]"`.
   - No map marker is placed at phantom or zero coordinates `(0, 0)`.
   - If neither GPS nor a yard location exists, the UI displays `"Coordinates unavailable"` (or `"Location unavailable"`).
   - Unassigned assets are **never** labeled "offline" merely because they are unassigned.

3. **Position Retention on Assignment End**:
   - When an asset's assignment concludes (`unassigned_at` is set or job is completed), the tracking microservice retains the asset's last valid position and timestamp.
   - Subsequent location updates from the former operator's phone (whether on a new job or on foot) do not overwrite the former asset's coordinates.
   - If a dedicated IoT/GPS device reports for an unassigned asset, its position updates continuously in real-time.

---

## Interrupted Location Updates & Freshness Degradation

1. **Thresholds & Badges**:
   - **$\le$ 180 seconds (3 minutes)**: `Fresh` (green indicator).
   - **> 180 seconds**: `Location not current` (amber badge).
   - **No telemetry / Cleared coordinates**: `No GPS report` (neutral zinc badge).
   - **Sharing explicitly disabled by operator**: `Sharing paused`.

2. **User-Facing Terminology**:
   - The ambiguous term **"Delayed"** is eliminated from user-facing surfaces to avoid confusing delayed GPS updates with delivery or job schedule delays.
   - Compact badge: `"Location not current"`.
   - Explanatory subtitle: `"No recent location updates. Last reported position; current position is unknown."`.
   - The label **"Device offline"** is reserved strictly for verified hardware disconnection signals.

3. **Non-Color Visual Cues**:
   - Outdated positions display an accessible `Clock3` icon alongside badges.
   - Tracking previews apply dashed amber borders (`border-dashed border-amber-400/40`) to highlight stale positions without relying solely on color perception (WCAG 2.2 AA compliant).
   - Always display `"Last updated [time ago]"` and the exact captured timestamp (`HH:mm:ss`) in details view.

---

## Source Attribution & Reconnection Handling

1. **Phone-Sourced Telemetry Attribution**:
   - Coordinates originating from field operator devices are annotated as `"via operator's phone"` whenever verified (`source === 'mobile' || source === 'field-mobile' || reported_via_phone === true`).
   - Dedicated hardware telematics units are attributed directly to the asset equipment.

2. **Reconnection & Outbox Ingestion**:
   - Upon network restoration, mobile clients flush cached SQLite outbox samples.
   - **Freshest Sample Wins**: Newer samples automatically restore the asset's freshness to `Fresh`.
   - **Historical Population**: Queued older samples populate the audit trail (`location_samples`) but are prevented from overwriting newer latest positions (`latest_locations.captured_at > sample.captured_at`).

3. **Temporal Assignment Window Validation**:
   - Offline queued location samples submitted with retroactive `captured_at` timestamps are strictly validated against assignment intervals:
     - The operator must have had an active `DispatchPersonnelAssignment` on the job at `captured_at` (`active_from <= captured_at` and `active_until is null or >= captured_at`).
     - The asset must have had an active `DispatchAssetAssignment` on that job at `captured_at` (`active_from <= captured_at` and `active_until is null or >= captured_at`).
   - Telemetry captured outside the active assignment interval is rejected with `HTTP 422 Unprocessable Entity`.

---

## UI Counts and Map Deduplication

- **Exactly One Entry per Asset**: The live tracking list deduplicates by `operational_asset_id`, ensuring each physical asset is listed exactly once with its latest authoritative state.
- **Differentiated Asset Counts**: Surface headers and badges explicitly distinguish total authorized assets from assets with active coordinates:
  - Header subtitle: `"X of Y assets mapped"` (e.g. `2 of 3 assets mapped`).
