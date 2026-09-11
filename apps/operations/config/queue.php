<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Queue Connection Name
    |--------------------------------------------------------------------------
    |
    | Laravel's queue supports a variety of backends via a single, unified
    | API, giving you convenient access to each backend using identical
    | syntax for each. The default queue connection is defined below.
    |
    */

    'default' => env('QUEUE_CONNECTION', 'database'),

    /*
    |--------------------------------------------------------------------------
    | Dedicated Worker Queue Channels
    |--------------------------------------------------------------------------
    |
    | Explicit queue channel mappings and worker pool configurations for
    | isolated workload execution:
    | - default: Core operational dispatch, assignment, notifications, and telemetry
    | - ai: Asynchronous GPT recommendations, candidate ranking, and sweeps
    | - reports: Long-running CSV/Excel dataset exports and report generation (up to 300s)
    |
    */

    'queues' => [
        'default' => [
            'name' => env('QUEUE_DEFAULT_CHANNEL', 'default'),
            'connection' => env('QUEUE_CONNECTION', 'database'),
            'description' => 'Core operational dispatch, assignment, notifications, and telemetry broadcasting.',
            'timeout' => 60,
            'retry_after' => 90,
            'tries' => 3,
        ],

        'ai' => [
            'name' => env('QUEUE_AI_CHANNEL', 'ai'),
            'connection' => env('QUEUE_CONNECTION', 'database'),
            'description' => 'Asynchronous GPT recommendations, candidate ranking, and sweeps.',
            'timeout' => 120,
            'retry_after' => 150,
            'tries' => 3,
        ],

        'reports' => [
            'name' => env('QUEUE_REPORTS_CHANNEL', 'reports'),
            'connection' => env('QUEUE_CONNECTION', 'database'),
            'description' => 'Long-running CSV/Excel dataset exports and report generation (with up to 300s timeout).',
            'timeout' => 300,
            'retry_after' => 360,
            'tries' => 2,
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Queue Connections
    |--------------------------------------------------------------------------
    |
    | Here you may configure the connection options for every queue backend
    | used by your application. An example configuration is provided for
    | each backend supported by Laravel. You're also free to add more.
    |
    | Drivers: "sync", "database", "beanstalkd", "sqs", "redis",
    |          "deferred", "background", "failover", "null"
    |
    */

    'connections' => [

        'sync' => [
            'driver' => 'sync',
        ],

        'database' => [
            'driver' => 'database',
            'connection' => env('DB_QUEUE_CONNECTION'),
            'table' => env('DB_QUEUE_TABLE', 'jobs'),
            'queue' => env('DB_QUEUE', 'default'),
            'retry_after' => (int) env('DB_QUEUE_RETRY_AFTER', 420),
            'after_commit' => false,
        ],

        'database-ai' => [
            'driver' => 'database',
            'connection' => env('DB_QUEUE_CONNECTION'),
            'table' => env('DB_QUEUE_TABLE', 'jobs'),
            'queue' => 'ai',
            'retry_after' => (int) env('QUEUE_AI_RETRY_AFTER', 150),
            'after_commit' => false,
        ],

        'database-reports' => [
            'driver' => 'database',
            'connection' => env('DB_QUEUE_CONNECTION'),
            'table' => env('DB_QUEUE_TABLE', 'jobs'),
            'queue' => 'reports',
            'retry_after' => (int) env('QUEUE_REPORTS_RETRY_AFTER', 420),
            'after_commit' => false,
        ],

        'beanstalkd' => [
            'driver' => 'beanstalkd',
            'host' => env('BEANSTALKD_QUEUE_HOST', 'localhost'),
            'queue' => env('BEANSTALKD_QUEUE', 'default'),
            'retry_after' => (int) env('BEANSTALKD_QUEUE_RETRY_AFTER', 90),
            'block_for' => 0,
            'after_commit' => false,
        ],

        'sqs' => [
            'driver' => 'sqs',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'prefix' => env('SQS_PREFIX', 'https://sqs.us-east-1.amazonaws.com/your-account-id'),
            'queue' => env('SQS_QUEUE', 'default'),
            'suffix' => env('SQS_SUFFIX'),
            'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
            'after_commit' => false,
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => env('REDIS_QUEUE_CONNECTION', 'default'),
            'queue' => env('REDIS_QUEUE', 'default'),
            'retry_after' => (int) env('REDIS_QUEUE_RETRY_AFTER', 420),
            'block_for' => null,
            'after_commit' => false,
        ],

        'redis-ai' => [
            'driver' => 'redis',
            'connection' => env('REDIS_QUEUE_CONNECTION', 'default'),
            'queue' => 'ai',
            'retry_after' => (int) env('QUEUE_AI_RETRY_AFTER', 150),
            'block_for' => null,
            'after_commit' => false,
        ],

        'redis-reports' => [
            'driver' => 'redis',
            'connection' => env('REDIS_QUEUE_CONNECTION', 'default'),
            'queue' => 'reports',
            'retry_after' => (int) env('QUEUE_REPORTS_RETRY_AFTER', 420),
            'block_for' => null,
            'after_commit' => false,
        ],

        'ai' => [
            'driver' => env('QUEUE_AI_DRIVER', env('QUEUE_CONNECTION', 'database')),
            'connection' => env('DB_QUEUE_CONNECTION'),
            'table' => env('DB_QUEUE_TABLE', 'jobs'),
            'queue' => 'ai',
            'retry_after' => (int) env('QUEUE_AI_RETRY_AFTER', 150),
            'after_commit' => false,
        ],

        'reports' => [
            'driver' => env('QUEUE_REPORTS_DRIVER', env('QUEUE_CONNECTION', 'database')),
            'connection' => env('DB_QUEUE_CONNECTION'),
            'table' => env('DB_QUEUE_TABLE', 'jobs'),
            'queue' => 'reports',
            'retry_after' => (int) env('QUEUE_REPORTS_RETRY_AFTER', 420),
            'after_commit' => false,
        ],

        'deferred' => [
            'driver' => 'deferred',
        ],

        'background' => [
            'driver' => 'background',
        ],

        'failover' => [
            'driver' => 'failover',
            'connections' => [
                'database',
                'deferred',
            ],
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Job Batching
    |--------------------------------------------------------------------------
    |
    | The following options configure the database and table that store job
    | batching information. These options can be updated to any database
    | connection and table which has been defined by your application.
    |
    */

    'batching' => [
        'database' => env('DB_CONNECTION', 'sqlite'),
        'table' => 'job_batches',
    ],

    /*
    |--------------------------------------------------------------------------
    | Failed Queue Jobs
    |--------------------------------------------------------------------------
    |
    | These options configure the behavior of failed queue job logging so you
    | can control how and where failed jobs are stored. Laravel ships with
    | support for storing failed jobs in a simple file or in a database.
    |
    | Supported drivers: "database-uuids", "dynamodb", "file", "null"
    |
    */

    'failed' => [
        'driver' => env('QUEUE_FAILED_DRIVER', 'database-uuids'),
        'database' => env('DB_CONNECTION', 'sqlite'),
        'table' => 'failed_jobs',
    ],

];
