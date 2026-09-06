# Test Infrastructure: Web Dispatch & Operations Workspace Parity

**Document**: Test Infrastructure Specification (`TEST_INFRA.md`)  
**Project Root**: `c:\Users\User\Desktop\Core-2\TEST_INFRA.md`  
**Author**: E2E Test Suite Designer & Test Writer (`teamwork_preview_test_writer_e2e_3`)  
**Authoritative References**: `ORIGINAL_REQUEST.md` (## 2026-09-06T16:27:30Z), `PROJECT.md`, `AGENTS.md`

---

## 1. Test Philosophy

- **Opaque-Box & Requirement-Driven**: Tests are derived strictly from specifications and interface contracts in `ORIGINAL_REQUEST.md` and `PROJECT.md`, validating externally observable behavior, state transitions, validation errors, and database outcomes rather than internal method implementations.
- **Production Parity**: Replaces prototype simulation mocks and sandbox state with live Laravel backend domain integration across Hours of Service (`App\Modules\HoursOfService`), Safety DVIR (`App\Modules\Dvir`), Fuel Management (`App\Modules\Fuel`), and Job Reports (`App\Platform\Reporting`).
- **Safety & Regulatory Compliance**: Enforces Philippine Department of Labor and Employment (DOLE-OSHC) 10-hour operating limit guardrails, automatic equipment lockout upon critical safety defect detection, and strict segregation of duties (self-approval prevention).
- **Isolation & Reproducibility**: Each test utilizes Laravel's `RefreshDatabase` trait for per-test transaction rollbacks, deterministic role seeding via `RolePermissionSeeder`, and controlled time travel via Laravel's `$this->travel()`.

---

## 2. Feature Inventory Coverage Matrix (Tiers 1–4)

| # | Feature | Requirement Source | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Workload) | Target Modules |
|---|---------|-------------------|:---:|:---:|:---:|:---:|---|
| 1 | Live Operator Binding & Telemetry Proxy | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ | `Modules/Assignment`, `Platform/Workspace` |
| 2 | Equipment HoS Clocks & Duty Progression | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | ✓ | `Modules/HoursOfService` |
| 3 | DOLE 10h Fatigue Warnings (9h / 10h Cap) | ORIGINAL_REQUEST §R1 | ✓ | ✓ | — | ✓ | `Modules/HoursOfService` |
| 4 | Pre/Post-Trip DVIR Badges & Checklists | ORIGINAL_REQUEST §R1 | ✓ | — | ✓ | ✓ | `Modules/Dvir` |
| 5 | 4-Angle Walkaround Defect Photos (R2/CDN) | ORIGINAL_REQUEST §R1 | ✓ | ✓ | — | ✓ | `Modules/Dvir`, `Platform/Storage` |
| 6 | Critical Defect Automatic Lockout | ORIGINAL_REQUEST §R1, AC | ✓ | — | ✓ | — | `Modules/Dvir`, `Shared/Assets` |
| 7 | Managerial Safety Lockout Override | ORIGINAL_REQUEST §R1 | ✓ | ✓ | ✓ | — | `Shared/Assets`, `Platform/Workspace` |
| 8 | Web Fuel Requests CRUD & 5-Stage State Machine | ORIGINAL_REQUEST §R2 | ✓ | ✓ | — | ✓ | `Modules/Fuel` |
| 9 | Comprehensive Refueling Log & Meters (PHP Cost, Stn) | ORIGINAL_REQUEST §R2 | ✓ | ✓ | ✓ | ✓ | `Modules/Fuel` |
| 10 | Monotonic Meter Validation (Odometer / Hours) | ORIGINAL_REQUEST §R2, BR | ✓ | ✓ | — | — | `Modules/Fuel` |
| 11 | Fuel Consumption Variance & 15% Anomaly Alerts | ORIGINAL_REQUEST §R2 | ✓ | ✓ | — | — | `Modules/Fuel` |
| 12 | Fuel Role Gating & Self-Approval Prevention | ORIGINAL_REQUEST §R2, BR | ✓ | ✓ | — | — | `Modules/Fuel`, `Platform/Identity` |
| 13 | Rich Job Reports Display & Submission | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ | ✓ | `Platform/Reporting` |
| 14 | Standby & Demurrage Delay Classification | ORIGINAL_REQUEST §R3 | ✓ | — | ✓ | ✓ | `Modules/HoursOfService`, `Platform/Reporting` |
| 15 | Client Digital Sign-Off with Geolocation | ORIGINAL_REQUEST §R3 | ✓ | ✓ | — | ✓ | `Platform/Reporting` |
| 16 | Supervisory Review & Job Auto-Completion | ORIGINAL_REQUEST §R3 | ✓ | ✓ | ✓ | ✓ | `Platform/Reporting`, `Modules/Dispatch` |
| 17 | Cross-Referencing Operational Records | ORIGINAL_REQUEST §R3 | ✓ | — | ✓ | ✓ | `Platform/Workspace`, `Platform/Reporting` |

---

## 3. Test Architecture & Execution Commands

```
+-----------------------------------------------------------------------------------------+
|                                4-Tier Test Architecture                                 |
+-----------------------------------------------------------------------------------------+
| Tier 1: Feature Coverage       | Core endpoints, state machines, and calculations       |
| Tier 2: Boundary & Corner Cases| Input validation, non-monotonic meters, 15% threshold, |
|                                | DOLE 9h/10h boundaries, self-approval prevention        |
| Tier 3: Cross-Feature Combos   | Lockout blocking dispatch, job report auto-completing   |
|                                | job, fuel log advancing meters, demurrage linking      |
| Tier 4: Real-World Scenarios   | Multi-step full workday operational shift lifecycle    |
+-----------------------------------------------------------------------------------------+
```

### 3.1 Primary Test Suite
- **File Path**: `tests/Feature/Operations/WebOperationsWorkspaceParityTest.php`
- **Framework**: Pest 4.x / PHPUnit on Laravel 13
- **Database Strategy**: `Illuminate\Foundation\Testing\RefreshDatabase` (per-test transaction rollback)
- **Role Permissions**: `Database\Seeders\RolePermissionSeeder` deterministically seeded in `beforeEach()`

### 3.2 Execution Commands
```bash
# Run the complete Web Operations Workspace Parity suite
php artisan test tests/Feature/Operations/WebOperationsWorkspaceParityTest.php

# Run with filter by specific tier
php artisan test --filter="Tier 1" tests/Feature/Operations/WebOperationsWorkspaceParityTest.php
php artisan test --filter="Tier 2" tests/Feature/Operations/WebOperationsWorkspaceParityTest.php
php artisan test --filter="Tier 3" tests/Feature/Operations/WebOperationsWorkspaceParityTest.php
php artisan test --filter="Tier 4" tests/Feature/Operations/WebOperationsWorkspaceParityTest.php

# Run full operations domain regression checks
php artisan test --filter=Hos
php artisan test --filter=Dvir
php artisan test --filter=Fuel
php artisan test --filter=JobReport
```

---

## 4. Detailed Tier Descriptions

### Tier 1: Feature Coverage (Happy Path)
Verifies baseline functional contracts across all operations domains:
- **Operator Binding & Telemetry**: Active operator shift linked to asset with telemetry status (`Fresh`, `Delayed`, `Stale`, `Offline`).
- **HoS Duty Clocks**: Dynamic calculations of shift duration, operating/driving minutes, remaining drive window, and break countdowns.
- **DOLE Fatigue Warnings**: DOLE 9.0h warning flag activated when shift elapsed hours reach or exceed 9.0h.
- **DVIR Inspections & Walkaround Photos**: Pre-trip and post-trip inspections stored with 4 exterior angles (`front`, `back`, `driver_side`, `passenger_side`) and checklist categories (`hydraulics`, `electrical`, `structural`, `safety_devices`).
- **Fuel Request State Machine**: 5-stage transition (`Submitted` → `Forwarded` → `Approved` → `Verified` → `Logged`).
- **Refueling Log & Metrics**: Logging dispensed liters, price per liter, total PHP cost, vendor fuel station, and receipt attachment.
- **Job Reports & Digital Signatures**: Submission persisting ending meters, work summary, client signer name, role, timestamp, and GPS coordinates.
- **Standby Delays**: Demurrage classification (`waiting_on_client`, `waiting_on_concrete`, `site_access_blocked` marked billable).

### Tier 2: Boundary & Corner Cases (Negative & Edge Conditions)
Verifies error prevention, data validation, and threshold edge boundaries:
- **Empty / Zero / Negative Inputs**: Rejecting empty work summaries, zero or negative fuel volumes, and negative meter inputs.
- **Monotonic Meter Validation**: Rejecting odometer or hour meter inputs that are lower than the asset's current meter reading.
- **Segregation of Duties (Self-Approval Prevention)**:
  - Requesters cannot approve or reject their own fuel requests (`AuthorizationException`).
  - Authors cannot review or approve their own job reports (`AuthorizationException`).
- **15.0% Anomaly Threshold Edge Conditions**:
  - Fuel variance at +14.99% does NOT flag an anomaly (`is_anomaly = false`).
  - Fuel variance at +15.00% DOES flag an anomaly (`is_anomaly = true`).
  - Effective burn rate at +14.9% above baseline does NOT flag an anomaly.
  - Effective burn rate at +15.0% above baseline DOES flag an anomaly.
- **DOLE Regulatory Boundaries**:
  - Shift at 8.9h: `dole_warning = false`, `fatigue_status = 'warning'`.
  - Shift at 9.0h: `dole_warning = true`, `fatigue_status = 'warning'`.
  - Shift at 10.0h: `dole_warning = true`, `fatigue_status = 'critical'` (hard-stop cap).

### Tier 3: Cross-Feature Interactions
Verifies end-to-end integration across decoupled modules:
- **Critical DVIR Lockout & Dispatch Assignment**: An asset flagged with critical defects (`UnderMaintenance`) cannot be assigned to any dispatch job; `AssignDispatchResources` rejects assignment with eligibility conflict.
- **Job Report Approval Auto-Completion**: Approving a submitted job report automatically transitions the parent `DispatchJob` status to `Completed` and increments its optimistic locking version.
- **Fuel Log Meter Progression**: Logging a completed fuel request updates the parent `OperationalAsset` meter reading in the database.
- **Duty Log Demurrage Linking**: Active standby duty logs during a dispatch job are linked as billable demurrage items on the job report.

### Tier 4: Real-World Workload Scenarios
Simulates an exhaustive, multi-step operational workday lifecycle from beginning to end:
1. **Clock-In**: Operator authenticates and begins active HoS shift.
2. **Pre-Trip DVIR**: Operator executes walkaround inspection with 4 photos and confirms zero critical defects.
3. **Dispatch Assignment**: Dispatcher assigns crane and operator to heavy crane tandem lift job (`DSP-2026-0891`).
4. **Execution & Delays**: Operator transitions duty to `operating`, executes lift, encounters client delay, transitions to `standby` (`waiting_on_client` with billable demurrage).
5. **Refueling**: Operator requests 150L diesel; dispatcher forwards, manager approves and verifies, fuel is logged with hour meter advance and receipt attachment.
6. **Post-Trip DVIR**: Operator completes post-trip walkaround inspection.
7. **Job Report Submission**: Operator submits Job Report with ending engine hours, site remarks, and client digital signature (`Engr. Roberto Cruz`, `Client Site Director`, GPS stamp).
8. **Supervisory Review & Job Closure**: Operations Manager reviews and approves the Job Report, completing the dispatch job and sealing the audit trail.
