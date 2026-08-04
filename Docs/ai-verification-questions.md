# Mandatory AI Quality & Security Verification Questions

**Location:** [`Docs/ai-verification-questions.md`](file:///c:/Users/User/Desktop/Core-2/Docs/ai-verification-questions.md)  
**Rule Standard:** Required analysis for every feature and sprint implementation.

---

## 1. Did you build this the most secure way?

### Security Evaluation (Sprint 3 — Device Location & Native Field Journey)
- **Token Security**: Sanctum bearer tokens are stored strictly in **Expo SecureStore** (`EncryptedSharedPreferences` on Android Hardware Keystore). No unencrypted fallback to `AsyncStorage` or memory.
- **Location Consent & Preconditions**: GPS capture requires two explicit preconditions: (1) user consent toggle, and (2) active assigned job with `can_share_location` capability enabled by the server.
- **Data Minimization**: Payloads capture only minimal required attributes: `latitude`, `longitude`, `accuracy_metres`, `sharing_enabled`, and `captured_at`.
- **Worker Isolation**: Server RBAC enforces `auth()->id()` matching. Workers cannot read or inject location telemetry for another worker's assignment (`LocationTrackingPrivacyTest`).
- **Retention**: Server scheduled job (`LocationPruningService`) automatically prunes precise location coordinates older than 30 days.

---

## 2. Did you build this the most efficient way?

### Efficiency Evaluation (Sprint 3 — Device Location & Native Field Journey)
- **Dynamic Module Import**: [`locationAdapter.ts`](file:///c:/Users/User/Desktop/Core-2/packages/field-mobile/src/native/locationAdapter.ts) uses dynamic `import('expo-location')` to prevent memory leaks or crashes in headless Node.js test runners.
- **Adaptive Telemetry Cadence**:
  - **Moving / Foreground**: 30-second interval balances real-time tracking with power draw.
  - **Stationary / Backgrounded**: 2-minute interval reduces GPS chip wakeups by 75%.
- **Outbox Serialization**: Telemetry payloads are enqueued to the local SQLite database (`CommandOutboxManager`) and replayed sequentially, preventing network flooding upon reconnect.
- **Timer Memory Leak Prevention**: `stopAutoTracking()` explicitly clears JavaScript interval handles when sharing is paused, worker logs out, or job completes.

---

## 3. What regressions could this introduce?

### Risk & Regression Analysis (Sprint 3 — Device Location & Native Field Journey)

| Potential Regression | Trigger Condition | Mitigation Implemented |
| :--- | :--- | :--- |
| **Battery Drain on Low-End Devices** | Continuous 30s high-accuracy GPS capture during long shifts. | Adaptive cadence (2min when stationary) in [`locationService.ts`](file:///c:/Users/User/Desktop/Core-2/packages/field-mobile/src/services/locationService.ts). |
| **OS Background Location Restrictions** | User grants foreground location but denies background location on Android 11+. | App falls back to foreground-only tracking and displays clear UI status text. |
| **Unhandled Permission Revocation** | User revokes location permission in Android App Settings while job is active. | `getCurrentLocation()` catches permission errors gracefully without crashing the UI thread. |
| **Outbox Memory Spikes on Multi-Day Disconnect** | Worker remains offline for days while keeping tracking active. | Max outbox queue size limits and retention cleanup policies prevent SQLite storage bloat. |

---

## 4. What tests do we need to write before we ship this?

### Shipping Verification & Test Plan (Sprint 3 — Device Location & Native Field Journey)

1. **Physical Device Background Location Journey (Maestro / Detox)**
   - Start location tracking on a physical Android 11+ phone, minimize the app or lock the screen for 10 minutes, unlock, and verify telemetry records were captured at 2-minute intervals.
2. **Mid-Shift Permission Revocation Test**
   - Enable location sharing during an active job, switch to Android Settings, revoke Location permission, return to app, and verify the app displays `"Location permission required"` without crashing.
3. **Long Offline Reconnect Stress Test (1,000+ Commands)**
   - Disconnect network for an 8-hour shift, generate 1,000+ location and progression commands, reconnect, and verify exact-once server idempotency without HTTP 413 errors.
4. **Battery & Thermal Benchmark**
   - Measure battery percentage drop over a 4-hour continuous active shift on a target device (e.g. Infinix X6815B) to ensure battery consumption remains under 15%.
