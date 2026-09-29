<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'openai' => [
        'key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL') ?: 'gpt-6-luna',
        'base_url' => env('OPENAI_BASE_URL') ?: 'https://api.openai.com/v1',
        'fake' => (bool) env('OPENAI_FAKE', false),
        'max_input_tokens' => (int) env('OPENAI_MAX_INPUT_TOKENS', 32000),
        'max_cost_usd' => (float) env('OPENAI_MAX_COST_USD', 0.05),
        'proactive_enabled' => (bool) env('OPENAI_PROACTIVE_ENABLED', true),
        'blocker_resolution_enabled' => (bool) env('OPENAI_BLOCKER_RESOLUTION_ENABLED', false),
        'proactive_batch_size' => 10,
        'proactive_cooldown_minutes' => 5,
    ],

    // Reverse geocoding (coordinates -> nearest address). Providers are tried
    // in order; Stadia needs STADIA_MAPS_API_KEY for server-side calls.
    'geocoding' => [
        'providers' => array_values(array_filter(array_map('trim', explode(',', (string) env('GEOCODING_PROVIDERS', 'stadia,photon,bigdatacloud'))))),
        'timeout' => (float) env('GEOCODING_TIMEOUT', 4.0),
        'retry_after_minutes' => (int) env('GEOCODING_RETRY_AFTER_MINUTES', 15),
        'stadia_key' => env('STADIA_MAPS_API_KEY') ?: env('VITE_STADIA_MAPS_API_KEY'),
        // Address search (site pins) is limited to this ISO country code.
        'search_country' => env('GEOCODING_SEARCH_COUNTRY', 'PH'),
    ],

    // Public Reverb endpoint for browsers, rendered into the page at runtime.
    // Empty values fall back to the build-time VITE_REVERB_* settings.
    'reverb_client' => [
        'host' => env('REVERB_CLIENT_HOST'),
        'port' => env('REVERB_CLIENT_PORT'),
        'scheme' => env('REVERB_CLIENT_SCHEME'),
    ],

    'tracking' => [
        'driver' => env('TRACKING_SERVICE_DRIVER', 'database'),
        'url' => env('TRACKING_SERVICE_URL', 'http://localhost:8001'),
        'secret' => env('TRACKING_SERVICE_SECRET', 'test-tracking-service-secret'),
        'timeout' => (float) env('TRACKING_SERVICE_TIMEOUT', 5.0),
        'connect_timeout' => (float) env('TRACKING_SERVICE_CONNECT_TIMEOUT', 3.0),
        'allow_ingest_fallback' => (bool) env('TRACKING_ALLOW_INGEST_FALLBACK', false),
        'allow_read_fallback' => (bool) env('TRACKING_ALLOW_READ_FALLBACK', false),
        'stream_key' => env('TRACKING_STREAM_KEY', 'telemetry.gps.v1'),
        'stream_group' => env('TRACKING_STREAM_GROUP', 'tracking-ingest-workers'),
        'stream_maxlen' => (int) env('TRACKING_STREAM_MAXLEN', 100000),
        'dlq_stream_key' => env('TRACKING_DLQ_STREAM_KEY', 'telemetry.gps.dlq'),
    ],

];
