# Core-2 Android navigation smoke check

Open the installed com.core2.fieldmobile app on the explicitly selected test device.
Use only this app. Do not change device settings, clear storage, log out, submit forms,
change duty status, trigger SOS, accept jobs, release assets, or send notifications.

1. Capture the initial screen and identify whether it is login, authenticated home,
   a development-client connection screen, or an error.
2. If login is required, verify visible login controls and stop with
   BLOCKED_AUTHENTICATION for authenticated checks. Do not guess credentials.
3. If a development server connection is required or the app cannot load, report
   BLOCKED_RUNTIME with the visible error. Do not treat the check as passed.
4. If authenticated, inspect existing assignments and open one existing job's
   details without taking any business action. Record the job reference.
5. Navigate back. If a read-only Hours of Service view is reachable, inspect its
   displayed duty status without selecting or changing a status.
6. Capture screenshots for each completed checkpoint. Report crashes, clipped
   controls, missing navigation, and visible errors separately from assumptions.

Return PASS, FAIL, or BLOCKED for every checkpoint with trace/screenshot references.
Do not claim backend persistence, web parity, offline recovery, or push delivery
were verified by this navigation smoke check.
