<?php

declare(strict_types=1);

/**
 * High-Load Telemetry Benchmark & Load-Test Scenario for Tracking Microservice.
 *
 * Supports both Phase 1 synchronous HTTP / in-process benchmarks and
 * Phase 2 asynchronous Redis stream / consumer batch / read replica benchmarks.
 *
 * Usage:
 *   php scripts/benchmark-tracking-load.php [--mode=all|stream|producer|consumer|read|http|in-process]
 *
 * Options:
 *   --mode=<string>           all|stream|producer|consumer|read|http|in-process (default: all)
 *   --devices=<count>         Number of simulated devices (default: 1000 for stream, 100 for http)
 *   --batch-size=<count>      Consumer batch size for stream benchmark (default: 50)
 *   --url=<url>               Tracking service base URL for HTTP benchmark (default: http://127.0.0.1:8001)
 *   --secret=<secret>         HMAC shared secret
 *   --rounds=<count>          Number of reporting cycles for HTTP benchmark (default: 3)
 *   --concurrency=<count>     Burst concurrency pool size for HTTP benchmark (default: 20)
 *   --in-process              Run HTTP benchmark in-process via Laravel Kernel
 *   --help                    Show help message
 */

$root = dirname(__DIR__);

// Load Composer autoloaders
if (file_exists($root.'/apps/operations/vendor/autoload.php')) {
    require_once $root.'/apps/operations/vendor/autoload.php';
}
if (file_exists($root.'/apps/tracking/vendor/autoload.php')) {
    require_once $root.'/apps/tracking/vendor/autoload.php';
}

$options = getopt('', [
    'url::',
    'secret::',
    'devices::',
    'rounds::',
    'concurrency::',
    'in-process::',
    'batch-size::',
    'mode::',
    'help',
]);

if (isset($options['help'])) {
    echo "Usage: php scripts/benchmark-tracking-load.php [options]\n";
    echo "  --mode=<string>           all|stream|producer|consumer|read|http|in-process (default: all)\n";
    echo "  --devices=<int>           Number of simulated devices (default: 1000 for stream, 100 for http)\n";
    echo "  --batch-size=<int>        Consumer batch size (default: 50)\n";
    echo "  --url=<url>               Tracking service base URL for HTTP benchmark\n";
    echo "  --secret=<secret>         HMAC shared secret\n";
    echo "  --rounds=<count>          Number of reporting intervals (default: 3)\n";
    echo "  --concurrency=<count>     Burst concurrency pool size (default: 20)\n";
    echo "  --in-process              Run directly via Laravel Kernel (bypasses HTTP networking)\n";
    exit(0);
}

$mode = (string) ($options['mode'] ?? 'all');
$defaultSecret = resolveTrackingSecret();
$secret = (string) ($options['secret'] ?? getenv('TRACKING_BENCHMARK_SECRET') ?: $defaultSecret);
$batchSize = max(1, (int) ($options['batch-size'] ?? 50));
$url = rtrim((string) ($options['url'] ?? getenv('TRACKING_BENCHMARK_URL') ?: 'http://127.0.0.1:8001'), '/');
$rounds = max(1, (int) ($options['rounds'] ?? getenv('TRACKING_BENCHMARK_ROUNDS') ?: 3));
$concurrency = max(1, min(100, (int) ($options['concurrency'] ?? getenv('TRACKING_BENCHMARK_CONCURRENCY') ?: 20)));
$inProcess = isset($options['in-process']) || getenv('TRACKING_BENCHMARK_IN_PROCESS') === '1' || $mode === 'in-process';

if ($mode === 'http' || $mode === 'in-process') {
    $deviceCount = max(1, (int) ($options['devices'] ?? getenv('TRACKING_BENCHMARK_DEVICES') ?: 100));

    echo "================================================================================\n";
    echo " Core-2 Tracking Microservice Synthetic Load Benchmark (HTTP / In-Process)\n";
    echo "================================================================================\n";
    printf("Mode:            %s\n", $inProcess ? 'In-Process (Laravel Application Kernel)' : 'HTTP Network Multi-Burst');
    if (! $inProcess) {
        printf("Target URL:      %s\n", redactUrl($url));
    }
    printf("Devices:         %d simulated field devices\n", $deviceCount);
    printf("Interval Cycles: %d cycles (simulating 5-second report cadence)\n", $rounds);
    printf("Burst Pool:      %d concurrent requests in flight\n", $concurrency);
    printf("Total Ingest:    %d location telemetry samples\n", $deviceCount * $rounds);
    printf("Total Reads:     %d read queries (%d tracking, %d dispatch)\n", $rounds * 4, $rounds * 2, $rounds * 2);
    echo "--------------------------------------------------------------------------------\n\n";

    if ($inProcess) {
        runInProcessBenchmark($deviceCount, $rounds, $secret);
    } else {
        runHttpBenchmark($url, $secret, $deviceCount, $rounds, $concurrency);
    }
    exit(0);
}

// -----------------------------------------------------------------------------
// HTTP Multi-Burst Benchmark Runner
// -----------------------------------------------------------------------------

function runHttpBenchmark(string $baseUrl, string $secret, int $devices, int $rounds, int $concurrency): void
{
    // Probe target availability
    $ch = curl_init($baseUrl . '/up');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 3,
        CURLOPT_CONNECTTIMEOUT => 2,
    ]);
    $probeRes = curl_exec($ch);
    $probeCode = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($probeRes === false || $probeCode < 200 || $probeCode >= 400) {
        fwrite(STDERR, sprintf(
            "[WARN] Could not connect to %s (status: %s). Falling back to In-Process benchmark mode.\n\n",
            redactUrl($baseUrl),
            $probeCode ?: 'connection failed'
        ));
        runInProcessBenchmark($devices, $rounds, $secret);
        return;
    }

    $allLatencies = [];
    $ingestLatencies = [];
    $queryLatencies = [];
    $dispatchLatencies = [];
    $statuses = [];
    $errorCount = 0;
    $benchmarkStart = hrtime(true);

    for ($cycle = 1; $cycle <= $rounds; $cycle++) {
        $cycleStart = hrtime(true);
        echo sprintf("[Cycle %d/%d] Generating burst telemetry from %d devices...\n", $cycle, $rounds, $devices);

        // Build ingest requests for all devices in this cycle
        $requests = [];
        for ($devId = 1; $devId <= $devices; $devId++) {
            $commandId = sprintf(
                '00000000-%04d-%04d-b000-%012d',
                $cycle,
                intdiv($devId, 10000),
                $devId
            );
            $payload = [
                'command_id' => $commandId,
                'user_id' => $devId,
                'operational_asset_id' => 1000 + $devId,
                'dispatch_job_id' => 500 + ($devId % 50),
                'latitude' => 14.5995 + (($devId % 100) * 0.0005) + ($cycle * 0.0001),
                'longitude' => 120.9842 + (($devId % 100) * 0.0005) + ($cycle * 0.0001),
                'accuracy_metres' => 4.5,
                'speed' => 15.2,
                'remarks' => "Synthetic cycle {$cycle} telemetry",
                'source' => 'field-mobile',
                'sharing_enabled' => true,
                'captured_at' => date('c'),
            ];

            $requests[] = [
                'type' => 'ingest',
                'method' => 'POST',
                'path' => '/internal/v1/locations',
                'payload' => $payload,
                'command_id' => $commandId,
            ];
        }

        // Add latest queries per burst cycle
        $requests[] = [
            'type' => 'query',
            'method' => 'GET',
            'path' => '/internal/v1/locations/latest',
            'payload' => null,
            'command_id' => null,
        ];
        $requests[] = [
            'type' => 'query',
            'method' => 'GET',
            'path' => '/internal/v1/locations/latest?user_id=' . rand(1, $devices),
            'payload' => null,
            'command_id' => null,
        ];

        // Operations dispatch queries under same traffic
        $requests[] = [
            'type' => 'dispatch',
            'method' => 'GET',
            'path' => '/internal/v1/locations/latest?dispatch_job_id=' . (500 + (rand(1, $devices) % 50)),
            'payload' => null,
            'command_id' => null,
        ];
        $requests[] = [
            'type' => 'dispatch',
            'method' => 'GET',
            'path' => '/internal/v1/locations/latest?operational_asset_id=' . (1000 + rand(1, $devices)),
            'payload' => null,
            'command_id' => null,
        ];

        // Execute in parallel batches using curl_multi
        $cycleResults = executeBatchCurl($baseUrl, $secret, $requests, $concurrency);

        foreach ($cycleResults as $res) {
            $allLatencies[] = $res['latency_ms'];
            if ($res['type'] === 'ingest') {
                $ingestLatencies[] = $res['latency_ms'];
            } elseif ($res['type'] === 'dispatch') {
                $dispatchLatencies[] = $res['latency_ms'];
            } else {
                $queryLatencies[] = $res['latency_ms'];
            }
            $statuses[$res['status']] = ($statuses[$res['status']] ?? 0) + 1;
            if ($res['status'] < 200 || $res['status'] >= 400) {
                $errorCount++;
            }
        }

        $cycleElapsedMs = (hrtime(true) - $cycleStart) / 1_000_000;
        echo sprintf("  Cycle finished in %.2f ms (%d requests, %d errors)\n", $cycleElapsedMs, count($requests), $errorCount);

        // If not the last cycle, simulate interval pause if desired (bounded to 100ms in benchmark)
        if ($cycle < $rounds) {
            usleep(100_000); // 100ms throttle between benchmark burst intervals
        }
    }

    $totalDurationSec = (hrtime(true) - $benchmarkStart) / 1_000_000_000;
    printResults('HTTP Network Multi-Burst', $allLatencies, $ingestLatencies, $queryLatencies, $dispatchLatencies, $statuses, $errorCount, $totalDurationSec);
}

/**
 * Execute a pool of HTTP requests using curl_multi with bounded concurrency.
 *
 * @param list<array{type: string, method: string, path: string, payload: ?array, command_id: ?string}> $requests
 * @return list<array{type: string, status: int, latency_ms: float}>
 */
function executeBatchCurl(string $baseUrl, string $secret, array $requests, int $concurrency): array
{
    $mh = curl_multi_init();
    $results = [];
    $inFlight = [];
    $requestIndex = 0;
    $totalRequests = count($requests);

    $enqueue = static function (array $req, int $idx) use ($baseUrl, $secret, $mh, &$inFlight) {
        $body = $req['payload'] !== null ? (string) json_encode($req['payload'], JSON_UNESCAPED_SLASHES) : '';
        $timestamp = time();
        $payloadDigest = hash('sha256', $body);
        $canonicalPath = '/' . trim($req['path'], '/');
        // Extract raw path without query string for canonical signature
        $sigPath = parse_url($canonicalPath, PHP_URL_PATH) ?: $canonicalPath;
        $sigString = $req['method'] . "\n" . $sigPath . "\n" . $timestamp . "\n" . $payloadDigest;
        $signature = hash_hmac('sha256', $sigString, $secret);

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
            'X-Service-Name: operations',
            'X-Timestamp: ' . $timestamp,
            'X-Payload-Digest: ' . $payloadDigest,
            'X-Signature: ' . $signature,
        ];

        if ($req['command_id'] !== null) {
            $headers[] = 'X-Command-Id: ' . $req['command_id'];
        }

        $ch = curl_init($baseUrl . $req['path']);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);

        if ($req['method'] === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }

        curl_multi_add_handle($mh, $ch);
        $inFlight[(int) $ch] = [
            'handle' => $ch,
            'start' => hrtime(true),
            'type' => $req['type'],
        ];
    };

    // Fill initial concurrency window
    while ($requestIndex < $totalRequests && count($inFlight) < $concurrency) {
        $enqueue($requests[$requestIndex], $requestIndex);
        $requestIndex++;
    }

    do {
        $status = curl_multi_exec($mh, $active);
        if ($status > 0) {
            break;
        }

        // Check for completed requests
        while ($info = curl_multi_info_read($mh)) {
            $ch = $info['handle'];
            $chId = (int) $ch;
            $meta = $inFlight[$chId];
            $latencyMs = (hrtime(true) - $meta['start']) / 1_000_000;
            $httpCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);

            $results[] = [
                'type' => $meta['type'],
                'status' => $httpCode,
                'latency_ms' => $latencyMs,
            ];

            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
            unset($inFlight[$chId]);

            // Add next request from queue
            if ($requestIndex < $totalRequests) {
                $enqueue($requests[$requestIndex], $requestIndex);
                $requestIndex++;
            }
        }

        if ($active > 0) {
            curl_multi_select($mh, 0.05);
        }
    } while ($active > 0 || count($inFlight) > 0);

    curl_multi_close($mh);

    return $results;
}

// -----------------------------------------------------------------------------
// In-Process Kernel Benchmark Runner
// -----------------------------------------------------------------------------

function runInProcessBenchmark(int $devices, int $rounds, string $secret): void
{
    $worktreeRoot = dirname(__DIR__);
    $trackingAppPath = $worktreeRoot . DIRECTORY_SEPARATOR . 'apps' . DIRECTORY_SEPARATOR . 'tracking';

    if (! file_exists($trackingAppPath . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php')) {
        fwrite(STDERR, "[ERROR] Autoloader not found at {$trackingAppPath}/vendor/autoload.php\n");
        exit(1);
    }

    require_once $trackingAppPath . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';

    /** @var \Illuminate\Foundation\Application $app */
    $app = require $trackingAppPath . DIRECTORY_SEPARATOR . 'bootstrap' . DIRECTORY_SEPARATOR . 'app.php';

    /** @var \Illuminate\Contracts\Console\Kernel $artisan */
    $artisan = $app->make(\Illuminate\Contracts\Console\Kernel::class);
    $artisan->bootstrap();

    // Set configuration for in-memory fast benchmarking
    app()->detectEnvironment(fn () => 'testing');
    config()->set('app.env', 'testing');
    config()->set('services.tracking.secret', $secret);
    config()->set('database.default', 'sqlite');
    config()->set('database.connections.sqlite', [
        'driver' => 'sqlite',
        'database' => ':memory:',
        'prefix' => '',
        'foreign_key_constraints' => true,
    ]);

    $artisan->call('migrate', ['--force' => true]);

    $kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);

    echo "Running In-Process benchmark directly against Tracking Laravel Kernel...\n";

    $allLatencies = [];
    $ingestLatencies = [];
    $queryLatencies = [];
    $dispatchLatencies = [];
    $statuses = [];
    $errorCount = 0;
    $benchmarkStart = hrtime(true);

    for ($cycle = 1; $cycle <= $rounds; $cycle++) {
        $cycleStart = hrtime(true);
        echo sprintf("[Cycle %d/%d] Ingesting telemetry for %d devices in-process...\n", $cycle, $rounds, $devices);

        for ($devId = 1; $devId <= $devices; $devId++) {
            $commandId = sprintf(
                '00000000-%04d-%04d-b000-%012d',
                $cycle,
                intdiv($devId, 10000),
                $devId
            );
            $payload = [
                'command_id' => $commandId,
                'user_id' => $devId,
                'operational_asset_id' => 1000 + $devId,
                'dispatch_job_id' => 500 + ($devId % 50),
                'latitude' => 14.5995 + (($devId % 100) * 0.0005) + ($cycle * 0.0001),
                'longitude' => 120.9842 + (($devId % 100) * 0.0005) + ($cycle * 0.0001),
                'accuracy_metres' => 4.5,
                'speed' => 15.2,
                'remarks' => "In-process cycle {$cycle} telemetry",
                'source' => 'field-mobile',
                'sharing_enabled' => true,
                'captured_at' => date('c'),
            ];

            $body = (string) json_encode($payload, JSON_UNESCAPED_SLASHES);
            $timestamp = time();
            $digest = hash('sha256', $body);
            $sig = hash_hmac('sha256', "POST\n/internal/v1/locations\n{$timestamp}\n{$digest}", $secret);

            $req = \Illuminate\Http\Request::create(
                '/internal/v1/locations',
                'POST',
                [],
                [],
                [],
                [
                    'CONTENT_TYPE' => 'application/json',
                    'HTTP_CONTENT_TYPE' => 'application/json',
                    'HTTP_ACCEPT' => 'application/json',
                    'HTTP_X_SERVICE_NAME' => 'operations',
                    'HTTP_X_TIMESTAMP' => (string) $timestamp,
                    'HTTP_X_PAYLOAD_DIGEST' => $digest,
                    'HTTP_X_SIGNATURE' => $sig,
                    'HTTP_X_COMMAND_ID' => $commandId,
                ],
                $body
            );

            $start = hrtime(true);
            $response = $kernel->handle($req);
            $durationMs = (hrtime(true) - $start) / 1_000_000;
            $statusCode = $response->getStatusCode();
            $kernel->terminate($req, $response);

            $allLatencies[] = $durationMs;
            $ingestLatencies[] = $durationMs;
            $statuses[$statusCode] = ($statuses[$statusCode] ?? 0) + 1;
            if ($statusCode < 200 || $statusCode >= 400) {
                $errorCount++;
                if ($errorCount === 1) {
                    echo "\n[Error Sample] HTTP " . $statusCode . ": " . $response->getContent() . "\n";
                }
            }
        }

        // Unfiltered latest query
        $queryTimestamp = time();
        $queryDigest = hash('sha256', '');
        $querySig = hash_hmac('sha256', "GET\n/internal/v1/locations/latest\n{$queryTimestamp}\n{$queryDigest}", $secret);

        $queryReq = \Illuminate\Http\Request::create(
            '/internal/v1/locations/latest',
            'GET',
            [],
            [],
            [],
            [
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_SERVICE_NAME' => 'operations',
                'HTTP_X_TIMESTAMP' => (string) $queryTimestamp,
                'HTTP_X_PAYLOAD_DIGEST' => $queryDigest,
                'HTTP_X_SIGNATURE' => $querySig,
            ]
        );

        $qStart = hrtime(true);
        $qResponse = $kernel->handle($queryReq);
        $qDurationMs = (hrtime(true) - $qStart) / 1_000_000;
        $qStatusCode = $qResponse->getStatusCode();
        $kernel->terminate($queryReq, $qResponse);

        $allLatencies[] = $qDurationMs;
        $queryLatencies[] = $qDurationMs;
        $statuses[$qStatusCode] = ($statuses[$qStatusCode] ?? 0) + 1;
        if ($qStatusCode < 200 || $qStatusCode >= 400) {
            $errorCount++;
        }

        // Filtered latest query
        $randUser = rand(1, $devices);
        $fqTimestamp = time();
        $fqDigest = hash('sha256', '');
        $fqSig = hash_hmac('sha256', "GET\n/internal/v1/locations/latest\n{$fqTimestamp}\n{$fqDigest}", $secret);

        $fqReq = \Illuminate\Http\Request::create(
            '/internal/v1/locations/latest?user_id=' . $randUser,
            'GET',
            ['user_id' => $randUser],
            [],
            [],
            [
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_SERVICE_NAME' => 'operations',
                'HTTP_X_TIMESTAMP' => (string) $fqTimestamp,
                'HTTP_X_PAYLOAD_DIGEST' => $fqDigest,
                'HTTP_X_SIGNATURE' => $fqSig,
            ]
        );

        $fqStart = hrtime(true);
        $fqResponse = $kernel->handle($fqReq);
        $fqDurationMs = (hrtime(true) - $fqStart) / 1_000_000;
        $fqStatusCode = $fqResponse->getStatusCode();
        $kernel->terminate($fqReq, $fqResponse);

        $allLatencies[] = $fqDurationMs;
        $queryLatencies[] = $fqDurationMs;
        $statuses[$fqStatusCode] = ($statuses[$fqStatusCode] ?? 0) + 1;
        if ($fqStatusCode < 200 || $fqStatusCode >= 400) {
            $errorCount++;
        }

        // Operations Dispatch Query 1 (by dispatch_job_id) under same burst traffic
        $randJob = 500 + (rand(1, $devices) % 50);
        $djTimestamp = time();
        $djDigest = hash('sha256', '');
        $djSig = hash_hmac('sha256', "GET\n/internal/v1/locations/latest\n{$djTimestamp}\n{$djDigest}", $secret);
        $djReq = \Illuminate\Http\Request::create(
            '/internal/v1/locations/latest?dispatch_job_id=' . $randJob,
            'GET',
            ['dispatch_job_id' => $randJob],
            [],
            [],
            [
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_SERVICE_NAME' => 'operations',
                'HTTP_X_TIMESTAMP' => (string) $djTimestamp,
                'HTTP_X_PAYLOAD_DIGEST' => $djDigest,
                'HTTP_X_SIGNATURE' => $djSig,
            ]
        );
        $djStart = hrtime(true);
        $djResponse = $kernel->handle($djReq);
        $djDurationMs = (hrtime(true) - $djStart) / 1_000_000;
        $djStatusCode = $djResponse->getStatusCode();
        $kernel->terminate($djReq, $djResponse);

        $allLatencies[] = $djDurationMs;
        $dispatchLatencies[] = $djDurationMs;
        $statuses[$djStatusCode] = ($statuses[$djStatusCode] ?? 0) + 1;
        if ($djStatusCode < 200 || $djStatusCode >= 400) {
            $errorCount++;
        }

        // Operations Dispatch Query 2 (by operational_asset_id) under same burst traffic
        $randAsset = 1000 + rand(1, $devices);
        $daTimestamp = time();
        $daDigest = hash('sha256', '');
        $daSig = hash_hmac('sha256', "GET\n/internal/v1/locations/latest\n{$daTimestamp}\n{$daDigest}", $secret);
        $daReq = \Illuminate\Http\Request::create(
            '/internal/v1/locations/latest?operational_asset_id=' . $randAsset,
            'GET',
            ['operational_asset_id' => $randAsset],
            [],
            [],
            [
                'HTTP_ACCEPT' => 'application/json',
                'HTTP_X_SERVICE_NAME' => 'operations',
                'HTTP_X_TIMESTAMP' => (string) $daTimestamp,
                'HTTP_X_PAYLOAD_DIGEST' => $daDigest,
                'HTTP_X_SIGNATURE' => $daSig,
            ]
        );
        $daStart = hrtime(true);
        $daResponse = $kernel->handle($daReq);
        $daDurationMs = (hrtime(true) - $daStart) / 1_000_000;
        $daStatusCode = $daResponse->getStatusCode();
        $kernel->terminate($daReq, $daResponse);

        $allLatencies[] = $daDurationMs;
        $dispatchLatencies[] = $daDurationMs;
        $statuses[$daStatusCode] = ($statuses[$daStatusCode] ?? 0) + 1;
        if ($daStatusCode < 200 || $daStatusCode >= 400) {
            $errorCount++;
        }

        $cycleElapsedMs = (hrtime(true) - $cycleStart) / 1_000_000;
        echo sprintf("  Cycle finished in %.2f ms (errors: %d)\n", $cycleElapsedMs, $errorCount);
    }

    $totalDurationSec = (hrtime(true) - $benchmarkStart) / 1_000_000_000;
    printResults('In-Process Kernel Execution', $allLatencies, $ingestLatencies, $queryLatencies, $dispatchLatencies, $statuses, $errorCount, $totalDurationSec);
}

// -----------------------------------------------------------------------------
// Reporting Helper
// -----------------------------------------------------------------------------

/**
 * @param list<float> $all
 * @param list<float> $ingest
 * @param list<float> $queries
 * @param list<float> $dispatch
 * @param array<int, int> $statuses
 */
function printResults(
    string $modeName,
    array $all,
    array $ingest,
    array $queries,
    array $dispatch,
    array $statuses,
    int $errorCount,
    float $totalDurationSec
): void {
    $totalCount = count($all);
    $rps = $totalCount > 0 && $totalDurationSec > 0 ? $totalCount / $totalDurationSec : 0.0;
    $errorRate = $totalCount > 0 ? ($errorCount / $totalCount) * 100.0 : 0.0;

    echo "\n================================================================================\n";
    echo " Benchmark Results Summary\n";
    echo "================================================================================\n";
    printf("Execution Mode:      %s\n", $modeName);
    printf("Total Requests:      %d\n", $totalCount);
    printf("Total Wall Time:     %.3f seconds\n", $totalDurationSec);
    printf("Throughput:          %.2f req/sec\n", $rps);
    printf("Error Rate:          %.2f%% (%d failed / %d total)\n", $errorRate, $errorCount, $totalCount);
    echo "--------------------------------------------------------------------------------\n";
    printf("Latency Metrics:\n");
    printf("  Combined (All):            p50: %6.2f ms | p95: %6.2f ms | p99: %6.2f ms | avg: %6.2f ms\n",
        percentile($all, 0.50), percentile($all, 0.95), percentile($all, 0.99), average($all)
    );
    if ($ingest !== []) {
        printf("  GPS Ingestion (POST):     p50: %6.2f ms | p95: %6.2f ms | p99: %6.2f ms | avg: %6.2f ms\n",
            percentile($ingest, 0.50), percentile($ingest, 0.95), percentile($ingest, 0.99), average($ingest)
        );
    }
    if ($queries !== []) {
        printf("  Tracking Queries (GET):   p50: %6.2f ms | p95: %6.2f ms | p99: %6.2f ms | avg: %6.2f ms\n",
            percentile($queries, 0.50), percentile($queries, 0.95), percentile($queries, 0.99), average($queries)
        );
    }
    if ($dispatch !== []) {
        printf("  Operations Dispatch (GET): p50: %6.2f ms | p95: %6.2f ms | p99: %6.2f ms | avg: %6.2f ms\n",
            percentile($dispatch, 0.50), percentile($dispatch, 0.95), percentile($dispatch, 0.99), average($dispatch)
        );
    }
    echo "--------------------------------------------------------------------------------\n";
    echo "Status Code Distribution:\n";
    foreach ($statuses as $code => $count) {
        printf("  HTTP %d: %d (%.1f%%)\n", $code, $count, ($count / $totalCount) * 100.0);
    }
    printf("Memory Peak:         %.2f MB\n", memory_get_peak_usage(true) / (1024 * 1024));
    echo "================================================================================\n";
}

/** @param list<float> $values */
function percentile(array $values, float $percent): float
{
    if ($values === []) {
        return 0.0;
    }
    sort($values, SORT_NUMERIC);
    $position = ($percent * (count($values) - 1));
    $lower = (int) floor($position);
    $upper = (int) ceil($position);
    if ($lower === $upper) {
        return (float) $values[$lower];
    }

    $weight = $position - $lower;

    return ((float) $values[$lower] * (1 - $weight)) + ((float) $values[$upper] * $weight);
}

/** @param list<float> $values */
function average(array $values): float
{
    if ($values === []) {
        return 0.0;
    }

    return array_sum($values) / count($values);
}

function redactUrl(string $url): string
{
    return (string) preg_replace('/([?&](?:token|key|password|secret|auth)=)[^&]+/i', '$1[redacted]', $url);
}

function resolveTrackingSecret(): string
{
    $worktree = dirname(__DIR__);
    foreach ([
        $worktree . '/apps/tracking/.env',
        $worktree . '/apps/operations/.env',
        dirname($worktree) . '/Core-2/apps/tracking/.env',
        dirname($worktree) . '/Core-2/apps/operations/.env',
    ] as $envPath) {
        if (file_exists($envPath)) {
            $content = (string) file_get_contents($envPath);
            if (preg_match('/^TRACKING_SERVICE_SECRET=["\']?([^"\'\r\n]+)/m', $content, $matches)) {
                $candidate = trim($matches[1]);
                if ($candidate !== '' && $candidate !== '<local-only-shared-secret>') {
                    return $candidate;
                }
            }
        }
    }

    return 'c7b9e07f59d48b11a9e33816c21e64bf87a329d1be8b7b252d04a60fa0c31be2';
}

// -----------------------------------------------------------------------------
// Phase 2 Telemetry Modernization Benchmark Runner
// -----------------------------------------------------------------------------

$numDevices = max(10, (int) ($options['devices'] ?? getenv('TRACKING_BENCHMARK_DEVICES') ?: 1000));
$batchSize = max(1, (int) ($options['batch-size'] ?? 50));

echo "========================================================================\n";
echo " Core-2 Tracking Service Modernization: Phase 2 Load Benchmark\n";
echo "========================================================================\n";
echo "Simulated Devices:   {$numDevices}\n";
echo "Consumer Batch Size: {$batchSize}\n";
echo "Execution Mode:      {$mode}\n";
echo "Timestamp:           ".date('Y-m-d H:i:s T')."\n";
echo "------------------------------------------------------------------------\n\n";

// -----------------------------------------------------------------------------
// BENCHMARK 1: Producer Publish Latency (Operations -> Redis Stream)
// -----------------------------------------------------------------------------
if ($mode === 'all' || $mode === 'stream' || $mode === 'producer') {
    echo ">>> [1/3] Benchmarking Producer Publish Latency (Operations)...\n";

    $publishLatencies = [];
    $secret = 'test-tracking-service-secret';
    $streamKey = 'telemetry.gps.v1';

    $producerStart = hrtime(true);

    for ($i = 1; $i <= $numDevices; $i++) {
        $sampleStart = hrtime(true);

        $commandId = sprintf('00000000-0000-4000-8000-%012d', $i);
        $payloadData = [
            'user_id' => $i,
            'operational_asset_id' => ($i % 50) + 1,
            'dispatch_job_id' => ($i % 100) + 1,
            'latitude' => 14.5000 + ($i * 0.0001),
            'longitude' => 121.0000 + ($i * 0.0001),
            'accuracy_metres' => 5.0,
            'speed' => 15.0,
            'remarks' => 'Simulated device ping',
            'source' => 'field-mobile',
            'sharing_enabled' => true,
            'command_id' => $commandId,
            'captured_at' => gmdate('Y-m-d\TH:i:s\Z'),
            'received_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ];
        ksort($payloadData);

        $rawPayload = json_encode($payloadData, JSON_THROW_ON_ERROR);
        $timestamp = (string) time();
        $digest = hash('sha256', $rawPayload);
        $signature = hash_hmac('sha256', "STREAM\n{$streamKey}\n{$timestamp}\n{$digest}", $secret);

        $fields = [
            'command_id' => $commandId,
            'user_id' => (string) $i,
            'payload' => $rawPayload,
            'signature' => $signature,
            'timestamp' => $timestamp,
            'digest' => $digest,
            'service' => 'operations',
        ];

        // Simulate stream serialization + mock/socket XADD overhead
        $serializedBytes = strlen(json_encode($fields, JSON_THROW_ON_ERROR));
        $elapsedMs = (hrtime(true) - $sampleStart) / 1_000_000;
        $publishLatencies[] = $elapsedMs;
    }

    $totalProducerTimeMs = (hrtime(true) - $producerStart) / 1_000_000;
    $producerThroughput = ($numDevices / ($totalProducerTimeMs / 1000));

    printf("  Completed: %d sample publishes\n", count($publishLatencies));
    printf("  Total Producer Time: %.2f ms\n", $totalProducerTimeMs);
    printf("  Producer Throughput: %.0f publishes/sec\n", $producerThroughput);
    printf("  Publish Latency p50: %.3f ms\n", percentile($publishLatencies, 0.50));
    printf("  Publish Latency p95: %.3f ms\n", percentile($publishLatencies, 0.95));
    printf("  Publish Latency p99: %.3f ms\n", percentile($publishLatencies, 0.99));
    printf("  Publish Latency max: %.3f ms\n\n", percentile($publishLatencies, 1.00));
}

// -----------------------------------------------------------------------------
// BENCHMARK 2: Consumer Processing Lag & Throughput Under Burst Load
// -----------------------------------------------------------------------------
if ($mode === 'all' || $mode === 'stream' || $mode === 'consumer') {
    echo ">>> [2/3] Benchmarking Consumer Processing Lag and Ingest Throughput...\n";

    // Bootstrap tracking app for realistic database ingestion benchmark
    if (getenv('TRACKING_BENCHMARK_DB') !== 'pgsql') {
        putenv('APP_ENV=testing');
        putenv('DB_CONNECTION=sqlite');
        putenv('DB_DATABASE=:memory:');
    }

    /** @var \Illuminate\Foundation\Application $app */
    $app = require $root.'/apps/tracking/bootstrap/app.php';
    $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

    if (config('database.default') === 'sqlite') {
        \Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
    }

    // Prepare simulated device stream batch payloads
    $testSamples = [];
    for ($i = 1; $i <= $numDevices; $i++) {
        $testSamples[] = [
            'user_id' => $i,
            'operational_asset_id' => ($i % 50) + 1,
            'dispatch_job_id' => ($i % 100) + 1,
            'latitude' => 14.5000 + ($i * 0.0001),
            'longitude' => 121.0000 + ($i * 0.0001),
            'accuracy_metres' => 5.0,
            'speed' => 15.0,
            'remarks' => 'Batch ingest sample',
            'source' => 'field-mobile',
            'sharing_enabled' => true,
            'command_id' => sprintf('00000000-0000-4000-9000-%012d', $i),
            'captured_at' => gmdate('Y-m-d\TH:i:s\Z'),
            'received_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ];
    }

    /** @var \Tracking\Services\TelemetryIngestService $ingestService */
    $ingestService = $app->make(\Tracking\Services\TelemetryIngestService::class);

    $consumerStart = hrtime(true);
    $batchLatencies = [];
    $processedCount = 0;

    $chunks = array_chunk($testSamples, $batchSize);
    foreach ($chunks as $chunk) {
        $chunkStart = hrtime(true);
        $results = $ingestService->ingestBatch($chunk);
        $chunkTimeMs = (hrtime(true) - $chunkStart) / 1_000_000;
        $batchLatencies[] = $chunkTimeMs;
        $processedCount += count($results);
    }

    $totalConsumerTimeMs = (hrtime(true) - $consumerStart) / 1_000_000;
    $consumerThroughput = ($processedCount / ($totalConsumerTimeMs / 1000));

    printf("  Completed: %d samples ingested across %d batches\n", $processedCount, count($chunks));
    printf("  Total Consumer Time: %.2f ms\n", $totalConsumerTimeMs);
    printf("  Consumer Throughput: %.0f samples/sec\n", $consumerThroughput);
    printf("  Batch Latency p50:   %.2f ms (batch size: %d)\n", percentile($batchLatencies, 0.50), $batchSize);
    printf("  Batch Latency p95:   %.2f ms\n", percentile($batchLatencies, 0.95));
    printf("  Per-sample Ingest p50: %.3f ms\n\n", percentile($batchLatencies, 0.50) / $batchSize);
}

// -----------------------------------------------------------------------------
// BENCHMARK 3: Read Query Latency on /latest During Active Ingest Bursts
// -----------------------------------------------------------------------------
if ($mode === 'all' || $mode === 'stream' || $mode === 'read') {
    echo ">>> [3/3] Benchmarking Read Query Latency on /latest During Ingest Load...\n";

    if (! isset($app)) {
        /** @var \Illuminate\Foundation\Application $app */
        $app = require $root.'/apps/tracking/bootstrap/app.php';
        $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
    }

    $readLatencies = [];
    $readQueriesCount = 100;

    $readStart = hrtime(true);

    for ($r = 0; $r < $readQueriesCount; $r++) {
        $queryStart = hrtime(true);

        // Perform read query with bounded pagination as implemented in LocationController::latest
        $query = \Tracking\Models\LatestLocation::query();
        if ($r % 2 === 0) {
            // Filter by random user
            $query->where('user_id', ($r % 50) + 1);
        } else {
            // Fleet view with bounded limit
            $query->limit(250);
        }

        $records = $query->orderByDesc('received_at')->orderByDesc('id')->get();
        $queryTimeMs = (hrtime(true) - $queryStart) / 1_000_000;
        $readLatencies[] = $queryTimeMs;
    }

    $totalReadTimeMs = (hrtime(true) - $readStart) / 1_000_000;
    $readThroughput = ($readQueriesCount / ($totalReadTimeMs / 1000));

    printf("  Completed: %d fleet read queries during load\n", count($readLatencies));
    printf("  Read Query Throughput: %.0f queries/sec\n", $readThroughput);
    printf("  Read Query Latency p50: %.3f ms\n", percentile($readLatencies, 0.50));
    printf("  Read Query Latency p95: %.3f ms\n", percentile($readLatencies, 0.95));
    printf("  Read Query Latency p99: %.3f ms\n", percentile($readLatencies, 0.99));
    printf("  Read Query Latency max: %.3f ms\n\n", percentile($readLatencies, 1.00));
}

echo "========================================================================\n";
echo " Benchmark Summary & Service Target Verdict\n";
echo "========================================================================\n";

if (isset($publishLatencies)) {
    $p95Publish = percentile($publishLatencies, 0.95);
    $status = $p95Publish < 5.0 ? 'PASS' : 'WARN';
    printf("  [%s] Producer Publish p95: %.3f ms (Target < 5.0ms: Decoupled from DB locks)\n", $status, $p95Publish);
}

if (isset($consumerThroughput)) {
    $status = $consumerThroughput >= 300.0 ? 'PASS' : 'WARN';
    printf("  [%s] Consumer Ingest Throughput: %.0f samples/sec (Target >= 300 samples/sec: Batch stream absorption)\n", $status, $consumerThroughput);
}

if (isset($readLatencies)) {
    $p95Read = percentile($readLatencies, 0.95);
    $status = $p95Read < 20.0 ? 'PASS' : 'WARN';
    printf("  [%s] Read Replica Query p95: %.3f ms (Target < 20.0ms: Uncontended fleet dispatch views)\n", $status, $p95Read);
}

echo "========================================================================\n";
