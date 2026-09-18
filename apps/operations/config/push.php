<?php

return [
    'enabled' => (bool) env('PUSH_NOTIFICATIONS_ENABLED', true),
    'provider' => env('PUSH_PROVIDER', 'expo'),
    'expo_url' => env('EXPO_PUSH_URL', 'https://exp.host/--/api/v2/push/send'),
    'expo_receipts_url' => env('EXPO_PUSH_RECEIPTS_URL', 'https://exp.host/--/api/v2/push/getReceipts'),
    'expo_access_token' => env('EXPO_PUSH_ACCESS_TOKEN', null),
    'timeout_seconds' => (float) env('PUSH_TIMEOUT_SECONDS', 5.0),
    'queue' => env('PUSH_QUEUE', 'default'),
];
