<?php

return [
    // V2 commands are available to explicit adapters while legacy adapters remain unchanged.
    'v2_commands_enabled' => (bool) env('DISPATCH_V2_COMMANDS_ENABLED', true),
    'phase3_commands_enabled' => (bool) env('DISPATCH_V2_PHASE3_COMMANDS_ENABLED', true),
    'legacy_path_enabled' => (bool) env('DISPATCH_V2_LEGACY_PATH_ENABLED', true),

    // Phase 6 Rollout & Telemetry Configuration
    'telemetry_enabled' => (bool) env('DISPATCH_V2_TELEMETRY_ENABLED', true),
    'rollout_cohorts' => array_filter(explode(',', (string) env('DISPATCH_V2_ROLLOUT_COHORTS', 'operations'))),
    'sunset_date' => env('DISPATCH_V1_SUNSET_DATE', '2027-02-14'),
    'sunset_timestamp' => (int) env('DISPATCH_V1_SUNSET_TIMESTAMP', 1755129600),
    'legacy_grace_period_days' => (int) env('DISPATCH_V1_GRACE_PERIOD_DAYS', 90),
];
