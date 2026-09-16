<?php

return [
    'default' => env('DB_CONNECTION', 'pgsql'),

    'connections' => [
        'sqlite' => [
            'driver' => 'sqlite',
            'url' => env('DB_URL'),
            'database' => env('DB_DATABASE', database_path('database.sqlite')),
            'prefix' => '',
            'foreign_key_constraints' => env('DB_FOREIGN_KEYS', true),
        ],

        'pgsql' => [
            'driver' => 'pgsql',
            'url' => env('DB_URL'),
            'read' => [
                'host' => ($readHosts = array_values(array_filter(array_map('trim', explode(',', (string) (env('DB_READ_HOST') ?: env('DB_HOST', '127.0.0.1'))))))) !== [] ? $readHosts : [(string) env('DB_HOST', '127.0.0.1')],
            ],
            'write' => [
                'host' => ($writeHosts = array_values(array_filter(array_map('trim', explode(',', (string) env('DB_HOST', '127.0.0.1')))))) !== [] ? $writeHosts : ['127.0.0.1'],
            ],
            'sticky' => true,
            'port' => env('DB_PORT', '5432'),
            'database' => env('DB_DATABASE', 'core2_ms_tracking'),
            'username' => env('DB_USERNAME', 'postgres'),
            'password' => env('DB_PASSWORD', ''),
            'charset' => env('DB_CHARSET', 'utf8'),
            'prefix' => '',
            'prefix_indexes' => true,
            'search_path' => env('DB_SCHEMA', 'public'),
            'sslmode' => env('DB_SSLMODE', 'prefer'),
        ],
    ],

    'migrations' => [
        'table' => 'migrations',
        'update_date_on_publish' => true,
    ],

    'redis' => [
        'client' => env('REDIS_CLIENT', 'phpredis'),
        'options' => [
            'cluster' => env('REDIS_CLUSTER', 'redis'),
            'prefix' => env('REDIS_PREFIX', ''),
        ],
        'default' => [
            'url' => env('REDIS_URL'),
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'username' => env('REDIS_USERNAME'),
            'password' => env('REDIS_PASSWORD'),
            'port' => env('REDIS_PORT', '6379'),
            'database' => env('REDIS_DB', '0'),
        ],
    ],
];
