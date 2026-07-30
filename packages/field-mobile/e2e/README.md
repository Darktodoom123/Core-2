# Session 1 native acceptance

For an isolated local authenticated run from standalone Windows PowerShell:

```powershell
npm run mobile:session1:native
```

The runner uses Android Studio's external SDK and JBR, creates a dedicated
ignored SQLite database, seeds local-only fixtures, starts the Laravel API and
Metro, builds the Detox APKs, and runs the authenticated emulator journey.
Fixture credentials remain in child-process environment only. The evidence
summary never includes a password or bearer token.

Pass `-SkipNativeBuild` directly to the PowerShell script to reuse existing
application and instrumentation APKs. That path does not invoke or claim to
validate the NDK compiler.

For a shorter device-focus diagnostic, combine `-SkipNativeBuild` with
`-SmokeOnly`. The smoke switch runs only the secure sign-in surface test and
does not claim authenticated-acceptance evidence.

Dedicated ports `18000` (isolated Laravel API) and `18081` (Metro) must be free
before the runner starts. The runner fails fast instead of reusing an unknown
process, verifies Metro through its status endpoint, and terminates the process
trees it starts. It cold-boots the API 36 AVD headlessly with Android's software
renderer and gives Detox an already-online device instead of relying on
Detox's incompatible legacy emulator launch arguments. Detox opens each fresh
app state through the Expo development-client URL so clearing app data cannot
strand the test in the launcher. API, Metro, and emulator output use
timestamped per-run log files under `storage/framework/testing` so an orphaned
process cannot lock the next run's diagnostics.

The runner keeps the API 36 AVD configuration in the Android Studio device
manager, but creates its writable runtime state under the ignored testing
storage. Detox addresses that runner-owned emulator as the attached ADB device
`emulator-5554`, avoiding emulator-console discovery. Running
`e2e:test:android` directly therefore requires that serial to already be online.

Build and run the Android emulator suite from `packages/field-mobile`:

```powershell
npm run e2e:create-avd:android
npm run e2e:build:android
npm run e2e:test:android
```

The boot smoke runs without credentials. To enable the authenticated journey,
provide a verified field-role test account and a reference belonging to another
worker:

```powershell
$env:RUN_NATIVE_ACCEPTANCE = '1'
$env:FIELD_TEST_EMAIL = '<test account email>'
$env:FIELD_TEST_PASSWORD = '<test account password>'
$env:FORBIDDEN_JOB_REFERENCE = '<other worker job reference>'
npm run e2e:test:android
```

The test fails before login if the flag is enabled without all required
fixtures. Keep credentials in the process environment only; do not add them to
source, screenshots, device logs, or exported artifacts.

For a connected physical Android device with Maestro installed, use the same
fixture variables and run:

```powershell
maestro test maestro/session1-physical-device.yaml
```

The API base URL is compiled into the app through
`EXPO_PUBLIC_API_BASE_URL`. Production builds reject non-HTTPS URLs.
