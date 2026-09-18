# Artemis Android testing

Artemis is an optional device automation tool alongside Detox, Pest, and Playwright.
The project launcher pins upstream commit `371aa6df56880643da57b30da936e9812fb0ec66`.
Python 3.12, the upstream locked dependencies, credentials, and traces live in the
git-ignored root `.artemis/` directory. Nothing is added to the shipped mobile app.

## Setup (repository root)

Requires Git, Node, uv, and the Android SDK. Setup downloads the pinned upstream
source and a managed Python runtime. It does not install global IDE rules.

```powershell
npm run mobile:artemis:setup
npm run mobile:artemis:doctor
```

Configure a model provider in `.artemis/runtime/.env` (for the upstream Google
default, `GEMINI_API_KEY`). Never commit or paste keys into prompts. Review model
availability in `.artemis/runtime/config/artemis.jsonc`; Artemis makes its own
provider calls and does not inherit a chat subscription or `/boost` setting.
Screenshots and UI data can be processed by the configured model provider; use
isolated test accounts and synthetic data.

The doctor identifies missing keys, devices, and optional tools. Install/build
the Core-2 development app using the existing Android workflow and start its API
and development server as needed. Artemis does not need the Detox test APK.

```powershell
npm run mobile:api
# In another terminal:
npm run mobile:start
# With an authorized test emulator/device connected:
npm run mobile:artemis:smoke -- emulator-5554
```

Use the actual serial from `adb devices`. The launcher requires an explicit
authorized device with `com.core2.fieldmobile` installed. It runs Pro with strict
verification, app restriction, and standalone execution. On first execution,
upstream Artemis may install its accessibility helper on the selected test device.
Read-only smoke instructions are in [smoke.md](smoke.md).

## Custom scenarios and evidence

```powershell
npm run mobile:artemis:run -- emulator-5554 path/to/test-scenario.md
```

Prompt paths are relative to the repository root. Use test-only scenarios and
explicit job references. Custom scenarios may perform writes: route messages to
test recipients and never trigger real emergency escalation. Test seed/setup and
cleanup remain the responsibility of the test harness.

Traces are saved under `.artemis/traces/<timestamp>/`. Review checkpoint results
and screenshots; a zero CLI exit code alone is not acceptance evidence. Pair
mobile interactions with backend record assertions and Playwright web checks for
mobile → backend → web verification. Do not mark milestones runtime-verified from
this navigation smoke check. Existing unit/feature/Detox tests remain in place.

## Optional project MCP connection

The launcher also exposes upstream's stdio MCP server. In your IDE's project MCP
settings, use `node` as command and these arguments (replace the absolute path):

```json
{
    "mcpServers": {
        "artemis": {
            "command": "node",
            "args": [
                "C:/path/to/Core-2/packages/field-mobile/scripts/artemis.cjs",
                "mcp"
            ]
        }
    }
}
```

Setup does not change your global MCP configuration or AGENTS instructions.
Restart/reconnect the IDE after registering the server. The CLI works without MCP.
The launcher defaults `ARTEMIS_DAEMON_PORT` to 8001 so it does not collide with
the Laravel API. Override that environment variable if 8001 is occupied.
For direct upstream options:
`node packages/field-mobile/scripts/artemis.cjs cli run --help`.
If using the optional upstream UI, choose port 8001 to avoid Core-2's API on 8000:
`npm run mobile:artemis:cli -- ui --host 127.0.0.1 --port 8001`.

## Updating

Review a new upstream revision, update the launcher pin, and explicitly update the
local checkout. Setup refuses a revision mismatch instead of overwriting it.
Local model configuration is preserved on repeated setup.

Sources: [Artemis README](https://github.com/google/artemis),
[MCP documentation](https://github.com/google/artemis/tree/main/mcp_server).

## Initial verification (2026-09-18)

The pinned runtime and 174 locked Python dependencies installed successfully.
Doctor loaded the configuration and detected the Android emulator. Device tasks
remain unverified because no model API credential is configured. Optional scrcpy
is also missing, so video recording has not been verified. No milestone has been
marked live-verified and no business actions were performed during setup.
