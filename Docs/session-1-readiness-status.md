# Session 1 readiness status

**Last verified:** 2026-08-01  
**Verdict:** PASSED — Sprint 1 complete

## Accepted scope

The active native release targets Android phones running Android 11 (API 30)
or later. iOS, tablet applications, cloud EAS builds, Apple credentials, and
macOS acceptance are outside scope. Local Android builds are the accepted
native build path.

## Implemented

- Expo/React Native application shell for Driver, Crane Operator, and Field
  Technician roles.
- Sanctum bearer-device authentication with Expo SecureStore persistence and
  no AsyncStorage or memory fallback.
- Explicit fail-closed logout. The active token is moved to a SecureStore
  revocation-only slot before local identity state is cleared. A failed server
  revocation blocks new login, exposes a retry action, and is retried on cold
  start; a successful revocation or server `401` clears the pending token.
- Assigned-job isolation, non-field-role rejection, suspension/revocation
  handling, identity-scoped state clearing, and explicit operational states.
- Responsive phone layouts, portrait and landscape support, safe areas,
  scalable text, accessible names/states, and 44px or larger primary touch
  targets in implementation and rendered coverage.
- Detox Android-emulator and Maestro physical-phone acceptance configuration.
- Per-target clean-build and reused-artifact evidence files that are set to
  `RUNNING` at startup and end in `FAILED` or `PASSED`.
- Automated redacted scanning of API, Metro, emulator, application-relevant
  device logs, application APK, and instrumentation APK. Validation fails on a
  fixture password, populated Authorization header, bearer-token value,
  password value, or Sanctum-shaped raw token.

## Verified on 2026-08-01

- A clean isolated `npm ci` installs 1,557 packages from the committed
  workspace manifests and lockfile with Node 22.13.0 and npm 10.9.2. The first
  in-place attempts were blocked by a Windows lock on the loaded native
  `lightningcss` binary; the isolated clean install is the deterministic
  lockfile result.
- `npx expo install --check` reports dependencies up to date. React, React DOM,
  and React Test Renderer are aligned at Expo SDK 57's expected 19.2.3 version.
  Expo Doctor passes 20/20 checks.
- The Android JavaScript export and mobile TypeScript check pass.
- The current mobile service/workflow suite passes 27/27 and rendered component tests pass
  15/15. The rendered suite covers successful logout, failed revocation, retry,
  cold-start recovery, local identity clearing, and server-confirmed rejection
  of an already-invalid token.
- Focused authentication and field API Pest coverage passes 22 tests with 110
  assertions. Logout deletes the current Sanctum token and reuse is rejected.
- Root TypeScript checking and the production Vite build pass.
- Direct NDK 27.1.12297006 compiler execution succeeds.
- Clean Expo prebuild and Gradle native builds succeed. Android API 30 and API
  36 each pass the complete five-journey Detox run from the clean build. The
  journeys cover install/launch, login, assigned-job isolation, SecureStore
  cold restart, non-field-role rejection, logout, revoked-token rejection,
  suspension, server revocation, and second-user isolation.
- Each passing emulator run scans ten retained log/APK sources. Fixture
  password, Authorization header, bearer token, password value, and
  Sanctum-shaped token counts are all zero.
- A physical Infinix X6815B phone running Android 12/API 31 passes the Maestro
  2.8.0 journey over USB debugging: development-client connection, secure
  login, assigned-job isolation, cold relaunch/session restoration, logout,
  and return to login.

## Passing acceptance evidence

Clean-build emulator evidence:

- `storage/framework/testing/session1-native-evidence-core2_api_30_phone-clean-build-requested.txt`
- `storage/framework/testing/session1-native-evidence-core2_api_36-clean-build-requested.txt`

Both clean runs use the same 178,568,687-byte APK with SHA-256
`FE29BA2EBBB3EB12193CFF520024464ED81966541BEDD785D4AFF5BF0CBC9F1A`.

Redacted physical-phone evidence:

- `storage/framework/testing/session1-physical-evidence-infinix-x6815b.txt`

The one-time fixture password and raw bearer tokens are not retained. Maestro
debug logs that expanded fixture variables were removed after the passing run.

## Sprint verdict and remaining work

Sprint 1 is complete for the accepted Android-phone scope. No tablet target is
required. Sprint 2 has since completed the durable SQLite outbox; device GPS
integration remains a Sprint 3 deliverable and is deliberately outside this
Sprint 1 verdict.

## Dependency advisory assessment

The aligned install reports 12 npm advisories (11 moderate and 1 high). No
forced audit remediation was applied. `npm audit fix --force` is prohibited
because its proposed major-version changes can conflict with the Expo SDK 57
compatibility set. Reassess when compatible Expo/React Native and testing-tool
releases are available.

## Repository policy

`Docs/` is ignored by the repository's existing `.gitignore` policy. These
status corrections are present in the working tree but do not appear in a
normal Git diff. The ignore policy was not changed.
