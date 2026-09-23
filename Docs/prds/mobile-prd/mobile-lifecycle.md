<!-- 
  ======================================================================
  [CRITICAL: IMMUTABLE BASELINE SPECIFICATION - DO NOT MODIFY]
  This document is a locked, approved baseline specification (v1.0).
  DO NOT edit, overwrite, append, or delete this file under any circumstances.
  
  AI AGENTS & DEVELOPERS:
  If changes, extensions, edge-case expansions, or revisions are requested:
  1. Leave this file completely untouched.
  2. Create a new file with an incremented version (e.g., `PRD-Asset-Tracking-v1.1.md`).
  3. Include a change log at the top of the new file citing this baseline document.
  ======================================================================
-->

# Product Requirement Document (PRD)
## Mobile-First Field Asset Tracking & Operator Shift Lifecycle

---

## 1. Executive Summary & Objective
Enable real-time tracking of unpowered or non-GPS-equipped heavy equipment (e.g., `CRN-101`, `TRK-202`) on the central field tracking dashboard using the assigned operator’s mobile device as an active tracking proxy.

**Core Architectural Principle:** Decouple worker labor hours (**Hours of Service / HoS**) from machine tracking (**Unit Telemetry**). This ensures operators can clock in for morning meetings, travel, briefings, and inspections without falsely broadcasting their personal coordinates (e.g., home or commute) as the machine's jobsite location.

---

## 2. Master System State Machine

| Operational Phase | HoS Duty Status | Assigned Unit Status | Mobile Background GPS | Dashboard Status (Web Map) |
| :--- | :--- | :--- | :--- | :--- |
| **1. Dispatch Sent** | `Off Duty` | Dispatched (`Pending`) | Disabled | `Offline` (Gray) |
| **2. Order Accepted** | `Off Duty` | Accepted (`Awaiting Arrival`) | Disabled | `Offline` (Gray) |
| **3. Shift Started** | `On Duty` | Accepted (`Unlinked`) | Disabled | `Offline` (Gray) |
| **4. On-Site Unit Start** | `On Duty` | **Linked (`CRN-101`)** | **Active Stream** | **`Fresh` (Glowing Green)** |
| **5. Pre-Trip DVIR** | `On Duty (Operating)` | Inspected & Operating | Active Stream | **`Fresh` (Glowing Green)** |
| **6. Break / Lunch** | `Rest / Meal Break` | Linked (`Telemetry Paused`)| Paused / Standby | `Delayed` / `Stale` (Gold) |
| **7. Release / Handover** | `On Duty` | **Released (`Available`)** | **Disabled** | `Stale` (Last Known Location) |
| **8. End Shift** | `Off Duty` | Unassigned | Disabled | `Offline` / `Stale` |

---

## 3. End-to-End Operational Lifecycle

### Step 1: Dispatch Assignment Sent
* **Description:** Dispatch console creates an order and assigns an operator.
* **Office Action:** Dispatch assigns Unit `CRN-101`, jobsite destination, report time, and work scope to the operator's account.
* **Operator View:** A push notification arrives; the order populates inside the **Your assignments** card at the bottom of the mobile home screen.
* **Telemetry Status:** **OFF** (Asset remains `Offline` on the dashboard).

### Step 2: Order Acceptance or Rejection
* **Description:** Operator reviews job scope from home or depot.
* **Option A — Accept:** Operator taps `Accept Dispatch`. Dispatch dashboard updates to *Confirmed/Accepted*. Telemetry remains **OFF** (protects personal privacy). The button updates to `I'm On Site — Start Unit`.
* **Option B — Reject / Decline:** Operator taps `Decline` and selects a mandatory reason (e.g., *Sick Leave*, *Hours Conflict*). The assignment clears from the operator's app and alerts dispatch to reassign the unit.

### Step 3: Start Shift (HoS)
* **Description:** Workday labor clock begins.
* **Location:** Blue `HoS (Shift & Hours)` tile or top duty status banner.
* **Action:** Operator taps `Start Shift / Clock In`.
* **System State:** Duty status switches from *Off Duty* to *On Duty*. Shift timer and daily driving/operating limit counters begin.
* **Telemetry Status:** **OFF**. The operator is clocked in for payroll (meetings, commute, briefings), but no asset is bound yet.

### Step 4: Link Asset & Begin Telemetry
* **Description:** Operator is physically standing at the machine.
* **Location:** Bottom **Your assignments** card.
* **Action:** Operator taps `I'm On Site — Start Unit`.
* **System State:**
  * Top metadata dynamically switches from `None` (or placeholder) to `Vehicle: CRN-101`.
  * Mobile client launches a persistent background foreground service (`GPS SHARING: Live Sharing` turns active green).
* **Dashboard Update:** On the web map, `CRN-101` transitions from `Offline` to glowing green `Fresh`, centering directly on the reported site coordinates.

### Step 5: Pre-Trip Inspection (DVIR)
* **Description:** Mandatory pre-operation walk-around safety check.
* **Location:** Green `DVIR (Pre & Post Trip)` tile.
* **Action:** Operator selects *Pre-Trip Inspection*, completes safety checklists (hydraulics, tires, fluids, outriggers), attaches photos of defects if present, and signs digitally.
* **System State:** Work order updates to *Active / Inspected*; equipment is cleared for operation.

### Step 6: In-Service Operations & Break Handling
* **Description:** Continuous active field tracking during operational hours.
* **Active Work:** Phone automatically broadcasts GPS coordinates in the background under unit `CRN-101`.
* **Breaks / Lunch:** Operator switches HoS to *Rest / Meal Break*. If leaving the machine parked to eat off-site, the operator taps `Pause Telemetry` so personal errands do not alter the machine's map pin.

### Step 7: Post-Trip DVIR & Release Asset / Handover
* **Description:** Work concluded or relief crew arrives.
* **Location:** Bottom **Your assignments** card.
* **Step A (Post-Trip Check):** Operator taps `Post-Trip (DVIR)` to log ending engine hours, fuel levels, and defects.
* **Step B (Release or Handover):** Operator taps `Complete & Release Unit` (or `Handover to Relief Operator`).
* **System State:**
  * Phone GPS immediately unbinds from `CRN-101`.
  * Top vehicle metadata resets to unassigned.
* **Dashboard Update:** `CRN-101` changes from `Fresh` to `Stale / Last Known Location`, freeing the unit in the database for another operator to claim.

### Step 8: End Shift (HoS)
* **Description:** Workday closed for labor and payroll tracking.
* **Location:** Blue `HoS (Shift & Hours)` tile or top status banner.
* **Action:** Operator taps `End Shift / Clock Out`.
* **Safeguard Intercept:** If the operator forgot to release the machine in Step 7, an intercept modal displays: *"You are still linked to CRN-101. Release unit and turn off tracking?"* Tapping **Confirm** unbinds the unit automatically.
* **System State:** Duty status reverts to *Off Duty*. Daily shift hours are submitted to payroll.

---

## 4. Edge Cases & System Guardrails

### 4.1. Shift & Order Lifecycle
* **Starting Shift Without an Accepted Dispatch:**
  * *Scenario:* Operator clocks in on HoS for general yard work or maintenance before any dispatch order is created.
  * *System Rule:* Allow HoS clock-in. The bottom card displays *"Standby / No Active Dispatch"*. Vehicle remains unlinked and telemetry stays disabled.
* **Dispatch Assigned Mid-Shift:**
  * *Scenario:* Operator is already 3 hours into an On-Duty shift when a new dispatch arrives.
  * *System Rule:* Push an urgent in-app banner and sound alert. Populate the bottom card with `Accept` / `Decline`. The operator accepts without resetting their active HoS shift timer.
* **Rejecting an Order at the Last Minute:**
  * *Scenario:* Operator accepts the order at 7:00 AM, but falls ill or experiences travel issues at 7:45 AM.
  * *System Rule:* Provide a `Cancel / Relinquish Assignment` option with mandatory reason logging, available up until the moment `Start Unit` is pressed. Instantly updates the dispatch order to *Unassigned* in the central console.

### 4.2. Linking & Equipment Operations
* **Operator Taps "Start Unit" Too Early (Commute Leaks):**
  * *Scenario:* Operator accidentally taps `I'm On Site — Start Unit` while still commuting in a personal vehicle.
  * *System Rule:* Display a confirmation modal prior to telemetry activation: *"Are you physically at Unit CRN-101? Live GPS broadcasting will begin immediately."* with `[ Confirm On-Site ]` and `[ Cancel ]`.
* **Conflicting Unit Claims (Double-Booking):**
  * *Scenario:* Operator A runs late; dispatch reassigns `CRN-101` to Operator B. Operator A arrives and attempts to link to `CRN-101`.
  * *System Rule:* Check machine lock status via API. If already bound by Operator B, reject Operator A's request with an alert: *"Unit CRN-101 is actively bound to Operator B. Contact dispatch."*
* **Wrong Equipment on Site:**
  * *Scenario:* Dispatch sheet specifies `CRN-101`, but site supervisor reallocates the operator to `CRN-102` due to mechanical readiness.
  * *System Rule:* Include an override action on the assignment card: `[ Change Unit ]`. The operator selects or scans `CRN-102`, which automatically updates the record and alerts dispatch of the asset substitution.

### 4.3. Telemetry, App & Device Failures
* **Phone Battery Dies Mid-Operation:**
  * *Scenario:* Operator's phone battery depletes while operating equipment.
  * *System Rule (Dashboard):* After 3 minutes of silence, degrade status from `Fresh` to `Delayed`. After 15 minutes, transition to `Stale (Last Known Location)`. Retain the pin and the operator’s name on the asset card.
  * *System Rule (App):* Upon phone reboot, the app must auto-resume the foreground tracking service without requiring manual re-linking.
* **Cellular Dead Zones (No Signal on Remote Sites):**
  * *Scenario:* Jobsite loses cellular coverage for an extended duration.
  * *System Rule:* App caches coordinate pings and inspection forms locally via SQLite / Room / CoreData. When signal is re-established, the app automatically flushes backlogged points in compressed batches (max 100 points/payload) using the recorded device timestamps.
* **Operator Leaves Machine for Lunch / Personal Errand:**
  * *Scenario:* Operator steps away from the parked crane for lunch but forgets to pause telemetry.
  * *System Rule:* Provide a persistent `[ Pause Telemetry / Step Away ]` toggle on the home screen. If the client detects sustained walking or driving speed away from the parked coordinates, send a local push notification: *"Are you still operating CRN-101? Tap to pause tracking."*

### 4.4. Handover & Shift Closure
* **Hot-Seating / Direct Equipment Handover:**
  * *Scenario:* Day shift operator hands the running machine directly over to the night shift operator.
  * *System Rule:* Operator A taps `Handover Unit`, generating a secure 4-digit code or on-screen QR code. Operator B scans it, instantly transferring the telemetry stream and vehicle binding from Operator A to Operator B with zero coordinate drop on the dispatch map.
* **Operator Leaves Without Releasing Unit or Clocking Out:**
  * *Scenario:* Operator finishes shift at 5:00 PM and drives home with the unit still linked.
  * *System Rule (Automated Guardrail):*
    * If shift exceeds scheduled duration or 10-hour limit, send a high-priority alert: *"Shift Overrun: End shift now?"*
    * If the device registers sustained highway speeds (>60 km/h) while bound to heavy machinery, automatically pause telemetry and update dashboard status: *"Unit Auto-Paused — Potential Operator Separation"*.
* **Failed Post-Trip Inspection (DVIR Defect Flagged):**
  * *Scenario:* Operator flags a critical safety fault (e.g., hydraulic line leak) during the post-trip DVIR.
  * *System Rule:* Unbind the operator upon submission, but immediately flag the machine's dashboard status as `Out of Service / Maintenance Required`, preventing dispatch from reassigning that unit until cleared by a mechanic.

---

## 5. Regional Operating Constraints (Philippine Context)

### 5.1. Labor Compliance & Shift Architecture (DOLE Guidelines)
* **Standard Workday Baseline:** 8 hours regular working time + 1 mandatory unpaid meal break (minimum 60 minutes).
* **Duty Cap (The 10-Hour Banner Limit):**
  * Crane operators and heavy rigging specialists operate under a strict **10-hour maximum duty cycle** (8 regular hours + max 2 hours allowable overtime).
  * **System Alert:** At **9.0 hours elapsed**, trigger a high-priority warning: *"Approaching 10h Operating Limit — Prepare for Handover or Shift Closure."*
* **Night Shift Differential (NSD):**
  * For night infrastructure shifts (e.g., Metro Manila Subway, continuous foundation pours), the system must flag operating hours performed between **10:00 PM and 06:00 AM** to calculate the mandatory +10% NSD payroll differential.

### 5.2. Heavy Equipment Transit & MMDA Truck Ban Windows
For transit operations involving lowbed/flatbed units (`TRK-202`) carrying crane components or counterweights within Metro Manila:
* **Truck Ban Blackout Windows:**
  * Morning Window: **06:00 AM – 10:00 AM**
  * Evening Window: **05:00 PM – 10:00 PM**
* **Dispatch Scheduling Rule:**
  * Dispatch orders tagged as `Heavy Transit / Mobilization` must validate departure and arrival windows outside of these blackout periods (e.g., standard off-peak transit runs from **10:00 PM to 05:00 AM**).
* **Routes Tile Integration:**
  * The red **Routes (Heavy Transit)** button on the home screen should flag MMDA truck-designated routes (e.g., C-5, Roxas Boulevard, R-10) and prohibit routes crossing restricted local roads.

### 5.3. Supported Shift Profiles
1. **Day Shift (Standard Site Work):** `07:00 AM – 05:00 PM` (10 hours total: includes toolbox meeting, pre-trip DVIR, and 1-hour lunch).
2. **Night Shift (Concrete Pour / Steel Erection):** `08:00 PM – 05:00 AM` (Triggers NSD pay rules).
3. **24/7 Site Rotation (Two-Shift Split):** `07:00 AM – 07:00 PM` / `07:00 PM – 07:00 AM` (Requires the on-site hot-seating handover flow).
