<?php

return [
    'tracking' => [
        'secret' => env('TRACKING_SERVICE_SECRET', 'test-tracking-service-secret'),
        'allowed_services' => array_values(array_filter(explode(',', (string) env('TRACKING_ALLOWED_SERVICES', 'operations')))),
    ],
];
