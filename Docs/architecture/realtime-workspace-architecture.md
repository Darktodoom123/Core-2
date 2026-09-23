# Real-Time Workspace Architecture (Laravel Reverb & Echo)

## Overview
This document specifies the technical architecture for transitioning the Core-2 Operations Workspace from polling/manual-refresh to **real-time event-driven updates** using **Laravel Reverb** (WebSockets) and **Laravel Echo**.

---

## Component Architecture

```
[ Domain Actions / Mutations ]
          │
          ▼
[ Laravel Event Bus ]
          │ (ShouldBroadcastNow)
          ▼
[ Laravel Reverb WebSocket Server ] (Port 8080)
          │
          ▼ (wss:// or ws:// connection)
[ Laravel Echo (Frontend) ]
          │
          ▼
[ Inertia router.reload({ preserveScroll: true }) ]
```

---

## 1. Backend Architecture

### Event Broadcasting Strategy
Whenever operational resources (jobs, assets, locations, approvals, fuel requests, SOS incidents) undergo state transitions, Laravel dispatches broadcast events on private channels.

#### Private Reverb Channels (`routes/channels.php`)

1. **`operations.workspace` Channel**:
   * **Channel Name:** `private-operations.workspace`
   * **Authorization Gate:** Active, non-suspended, email-verified user holding an operational role (`System Administrator`, `Operations Manager`, `Operator`).
   * **Broadcast Events**:
     - `App\Platform\Workspace\Events\WorkspaceUpdated` (`resource_type`, `action`, `timestamp`)
     - `App\Modules\Dispatch\Events\DispatchExecutionTransitioned` (`attempt_id`, `from_status`, `to_status`, `version`)
     - `App\Modules\Dispatch\Events\DispatchOutboxMessageDelivered` (`outbox_message_id`, `event_type`)

2. **`operations.sos` Channel**:
   * **Channel Name:** `private-operations.sos`
   * **Authorization Gate:** Active, verified, non-suspended user with the `sos.view` permission.
   * **Broadcast Events**:
     - `App\Platform\Safety\Events\SosIncidentChanged` (`incident_id`, `status`, `action`, `timestamp`)

3. **`operations.safety` Channel**:
   * **Channel Name:** `private-operations.safety`
   * **Authorization Gate:** Active, verified, non-suspended user holding an operational role (`System Administrator`, `Operations Manager`, `Operator`).
   * **Broadcast Events**:
     - Real-time statutory safety updates: hazard notices, critical lift approvals, toolbox meeting cosignings, and stop-work orders.

---

## 2. Frontend Integration

### Laravel Echo Setup (`resources/js/echo.ts`)
* Instantiates `LaravelEcho` with `pusher-js` configured for Laravel Reverb (`wsHost`, `wsPort`, `forceTLS`, `enabledTransports: ['ws', 'wss']`).

### Workspace Subscriber ([workspace.tsx](../../apps/operations/resources/js/pages/workspace.tsx))
* In `useEffect()`, subscribes to `Echo.private('operations.workspace')`.
* On receiving `WorkspaceUpdated`:
  * Triggers `router.reload({ preserveScroll: true, preserveState: true })`.
  * Resets `refreshed_at` timestamp.
  * Clears any stale workspace notice seamlessly.

---

## 3. Development & Operations Setup

### `composer.json` / `composer dev` Command
Updates `composer dev` script to run the WebSocket daemon concurrently:

```json
"dev": [
    "Composer\\Config::disableProcessTimeout",
    "npx concurrently -c \"#93c5fd,#c4b5fd,#fdba74,#f472b6\" \"php artisan serve\" \"php artisan queue:listen --tries=1\" \"php artisan reverb:start\" \"npm run dev\" --names='server,queue,reverb,vite'"
]
```

---

## 4. Fallback & Graceful Degradation
* If the WebSocket connection drops or fails to connect, the system falls back gracefully to the existing **Stale Notice Banner** and manual refresh button.
* Reconnect attempts run exponentially in the background. The explicit **Reconnect & Refresh** action asks the existing Pusher client to reconnect immediately before refreshing current workspace data.
* The private channel authentication route is registered from `routes/channels.php` and authorizes only active, verified, non-suspended users with an operational role.
