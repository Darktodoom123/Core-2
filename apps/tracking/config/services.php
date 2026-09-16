<?php

return [
    'tracking' => [
        'secret' => env('TRACKING_SERVICE_SECRET', ''),
        'allowed_services' => array_values(array_filter(explode(',', (string) env('TRACKING_ALLOWED_SERVICES', 'operations')))),
        'stream_key' => env('TRACKING_STREAM_KEY', 'telemetry.gps.v1'),
        'stream_group' => env('TRACKING_STREAM_GROUP', 'tracking-ingest-workers'),
        'dlq_stream_key' => env('TRACKING_DLQ_STREAM_KEY', 'telemetry.gps.dlq'),
        'stream_maxlen' => (int) env('TRACKING_STREAM_MAXLEN', 100000),
    ],
];
