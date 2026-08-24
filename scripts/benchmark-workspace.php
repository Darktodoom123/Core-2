<?php

declare(strict_types=1);

/**
 * Small credential-safe benchmark for the optimized workspace routes.
 *
 * Required: WORKSPACE_BENCHMARK_URL
 * Optional: WORKSPACE_BENCHMARK_REQUESTS, WORKSPACE_BENCHMARK_AUTH_HEADER,
 *           WORKSPACE_BENCHMARK_COOKIE, WORKSPACE_BENCHMARK_INERTIA_VERSION
 */
$url = getenv('WORKSPACE_BENCHMARK_URL') ?: '';
$requests = max(3, (int) (getenv('WORKSPACE_BENCHMARK_REQUESTS') ?: 20));

if ($url === '') {
    fwrite(STDERR, "Set WORKSPACE_BENCHMARK_URL before running the benchmark.\n");
    exit(2);
}

$headers = [
    'Accept: text/html, application/xhtml+xml',
    'X-Requested-With: XMLHttpRequest',
    'X-Inertia: true',
];

foreach (['WORKSPACE_BENCHMARK_AUTH_HEADER' => 'Authorization', 'WORKSPACE_BENCHMARK_COOKIE' => 'Cookie'] as $variable => $header) {
    $value = getenv($variable);
    if (is_string($value) && $value !== '') {
        $headers[] = $header.': '.$value;
    }
}

$version = getenv('WORKSPACE_BENCHMARK_INERTIA_VERSION');
if (is_string($version) && $version !== '') {
    $headers[] = 'X-Inertia-Version: '.$version;
}

$samples = [];
$responses = [];

for ($index = 0; $index < $requests; $index++) {
    $started = hrtime(true);
    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT => 30,
    ]);

    $raw = curl_exec($handle);
    if ($raw === false) {
        fwrite(STDERR, 'Request failed: '.curl_error($handle)."\n");
        curl_close($handle);

        continue;
    }

    $headerSize = (int) curl_getinfo($handle, CURLINFO_HEADER_SIZE);
    $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
    $responseHeaders = parseHeaders(substr($raw, 0, $headerSize));
    $body = substr($raw, $headerSize);
    curl_close($handle);

    $samples[] = (hrtime(true) - $started) / 1_000_000;
    $responses[] = [
        'status' => $status,
        'bytes' => strlen($body),
        'query_count' => $responseHeaders['x-workspace-query-count'] ?? null,
        'db_time_ms' => $responseHeaders['x-workspace-db-time-ms'] ?? null,
        'payload_bytes' => $responseHeaders['x-workspace-payload-bytes'] ?? null,
    ];
}

if ($samples === []) {
    fwrite(STDERR, "No successful benchmark samples were collected.\n");
    exit(1);
}

sort($samples);
$queryCounts = array_values(array_filter(array_map(
    static fn (array $response): ?int => is_numeric($response['query_count']) ? (int) $response['query_count'] : null,
    $responses,
), static fn (?int $value): bool => $value !== null));
$payloadSizes = array_map(static fn (array $response): int => (int) ($response['payload_bytes'] ?? $response['bytes']), $responses);

printf("URL: %s\n", redactUrl($url));
printf("Samples: %d\n", count($samples));
printf("Wall time p50/p95: %.2f ms / %.2f ms\n", percentile($samples, 0.50), percentile($samples, 0.95));
printf("Payload bytes p50/p95: %.0f / %.0f\n", percentile($payloadSizes, 0.50), percentile($payloadSizes, 0.95));

if ($queryCounts !== []) {
    printf("Query count p50/p95: %.0f / %.0f\n", percentile($queryCounts, 0.50), percentile($queryCounts, 0.95));
} else {
    fwrite(STDERR, "Query headers unavailable; run against local/staging where telemetry headers are enabled.\n");
}

$statuses = array_count_values(array_map(static fn (array $response): string => (string) $response['status'], $responses));
printf("Statuses: %s\n", json_encode($statuses, JSON_THROW_ON_ERROR));

/** @return array<string, string> */
function parseHeaders(string $raw): array
{
    $headers = [];
    foreach (preg_split('/\r?\n/', $raw) ?: [] as $line) {
        $separator = strpos($line, ':');
        if ($separator === false) {
            continue;
        }

        $headers[strtolower(trim(substr($line, 0, $separator)))] = trim(substr($line, $separator + 1));
    }

    return $headers;
}

/** @param list<int|float> $values */
function percentile(array $values, float $percent): float
{
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

function redactUrl(string $url): string
{
    return (string) preg_replace('/([?&](?:token|key|password|secret|auth)=)[^&]+/i', '$1[redacted]', $url);
}
