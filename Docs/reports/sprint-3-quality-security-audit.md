# Sprint 3 Security, Efficiency, Regression & Testing Audit

**Document Location:** [`Docs/reports/sprint-3-quality-security-audit.md`](file:///c:/Users/User/Desktop/Core-2/Docs/reports/sprint-3-quality-security-audit.md)  
**Target Scope:** Sprint 3 — Device Location & Native Field Journey  
**Auditor / Review Model Guidance:** Designed for technical scrutiny by external reviewer models (ChatGPT / OpenAI o-series) and security leads.

---

## 1. Security Analysis — "Did you build this the most secure way?"

### ✅ Implemented Security Safeguards
1. **Sanctum Device Token Binding**: Mobile authentication tokens are stored exclusively in **Expo SecureStore** (which utilizes Android's `EncryptedSharedPreferences` backed by Hardware Keystore). No fallback to `AsyncStorage` or unencrypted state.
2. **Explicit Consent & Operational Scoping**: Precise GPS coordinates are captured **only** when two preconditions are met:
   - User has explicitly enabled location sharing via UI toggle.
   - User holds an active assigned job with the `can_share_location` capability enabled by the server.
3. **Data Minimization**: Telemetry payloads capture only minimal required attributes: `latitude`, `longitude`, `accuracy_metres`, `sharing_enabled`, and `captured_at`. Personal identifiers beyond the bearer token are excluded.
4. **Server-Side Identity Enforcement**: The Laravel backend (`LocationController.php`) strictly associates location updates with `auth()->id()`. A worker cannot inject or view location updates for another worker.
5. **Retention Policy Enforced**: Precise coordinate retention is limited to 30 days, enforced by a scheduled server pruning job (`LocationPruningService`).
6. **Input Boundary Validation**: Coordinate boundaries are validated on the server (`latitude` between -90 and 90, `longitude` between -180 and 180).

### ⚠️ Security Considerations & Potential Improvements
- **TLS Pinning**: Currently relies on standard Android system certificate validation. For high-security enterprise environments, certificate pinning could be added to prevent man-in-the-middle (MITM) proxy inspection on compromised network gateways.
- **Background Location Prompting**: Android 11+ (API 30+) requires background location (`ACCESS_BACKGROUND_LOCATION`) to be requested separately after foreground location is granted. The app ensures background permissions are checked explicitly before background tracking is enabled.

---

## 2. Efficiency Analysis — "Did you build this the most efficient way?"

### ✅ Implemented Efficiency Patterns
1. **Dynamic Module Loading**: [`locationAdapter.ts`](file:///c:/Users/User/Desktop/Core-2/packages/field-mobile/src/native/locationAdapter.ts) uses dynamic `import('expo-location')`. This avoids loading native C++ bindings or leaking memory in headless Node.js test runners or non-native web builds.
2. **Adaptive Telemetry Cadence**:
   - **Active & Moving (Foreground)**: 30-second interval balances real-time fleet map visibility with power consumption.
   - **Stationary / Backgrounded**: 2-minute interval reduces GPS chip wakeups by 75%.
3. **Outbox Batching & Serialization**: Location payloads are enqueued to the local SQLite database (`CommandOutboxManager`) and replayed sequentially, preventing network socket flooding during reconnect.
4. **Timer Memory Leak Prevention**: `stopAutoTracking()` explicitly clears JavaScript interval handles when the user pauses sharing, logs out, or completes a job.

### ⚠️ Performance Trade-offs
- **GPS Chip Power Draw**: High-accuracy mode (`Accuracy.High`) engages GPS satellites. While appropriate for active heavy equipment and delivery trucks, using `Accuracy.Balanced` (cell/Wi-Fi triangulation) when stationary could further optimize battery life.

---

## 3. Regression Analysis — "What regressions could this introduce?"

| Potential Regression Risk | Trigger Condition | Mitigation Implemented / Needed |
| :--- | :--- | :--- |
| **Battery Drain on Low-End Devices** | Continuous 30s high-accuracy GPS capture during long shifts. | Adaptive cadence (2min when stationary) implemented in [`locationService.ts`](file:///c:/Users/User/Desktop/Core-2/packages/field-mobile/src/services/locationService.ts). |
| **OS Background Location Restriction (Android 11-14)** | User grants foreground location but denies "Allow all the time". | App falls back to foreground-only tracking and displays clear status text when backgrounded. |
| **Unhandled Permission Revocation** | User revokes location permission in Android App Settings while job is active. | `getCurrentLocation()` catches permission errors gracefully without crashing the React Native UI thread. |
| **Outbox Memory Spikes on Multi-Day Disconnect** | Worker remains offline for several days while keeping tracking active. | Max outbox queue size limits and retention cleanup policies prevent SQLite storage bloat. |

---

## 4. Shipping Test Requirements — "What tests do we need to write before we ship this?"

Before shipping Sprint 3 to production physical devices, the following test scenarios must be executed:

### 1. Physical Device Background Location Journey (Maestro / Detox)
- **Scenario**: Start location tracking on a physical Android 11+ phone, minimize the app or lock the screen for 10 minutes, unlock, and verify telemetry records were captured at 2-minute intervals.

### 2. Mid-Shift Permission Revocation Test
- **Scenario**: Enable location sharing during an active job, switch to Android Settings, revoke Location permission, return to app, and verify the app displays `"Location permission required"` without crashing.

### 3. Long Offline Reconnect Stress Test (1,000+ Commands)
- **Scenario**: Disconnect network for an 8-hour shift, generate 1,000+ location and progression commands, reconnect, and verify exact-once server idempotency without HTTP 413 (Payload Too Large) errors.

### 4. Battery & Thermal Benchmark
- **Scenario**: Measure battery percentage drop over a 4-hour continuous active shift on a target device (e.g. Infinix X6815B) to ensure battery consumption remains under 15%.
