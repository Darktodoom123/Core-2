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
        'key' => env('OPENROUTER_API_KEY') ?: env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-5-mini'),
        'provider_model' => env('OPENROUTER_API_KEY')
            ? (env('OPENROUTER_MODEL') ?: 'openai/'.env('OPENAI_MODEL', 'gpt-5-mini'))
            : (env('OPENAI_API_KEY')
                ? env('OPENAI_MODEL', 'gpt-5-mini')
                : (env('OPENROUTER_MODEL') ?: 'openai/'.env('OPENAI_MODEL', 'gpt-5-mini'))),
        'base_url' => env('OPENROUTER_API_KEY')
            ? (env('OPENROUTER_BASE_URL') ?: 'https://openrouter.ai/api/v1')
            : (env('OPENAI_API_KEY')
                ? (env('OPENAI_BASE_URL') ?: 'https://api.openai.com/v1')
                : (env('OPENROUTER_BASE_URL') ?: env('OPENAI_BASE_URL', 'https://openrouter.ai/api/v1'))),
        'fake' => (bool) env('OPENAI_FAKE', false),
        'max_input_tokens' => (int) env('OPENAI_MAX_INPUT_TOKENS', 32000),
        'max_cost_usd' => (float) env('OPENAI_MAX_COST_USD', 0.05),
        'proactive_enabled' => (bool) env('OPENAI_PROACTIVE_ENABLED', true),
        'proactive_batch_size' => 10,
        'proactive_cooldown_minutes' => 5,
    ],

    'tracking' => [
        'driver' => env('TRACKING_SERVICE_DRIVER', 'database'),
        'url' => env('TRACKING_SERVICE_URL', 'http://localhost:8001'),
        'secret' => env('TRACKING_SERVICE_SECRET', 'test-tracking-service-secret'),
        'timeout' => (float) env('TRACKING_SERVICE_TIMEOUT', 5.0),
        'connect_timeout' => (float) env('TRACKING_SERVICE_CONNECT_TIMEOUT', 3.0),
    ],

];
