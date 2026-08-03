# Real-Time Workspace Architecture (Laravel Reverb & Echo)

## Overview
This document specifies the technical architecture for transitioning the Core-2 Operations Workspace from polling/manual-refresh to **real-time event-driven updates** using **Laravel Reverb** (WebSockets) and **Laravel Echo**.

---

## Component Architecture

```
[ Domain Actions / Mutations ]
          │
          ▼
[ Laravel Event Dispatcher ]
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
Whenever operational resources (jobs, assets, locations, approvals, fuel requests) undergo state transitions, Laravel dispatches broadcast events on private channels.

#### Private Workspace Channel
* **Channel Name:** `private-operations.workspace`
* **Authorization Gate:** User must have operational capabilities (`operations.workspace.access` or authenticated user with active roles).

#### Broadcast Events
1. `App\Events\WorkspaceUpdated`
   * **Payload:** `resource_type` (`job` | `asset` | `fuel` | `location` | `approval`), `action` (`updated` | `created` | `deleted`), `timestamp`.
   * **Trait:** `Illuminate\Broadcasting\InteractsWithSockets`, `Illuminate\Contracts\Broadcasting\ShouldBroadcastNow` (for zero-latency queue bypass).

---

## 2. Frontend Integration

### Laravel Echo Setup (`resources/js/echo.ts`)
* Instantiates `LaravelEcho` with `pusher-js` configured for Laravel Reverb (`wsHost`, `wsPort`, `forceTLS`, `enabledTransports: ['ws', 'wss']`).

### Workspace Subscriber ([workspace.tsx](file:///c:/Users/User/Desktop/Core-2/resources/js/pages/workspace.tsx))
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
