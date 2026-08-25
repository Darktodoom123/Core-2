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

## Docker modernization — 2026-08-25

### Did you build this the most secure way?

The image uses pinned Docker Official Image digests, a current Dockerfile syntax
directive, separate build/runtime stages, explicit Alpine packages without
`apk upgrade`, locked Composer/npm installs, and no runtime `.env` creation.
The production stage copies only application runtime paths, vendor files, and
built assets. The startup boundary validates required database, application,
Reverb, and conditional Redis settings; storage, cache, and database paths are
owned by `www-data` with `0770` directories and `0660` files. No `chmod 777` or
build-time runtime secret is used. Supervisor remains root only for named-volume
ownership setup and Nginx port 80; PHP-FPM workers, Nginx workers, queue,
scheduler, and Reverb are unprivileged.

The final runtime image was inspected: it contains no project `.env` or
`.env.example`, no world-writable project paths, and no application/database
credentials in image configuration. Named-volume paths are `0770`; the image
and non-volume application paths are not world-writable. The public Reverb
identifier is intentionally available to the browser bundle; the private
Reverb secret is runtime-only.

Residual security work is vulnerability scanning and regular review. The build
still obtains Alpine packages from the pinned base image's configured
repositories rather than pinning every APK package version; weekly image
refreshes, secret rotation, and CI scanning remain necessary.

### Did you build this the most efficient way?

The PHP extension layer is shared by Composer, frontend, and test stages.
Composer and npm dependency layers are isolated before source changes and use
BuildKit cache mounts. The production stage excludes tests, mobile sources,
documentation, CI metadata, and frontend build-tool manifests. The concurrency
test target is intentionally self-contained, which removes host `vendor/` and
bind-mount variability at the cost of a larger test image.

### What regressions could this introduce?

The main behavior-sensitive areas are the PHP 8.4.24/Alpine 3.24 extension
build, PHP-aware Wayfinder/Vite generation without an `.env`, Supervisor signal
handling, Nginx worker ownership, and the test entrypoint's creation and
migration of `core2_concurrency_test`. External PostgreSQL users may still see
the bundled local `db` service start because the Compose file preserves the
existing local topology; the app itself honors the configured external host.
The test profile assumes the supplied local PostgreSQL user can create the
concurrency database or that it is pre-provisioned. The profile intentionally
runs R6 before R3 and resets only its dedicated test database so R3's
`DatabaseMigrations` cleanup cannot remove R6's migrated schema; this does not
change application behavior.

### What tests do we need to write before we ship this?

The Docker workflow adds Dockerfile parsing, quiet Compose validation, fresh
production and test-target builds, a bounded health check for app/PostgreSQL/
Redis, an `/up` request, and the profile-gated Concurrency Pest suite using
dummy non-secret values. Local static checks also include YAML/JSON parsing,
shell syntax, image-reference verification, security-pattern review, and
`git diff --check`.

Local verification completed with Docker Desktop's Linux daemon: `docker
build --check .` passed with no warnings; `docker compose config --quiet`
passed with dummy values and printed no resolved secrets; production and
test-runner targets built with locked dependencies; the isolated Compose stack
reached healthy app/PostgreSQL/Redis; `/up` returned HTTP 200; and the exact
profile command completed the two intended concurrency files with exit 0,
17 existing warnings, and 91 assertions. Shell syntax, Composer validation,
security-pattern checks, and `git diff --check` also passed. The isolated
project was stopped with `docker compose down` without `--volumes`, preserving
its named volumes. The test suite's warnings and the normal need for image
vulnerability scanning remain release risks.
