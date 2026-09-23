# Mobile Lifecycle Agent Orchestration & E2E Verification Guide

This document describes the agent architecture, autonomous `/goal` execution patterns, and end-to-end testing matrix built for [Docs/prds/mobile-prd/mobile-lifecycle.md](mobile-lifecycle.md).

---

## 1. Overview & Architectural Principle

The **Mobile-First Field Asset Tracking & Operator Shift Lifecycle** enforces a fundamental architectural principle:
> **Decouple worker labor hours (Hours of Service / HoS) from machine tracking (Unit Telemetry proxy).**

Operators must be able to clock in for morning briefings, meetings, and travel without falsely broadcasting their personal coordinates as the machine's jobsite location. Personal coordinates remain private until the operator physically links to the machine on site.

---

## 2. The Specialist Roles

Two specialized testing roles govern this lifecycle:

### 1. `mobile-lifecycle-orchestrator`
- **Role**: Master autonomous coordinator and gatekeeper.
- **Continuous Convergence**: Plan -> Implement -> Verify -> Audit -> Gate Check.
- **Enforces the 5-Gate Gauntlet Loop**:
  1. *Gate 1: Ingestion & Idempotency* (`Idempotency-Key` / `X-Command-Id` UUID v4 header enforcement).
  2. *Gate 2: Collision & Temporal Availability* (prevent overlapping claims or double-booking).
  3. *Gate 3: Readiness & Safety Compliance* (pre-trip DVIR clearance required before operating).
  4. *Gate 4: Telemetry & Separation Guardrails* (3m/15m silence degrade, >60 km/h separation auto-pause, offline queue flush).
  5. *Gate 5: Closeout & Financial Audit Gauntlet* (post-trip DVIR defect lockout to `Out of Service`, DOLE 10h limit warning, +10% Night Shift Differential).

### 2. `mobile-lifecycle-e2e`
- **Role**: Dedicated multi-tier end-to-end testing and verification specialist.
- **Scope**:
  - **Tier 1: Backend Domain & API E2E**: Pest PHP tests validating state transitions, Sanctum authentication, optimistic locking, and regional compliance.
  - **Tier 2: Web Dispatch Dashboard E2E**: Playwright tests verifying MapLibre tracking indicators (`Offline` gray, `Fresh` glowing green, `Delayed`/`Stale` gold).
  - **Tier 3: Mobile Field Client**: Jest & tsx component tests in `packages/field-mobile`, SQLite offline outbox store-and-forward replay, and native Detox/Maestro runners.
  - **Zero-Leak Security**: Enforces zero credentials, plain bearer tokens, or PII coordinates in logs or test outputs.

---

## 3. Master Operational Lifecycle Matrix (8 Phases)

| Phase | HoS Duty Status | Assigned Unit Status | Mobile Background GPS | Dashboard Status (Web Map) | Verification Endpoint / Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Dispatch Sent** | `Off Duty` | Dispatched (`Pending`) | Disabled | `Offline` (Gray) | `GET /api/v1/dispatch-jobs` (pending) |
| **2. Order Accepted** | `Off Duty` | Accepted (`Awaiting Arrival`) | Disabled | `Offline` (Gray) | `POST .../assignments/{id}/response` (`accepted`) |
| **3. Shift Started** | `On Duty` | Accepted (`Unlinked`) | Disabled | `Offline` (Gray) | `POST /api/v1/hos/shifts/start` (Duty: `operating`) |
| **4. On-Site Unit Start** | `On Duty` | **Linked (`CRN-101`)** | **Active Stream** | **`Fresh` (Glowing Green)** | `POST /api/v1/locations` (Sharing: true) |
| **5. Pre-Trip DVIR** | `On Duty (Operating)` | Inspected & Operating | Active Stream | **`Fresh` (Glowing Green)** | `POST /api/v1/dvir/inspections` (`pre_trip`) |
| **6. Break / Lunch** | `Rest / Meal Break` | Linked (`Telemetry Paused`) | Paused / Standby | `Delayed` / `Stale` (Gold) | `POST /api/v1/hos/duty-status` (`on_break`) |
| **7. Release / Handover**| `On Duty` | **Released (`Available`)** | **Disabled** | `Stale` (Last Known Location) | `POST /api/v1/dvir/inspections` (`post_trip`) |
| **8. End Shift** | `Off Duty` | Unassigned | Disabled | `Offline` / `Stale` | `POST /api/v1/hos/shifts/certify` (`completed`) |

---

## 4. Edge Cases & Guardrails Tested

1. **Shift Started Without Dispatch (4.1)**: Clock-in on HoS allowed; telemetry stays disabled.
2. **Dispatch Rejection (4.1)**: Rejection requires a mandatory reason (`hours_conflict`, `sick_leave`); clears assignment from operator view.
3. **Commute Leak Intercept (4.2)**: Telemetry strictly decoupled until physical on-site confirmation.
4. **Silence Degradation (4.3)**: 3-min silence degrades marker to `Delayed`; 15-min degrades to `Stale`.
5. **Offline SQLite Queue Flush (4.3)**: Reconnect flushes stored pings in compressed batches (max 100 points/payload).
6. **Critical DVIR Defect Lockout (4.4)**: Defects in post-trip DVIR flag asset for maintenance lockout.
7. **DOLE 10h Cap & NSD (5.1)**: 9.0h warning alert, 10.0h hard cap, +10% Night Shift Differential between 22:00 and 06:00.

---

## 5. Running the Tests

```powershell
# 1. Run Master Mobile Lifecycle End-to-End Suite
npm run test:mobile:lifecycle
# Or directly with Artisan from root:
php apps/operations/artisan test --test-directory=apps/operations/tests apps/operations/tests/Feature/MobileLifecycle/MobileLifecycleEndToEndTest.php

# 2. Run Related Backend Feature Suites
php apps/operations/artisan test --test-directory=apps/operations/tests apps/operations/tests/Feature/HoursOfService/HosShiftApiTest.php
php apps/operations/artisan test --test-directory=apps/operations/tests apps/operations/tests/Feature/Dvir/DvirInspectionApiTest.php
php apps/operations/artisan test --test-directory=apps/operations/tests apps/operations/tests/Feature/Api/V1/LocationTest.php

# 3. Run Mobile Field App Unit & Component Suites
npm run test:mobile
# Or separately:
npm --prefix packages/field-mobile run test:unit
npm --prefix packages/field-mobile run test:components

# 4. Run Web Map Playwright E2E
npm run test:e2e:maplibre
```
