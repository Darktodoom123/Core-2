<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Security HTTP Response Headers
    |--------------------------------------------------------------------------
    |
    | These HTTP headers are enforced on application responses to mitigate
    | cross-site scripting (XSS), clickjacking, MIME-type sniffing, and
    | unauthorized cross-origin information leakage.
    |
    */

    'headers' => [
        'x_frame_options' => env('SECURITY_HEADER_X_FRAME_OPTIONS', 'SAMEORIGIN'),
        'x_content_type_options' => env('SECURITY_HEADER_X_CONTENT_TYPE_OPTIONS', 'nosniff'),
        'referrer_policy' => env('SECURITY_HEADER_REFERRER_POLICY', 'strict-origin-when-cross-origin'),
        'permissions_policy' => env('SECURITY_HEADER_PERMISSIONS_POLICY', null),
        'cross_origin_opener_policy' => env('SECURITY_HEADER_COOP', null),
        'content_security_policy' => env('SECURITY_HEADER_CSP', null),
    ],

    /*
    |--------------------------------------------------------------------------
    | Content-Security-Policy Directives
    |--------------------------------------------------------------------------
    |
    | Structured CSP directives. Disabled by default in local dev environment
    | to avoid interfering with Vite HMR, React Fast Refresh, and inline styles.
    |
    */

    'csp' => [
        'enabled' => env('SECURITY_HEADER_CSP_ENABLED', false),
        'default-src' => ["'self'"],
        'script-src' => [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            'http://localhost:*',
            'http://127.0.0.1:*',
            'http://[::1]:*',
            'https:',
        ],
        'style-src' => [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.bunny.net',
            'https://fonts.googleapis.com',
            'http://localhost:*',
            'http://127.0.0.1:*',
            'http://[::1]:*',
        ],
        'font-src' => [
            "'self'",
            'data:',
            'https://fonts.bunny.net',
            'https://fonts.gstatic.com',
            'http://localhost:*',
            'http://127.0.0.1:*',
            'http://[::1]:*',
        ],
        'img-src' => [
            "'self'",
            'data:',
            'blob:',
            'https://*.stadiamaps.com',
            'https://tiles.stadiamaps.com',
            'https://*.tile.openstreetmap.org',
            'https://openmaptiles.org',
            'http://localhost:*',
            'http://127.0.0.1:*',
            'http://[::1]:*',
            'https:',
        ],
        'connect-src' => [
            "'self'",
            'ws:',
            'wss:',
            'http:',
            'https:',
            'data:',
            'blob:',
            'http://localhost:*',
            'http://127.0.0.1:*',
            'http://[::1]:*',
            'ws://localhost:*',
            'ws://127.0.0.1:*',
            'ws://[::1]:*',
            'https://*.stadiamaps.com',
            'https://tiles.stadiamaps.com',
            'https://openmaptiles.org',
        ],
        'worker-src' => ["'self'", 'blob:'],
        'media-src' => ["'self'", 'data:', 'blob:'],
        'object-src' => ["'none'"],
        'frame-ancestors' => ["'self'"],
        'base-uri' => ["'self'"],
        'form-action' => ["'self'"],
    ],

    /*
    |--------------------------------------------------------------------------
    | Headers to Strip / Remove
    |--------------------------------------------------------------------------
    |
    | Headers that leak server technologies, frameworks, or versions.
    |
    */

    'strip_headers' => [
        'X-Powered-By',
        'Server',
    ],

    /*
    |--------------------------------------------------------------------------
    | Strict Transport Security (HSTS)
    |--------------------------------------------------------------------------
    |
    | When enabled and request is served over HTTPS, this header instructs
    | browsers to only communicate over HTTPS.
    |
    */

    'hsts' => [
        'enabled' => env('SECURITY_HEADER_HSTS_ENABLED', true),
        'max_age' => (int) env('SECURITY_HEADER_HSTS_MAX_AGE', 31536000),
        'include_subdomains' => env('SECURITY_HEADER_HSTS_SUBDOMAINS', true),
        'preload' => env('SECURITY_HEADER_HSTS_PRELOAD', false),
    ],

];
