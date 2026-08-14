<?php

return [
    // V2 commands are available to explicit adapters while legacy adapters remain unchanged.
    'v2_commands_enabled' => (bool) env('DISPATCH_V2_COMMANDS_ENABLED', true),
    'legacy_path_enabled' => (bool) env('DISPATCH_V2_LEGACY_PATH_ENABLED', true),
];
