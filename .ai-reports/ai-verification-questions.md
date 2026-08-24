# AI verification questions

## Field Emergency SOS — 2026-08-24

### Did you build this the most secure way?

The security boundary is server-authoritative: Sanctum authentication, active-token middleware, the named SOS rate limiter, active field-role validation, scoped dispatch/asset resolution, policy/FormRequest authorization, UUID idempotency, row locks, recipient snapshots, audit events, encrypted emergency phone numbers, deterministic phone hashes, coordinate retention pruning, and no automatic public-authority contact. Dispatcher and Operations Manager recipients are resolved from active verified Core 2 users only; Field Technicians are never escalation recipients. Mobile call/SMS actions accept only server-configured `tel:`/`sms:` URIs and require deliberate user action. The live map's SOS halo is non-interactive, while the marker retains a keyboard-accessible button, SOS icon/label, and status text. SOS is disabled by default (`SOS_ENABLED=false`) and the escalation binding is a null provider until real contacts, providers, monitoring, and acceptance gates are complete.

Residual security gates are provider configuration review, production emergency-contact roster review, Reverb/realtime delivery monitoring, staging delivery drills, and physical-device/lock-screen acceptance. Those gates intentionally keep production activation disabled.

### Did you build this the most efficient way?

The implementation reuses the existing Laravel identity, notifications, audit, workspace, Inertia, Reverb, and mobile outbox boundaries. Triggering is one transaction with one recipient-resolution pass and after-commit delivery jobs. Responder state is eager-loaded into the existing workspace prop, with bounded records and polling/realtime refresh rather than a second workspace. The mobile outbox gives SOS its own emergency-priority scope and preserves the same UUID through retries, while GPS enrichment is bounded and non-blocking.

The main remaining efficiency measurement is production queue/realtime latency under a real emergency load test; it was not run because the provider and production gates are intentionally incomplete.

### What regressions could this introduce?

Potential regressions are migration ordering or notification-schema deployment errors, stale responder snapshots in a long-lived workspace, incorrect server/client contract drift, duplicate retry delivery, SOS halo state or location drift, and emergency actions being unavailable on devices without a configured provider or phone capability. These are mitigated by idempotent database constraints, row locks, after-commit jobs, bounded freshness/expiry windows, synchronized map/text location summaries, explicit delivery states, strict call/SMS URI validation, a responder-only `operations.sos` channel with polling fallback, worker-ID matching with live-coordinate precedence, and resolved/cancelled halo removal.

The broader mobile component suite still has one pre-existing failure in `nativeFieldWorkflows.component.test.tsx`; the same failure reproduces on the original main checkout and is unrelated to SOS. Android export, Detox, physical-device, browser, provider, and staging delivery checks remain open release gates.

### What tests do we need to write before we ship this?

Before production enablement, add and run PostgreSQL concurrency tests for first acknowledgement and duplicate command races; API contract tests against the mobile client payload and response shapes; Reverb reconnect and polling-fallback tests; queue/provider retry and emergency-contact delivery tests; browser keyboard/screen-reader and responder authorization flows; Android cold-start, lock-screen, offline, GPS-timeout, `tel:`/`sms:` handoff, and physical-device tests; a staged three-minute escalation drill proving notification, acknowledgement, resolution, audit, and monitoring behavior; and a map acceptance drill covering active, acknowledged-unresolved, resolved/cancelled, live-location update, normal-motion pulse, reduced-motion static halo, supported zoom, keyboard access, and non-blocking marker interaction. Current focused evidence includes 12 SOS Pest tests/55 assertions, 43 mobile unit tests, 5 native map-marker tests, 2 SOS component tests, 6 Playwright MapLibre tests, PHPStan, Pint, TypeScript, ESLint, Prettier, the Vite production build, route registration, and diff checks.

## Release decision

`SOS_ENABLED=false` remains required until all provider, roster, monitoring, realtime, staging, physical-device, and live-map SOS-ring acceptance gates pass.
