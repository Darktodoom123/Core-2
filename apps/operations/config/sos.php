<?php

return [
    'enabled' => (bool) env('SOS_ENABLED', false),
    'acknowledgement_deadline_seconds' => max(1, (int) env('SOS_ACK_DEADLINE_SECONDS', 180)),
    'mobile_freshness_seconds' => max(60, (int) env('SOS_MOBILE_FRESHNESS_SECONDS', 900)),
    'queue' => env('SOS_QUEUE', 'emergency'),
    'responder_channels' => ['database', 'realtime'],
    'escalation_driver' => env('SOS_ESCALATION_DRIVER', 'null'),
    'local_emergency_label' => env('SOS_LOCAL_EMERGENCY_LABEL'),
    'local_emergency_number' => env('SOS_LOCAL_EMERGENCY_NUMBER'),
    'coordinate_retention_days' => max(1, (int) env('SOS_COORDINATE_RETENTION_DAYS', 30)),
    'sweep_batch_size' => max(1, (int) env('SOS_SWEEP_BATCH_SIZE', 100)),
];
