<?php

declare(strict_types=1);

/**
 * Synthetic Bounded Load-Test Scenario for Tracking Microservice.
 *
 * Simulates 100 devices reporting at 5s intervals with burst load against Tracking endpoints.
 * Measures p50/p95 latency, throughput, and error rates.
 *
 * Usage:
 *   php scripts/benchmark-tracking-load.php [--url=http://127.0.0.1:8001] [--devices=100] [--rounds=3] [--concurrency=20] [--in-process]
 *
 * Options / Environment Variables:
 *   --url, TRACKING_BENCHMARK_URL                     Base URL of Tracking service (default: http://127.0.0.1:8001)
 *   --secret, TRACKING_BENCHMARK_SECRET               HMAC signing secret (default: test-tracking-service-secret)
 *   --devices, TRACKING_BENCHMARK_DEVICES             Number of simulated devices (default: 100)
 *   --rounds, TRACKING_BENCHMARK_ROUNDS               Reporting cycles (default: 3)
 *   --concurrency, TRACKING_BENCHMARK_CONCURRENCY     Concurrent requests in flight during burst (default: 20)
 *   --in-process, TRACKING_BENCHMARK_IN_PROCESS       Run via in-process Laravel kernel instead of HTTP
 */

$options = getopt('', [
    'url::',
    'secret::',
    'devices::',
    'rounds::',
    'concurrency::',
    'in-process::',
    'help',
]);

if (isset($options['help'])) {
    echo "Usage: php scripts/benchmark-tracking-load.php [options]\n";
    echo "  --url=<url>               Tracking service base URL\n";
    echo "  --secret=<secret>         HMAC shared secret\n";
    echo "  --devices=<count>         Number of simulated mobile devices (default: 100)\n";
    echo "  --rounds=<count>          Number of reporting intervals (default: 3)\n";
    echo "  --concurrency=<count>     Burst concurrency pool size (default: 20)\n";
    echo "  --in-process              Run directly via Laravel Kernel (bypasses HTTP networking)\n";
    exit(0);
}

$url = rtrim((string) ($options['url'] ?? getenv('TRACKING_BENCHMARK_URL') ?: 'http://127.0.0.1:8001'), '/');
$defaultSecret = resolveTrackingSecret();
$secret = (string) ($options['secret'] ?? getenv('TRACKING_BENCHMARK_SECRET') ?: $defaultSecret);
$deviceCount = max(1, (int) ($options['devices'] ?? getenv('TRACKING_BENCHMARK_DEVICES') ?: 100));
$rounds = max(1, (int) ($options['rounds'] ?? getenv('TRACKING_BENCHMARK_ROUNDS') ?: 3));
$concurrency = max(1, min(100, (int) ($options['concurrency'] ?? getenv('TRACKING_BENCHMARK_CONCURRENCY') ?: 20)));
$inProcess = isset($options['in-process']) || getenv('TRACKING_BENCHMARK_IN_PROCESS') === '1';

echo "================================================================================\n";
echo " Core-2 Tracking Microservice Synthetic Load Benchmark\n";
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
