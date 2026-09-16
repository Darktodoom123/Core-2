<?php

namespace Tracking\Console\Commands;

use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Throwable;
use Tracking\Services\TelemetryIngestService;

final class ConsumeTelemetryStreamCommand extends Command
{
    protected $signature = 'tracking:consume-telemetry
        {--group=tracking-ingest-workers : Consumer group name}
        {--consumer= : Consumer identifier (defaults to host and process ID)}
        {--stream=telemetry.gps.v1 : Stream key name}
        {--dlq=telemetry.gps.dlq : Dead letter queue stream key name}
        {--batch-size=50 : Maximum number of messages to fetch per batch}
        {--block-ms=2000 : Milliseconds to block waiting for new messages}
        {--max-deliveries=3 : Maximum delivery attempts before moving to DLQ}
        {--min-idle-ms=10000 : Milliseconds of idle time before claiming pending entries}
        {--once : Run a single consumption cycle and exit}';

    protected $description = 'Consume GPS telemetry samples from Redis Stream and ingest into tracking database.';

    public function __construct(
        private readonly TelemetryIngestService $ingestService,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $group = (string) $this->option('group');
        $stream = (string) $this->option('stream');
        $dlq = (string) $this->option('dlq');
        $batchSize = max(1, (int) $this->option('batch-size'));
        $blockMs = max(0, (int) $this->option('block-ms'));
        $maxDeliveries = max(1, (int) $this->option('max-deliveries'));
        $minIdleMs = max(1000, (int) $this->option('min-idle-ms'));
        $runOnce = (bool) $this->option('once');

        $consumer = (string) ($this->option('consumer') ?: (gethostname() ?: 'tracking-worker').'-'.getmypid());

        $shouldExit = false;
        if (function_exists('pcntl_async_signals') && function_exists('pcntl_signal') && defined('SIGTERM') && defined('SIGINT')) {
            pcntl_async_signals(true);
            pcntl_signal(SIGTERM, function () use (&$shouldExit): void {
                $shouldExit = true;
            });
            pcntl_signal(SIGINT, function () use (&$shouldExit): void {
                $shouldExit = true;
            });
        }

        $secret = (string) config('services.tracking.secret', '');
        if (app()->environment('production') && (strlen($secret) < 16 || in_array($secret, ['test-tracking-service-secret', 'placeholder', 'secret', 'default-tracking-secret', 'changeme'], true))) {
            $this->error('Insecure tracking service secret configured for production.');
            Log::critical('Telemetry stream consumer terminated: insecure tracking secret configured for production.');

            return self::FAILURE;
        }

        $this->info("Initializing telemetry stream consumer [{$consumer}] for group [{$group}] on stream [{$stream}]...");

        $this->ensureConsumerGroupExists($stream, $group);

        do {
            try {
                // 1. Check Pending Entries List (PEL) for retries & dead-lettering
                $this->processPendingEntries($stream, $group, $consumer, $dlq, $maxDeliveries, $minIdleMs, $batchSize, $secret);

                // 2. Read new messages from stream
                $messages = $this->readNewMessages($stream, $group, $consumer, $batchSize, $blockMs);

                if (! empty($messages)) {
                    $this->processMessageBatch($messages, $stream, $group, $dlq, $secret);
                }
            } catch (Throwable $e) {
                Log::error('Error in telemetry stream consumer loop', [
                    'stream' => $stream,
                    'group' => $group,
                    'consumer' => $consumer,
                    'error' => $e->getMessage(),
                ]);
                $this->error('Consumer loop error: '.$e->getMessage());

                if ($runOnce) {
                    return self::FAILURE;
                }

                usleep(500000); // 500ms backoff on error
            }
        } while (! $runOnce && ! $shouldExit);

        return self::SUCCESS;
    }

    /**
     * Ensure the Redis consumer group exists on the stream.
     */
    private function ensureConsumerGroupExists(string $stream, string $group): void
    {
        try {
            Redis::xgroup('CREATE', $stream, $group, '0', true);
        } catch (Throwable $e) {
            // Redis returns BUSYGROUP if the group already exists
            if (str_contains($e->getMessage(), 'BUSYGROUP')) {
                return;
            }

            try {
                Redis::command('xgroup', ['CREATE', $stream, $group, '0', 'MKSTREAM']);
            } catch (Throwable $fallbackError) {
                if (! str_contains($fallbackError->getMessage(), 'BUSYGROUP')) {
                    Log::warning('Unexpected response while creating Redis consumer group', [
                        'stream' => $stream,
                        'group' => $group,
                        'error' => $fallbackError->getMessage(),
                    ]);
                }
            }
        }
    }

    /**
     * Read new messages delivered to this consumer group.
     *
     * @return list<array{id: string, fields: array<string, mixed>}>
     */
    private function readNewMessages(string $stream, string $group, string $consumer, int $batchSize, int $blockMs): array
    {
        try {
            $raw = Redis::xreadgroup($group, $consumer, [$stream => '>'], $batchSize, $blockMs);

            return $this->normalizeStreamEntries($raw, $stream);
        } catch (Throwable $e) {
            // If xreadgroup is not available via facade magic, try command fallback
            try {
                $raw = Redis::command('xreadgroup', [
                    'GROUP', $group, $consumer,
                    'COUNT', $batchSize,
                    'BLOCK', $blockMs,
                    'STREAMS', $stream, '>',
                ]);

                return $this->normalizeStreamEntries($raw, $stream);
            } catch (Throwable $fallbackError) {
                Log::error('Failed to execute XREADGROUP', ['error' => $fallbackError->getMessage()]);

                return [];
            }
        }
    }

    /**
     * Process Pending Entries List (PEL) to handle retry workers and DLQ routing.
     */
    private function processPendingEntries(
        string $stream,
        string $group,
        string $consumer,
        string $dlq,
        int $maxDeliveries,
        int $minIdleMs,
        int $batchSize,
        string $secret,
    ): void {
        try {
            $pendingRaw = Redis::xpending($stream, $group, '-', '+', $batchSize);
        } catch (Throwable) {
            try {
                $pendingRaw = Redis::command('xpending', [$stream, $group, '-', '+', $batchSize]);
            } catch (Throwable) {
                return;
            }
        }

        if (empty($pendingRaw) || ! is_array($pendingRaw)) {
            return;
        }

        $pendingEntries = $this->normalizePendingEntries($pendingRaw);

        $idsToClaim = [];

        foreach ($pendingEntries as $entry) {
            $messageId = $entry['id'];
            $deliveryCount = $entry['delivery_count'];
            $idleMs = $entry['idle_ms'];

            if ($deliveryCount > $maxDeliveries) {
                // Fetch payload from stream before routing to DLQ if available
                $payloadForDlq = '';
                try {
                    $rawEntries = Redis::xrange($stream, $messageId, $messageId);
                    $normalized = $this->normalizeStreamEntries([$stream => $rawEntries], $stream);
                    if (! empty($normalized)) {
                        $payloadForDlq = (string) ($normalized[0]['fields']['payload'] ?? '');
                    }
                } catch (Throwable) {
                    try {
                        $rawEntries = Redis::command('xrange', [$stream, $messageId, $messageId]);
                        $normalized = $this->normalizeStreamEntries($rawEntries, $stream);
                        if (! empty($normalized)) {
                            $payloadForDlq = (string) ($normalized[0]['fields']['payload'] ?? '');
                        }
                    } catch (Throwable) {
                        $payloadForDlq = '';
                    }
                }

                // Exceeded max retries -> route to Dead Letter Queue (DLQ)
                $this->routeToDeadLetterQueue(
                    $stream,
                    $group,
                    $dlq,
                    $messageId,
                    "Exceeded max delivery attempts ({$deliveryCount}/{$maxDeliveries})",
                    $payloadForDlq
                );

                continue;
            }

            if ($idleMs >= $minIdleMs) {
                $idsToClaim[] = $messageId;
            }
        }

        if (! empty($idsToClaim)) {
            $claimedMessages = $this->claimPendingMessages($stream, $group, $consumer, $minIdleMs, $idsToClaim);
            if (! empty($claimedMessages)) {
                $this->processMessageBatch($claimedMessages, $stream, $group, $dlq, $secret);
            }
        }
    }

    /**
     * Claim pending messages that have exceeded the idle threshold.
     *
     * @param  list<string>  $ids
     * @return list<array{id: string, fields: array<string, mixed>}>
     */
    private function claimPendingMessages(string $stream, string $group, string $consumer, int $minIdleMs, array $ids): array
    {
        try {
            $claimedRaw = Redis::xclaim($stream, $group, $consumer, $minIdleMs, $ids);

            return $this->normalizeClaimedEntries($claimedRaw);
        } catch (Throwable) {
            try {
                $claimedRaw = Redis::command('xclaim', array_merge([$stream, $group, $consumer, $minIdleMs], $ids));

                return $this->normalizeClaimedEntries($claimedRaw);
            } catch (Throwable $e) {
                Log::warning('Failed to claim pending messages from Redis Stream', ['error' => $e->getMessage()]);

                return [];
            }
        }
    }

    /**
     * Process a batch of validated stream messages.
     *
     * @param  list<array{id: string, fields: array<string, mixed>}>  $messages
     */
    private function processMessageBatch(
        array $messages,
        string $stream,
        string $group,
        string $dlq,
        string $secret,
    ): void {
        $validSamples = [];
        $messageIdsToAck = [];

        foreach ($messages as $message) {
            $id = $message['id'];
            $fields = $message['fields'];

            $rawPayload = (string) ($fields['payload'] ?? '');
            $signature = (string) ($fields['signature'] ?? '');
            $timestamp = (string) ($fields['timestamp'] ?? '');
            $digest = (string) ($fields['digest'] ?? '');
            $commandId = isset($fields['command_id']) ? (string) $fields['command_id'] : null;
            $service = (string) ($fields['service'] ?? '');

            // Validate authorized producer service identity
            $allowedServices = (array) config('services.tracking.allowed_services', ['operations']);
            if ($service === '' || ! in_array($service, $allowedServices, true)) {
                $this->routeToDeadLetterQueue(
                    $stream,
                    $group,
                    $dlq,
                    $id,
                    "Unauthorized or unknown producer service [{$service}]",
                    $rawPayload
                );

                continue;
            }

            // Validate HMAC-SHA256 signature
            if ($secret !== '') {
                $stringToSign = "STREAM\n{$stream}\n{$timestamp}\n{$digest}";
                $expectedSig = hash_hmac('sha256', $stringToSign, $secret);
                $expectedDigest = hash('sha256', $rawPayload);

                if (! hash_equals($expectedDigest, $digest) || ! hash_equals($expectedSig, $signature)) {
                    $this->routeToDeadLetterQueue(
                        $stream,
                        $group,
                        $dlq,
                        $id,
                        'HMAC payload integrity validation failed (signature or digest mismatch)',
                        $rawPayload
                    );

                    continue;
                }
            }

            $decoded = json_decode($rawPayload, true);
            if (! is_array($decoded)) {
                $this->routeToDeadLetterQueue(
                    $stream,
                    $group,
                    $dlq,
                    $id,
                    'Malformed JSON payload in stream entry',
                    $rawPayload
                );

                continue;
            }

            if ($commandId !== null && $commandId !== '') {
                if (! empty($decoded['command_id']) && ! hash_equals((string) $commandId, (string) $decoded['command_id'])) {
                    $this->routeToDeadLetterQueue(
                        $stream,
                        $group,
                        $dlq,
                        $id,
                        'Stream command_id does not match payload command_id',
                        $rawPayload
                    );

                    continue;
                }

                if (empty($decoded['command_id'])) {
                    $decoded['command_id'] = $commandId;
                }
            }

            $userId = isset($decoded['user_id']) ? (int) $decoded['user_id'] : 0;
            if ($userId <= 0) {
                $this->routeToDeadLetterQueue(
                    $stream,
                    $group,
                    $dlq,
                    $id,
                    'Invalid or missing user_id in telemetry payload',
                    $rawPayload
                );

                continue;
            }

            $validSamples[] = [
                'stream_id' => $id,
                'data' => $decoded,
            ];
        }

        if (empty($validSamples)) {
            return;
        }

        $ingestBatch = array_column($validSamples, 'data');
        $results = $this->ingestService->ingestBatch($ingestBatch);

        // Acknowledge all processed messages
        foreach ($validSamples as $index => $item) {
            $streamId = $item['stream_id'];
            $result = $results[$index] ?? null;

            if ($result !== null && ($result['status'] === 201 || $result['status'] === 200)) {
                $messageIdsToAck[] = $streamId;

                // Sanitize log: omit coordinates and secrets
                Log::info('Successfully ingested telemetry stream sample', [
                    'stream_id' => $streamId,
                    'command_id' => $result['command_id'] ?? null,
                    'sample_id' => $result['sample_id'] ?? null,
                ]);
            } elseif ($result !== null && $result['status'] === 409) {
                // Idempotency conflict with different payload -> route to DLQ and ACK from main stream
                $this->routeToDeadLetterQueue(
                    $stream,
                    $group,
                    $dlq,
                    $streamId,
                    'Command ID idempotency conflict: payload differs from previous execution',
                    json_encode($item['data'], JSON_THROW_ON_ERROR)
                );
            } else {
                Log::error('Failed to ingest telemetry sample from stream', [
                    'stream_id' => $streamId,
                    'status' => $result['status'] ?? 'unknown',
                ]);
            }
        }

        if (! empty($messageIdsToAck)) {
            try {
                Redis::xack($stream, $group, $messageIdsToAck);
            } catch (Throwable) {
                Redis::command('xack', array_merge([$stream, $group], $messageIdsToAck));
            }
        }
    }

    /**
     * Route an unprocessable or poison pill message to the Dead Letter Queue (DLQ).
     */
    private function routeToDeadLetterQueue(
        string $stream,
        string $group,
        string $dlq,
        string $messageId,
        string $reason,
        string $rawPayload = '',
    ): void {
        try {
            $dlqFields = [
                'original_id' => $messageId,
                'error' => $reason,
                'payload' => $rawPayload,
                'failed_at' => CarbonImmutable::now()->toIso8601String(),
            ];

            try {
                Redis::xadd($dlq, '*', $dlqFields);
            } catch (Throwable) {
                Redis::command('xadd', array_merge([$dlq, '*'], $this->flattenKeyValuePairs($dlqFields)));
            }

            // Acknowledge the failed message from the primary stream so it stops looping in PEL
            try {
                Redis::xack($stream, $group, [$messageId]);
            } catch (Throwable) {
                Redis::command('xack', [$stream, $group, $messageId]);
            }

            // Sanitized logging: omit raw GPS coordinates and credentials
            Log::warning('Telemetry message routed to DLQ', [
                'original_id' => $messageId,
                'dlq' => $dlq,
                'reason' => $reason,
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to route telemetry message to DLQ', [
                'original_id' => $messageId,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Normalize XREADGROUP return values into standardized items.
     *
     * @return list<array{id: string, fields: array<string, mixed>}>
     */
    private function normalizeStreamEntries(mixed $raw, string $streamKey): array
    {
        if (! is_array($raw) || empty($raw)) {
            return [];
        }

        $results = [];

        // Format 1: ['stream_name' => ['msg_id' => ['key' => 'val']]] (phpredis format)
        if (isset($raw[$streamKey]) && is_array($raw[$streamKey])) {
            foreach ($raw[$streamKey] as $id => $fields) {
                if (is_array($fields)) {
                    $results[] = [
                        'id' => (string) $id,
                        'fields' => $this->ensureAssociativeFields($fields),
                    ];
                }
            }

            return $results;
        }

        // Format 2: [['stream_name', [['msg_id', ['key', 'val', ...]]]]] (raw command format)
        foreach ($raw as $streamData) {
            if (is_array($streamData) && count($streamData) >= 2) {
                $entries = $streamData[1];
                if (is_array($entries)) {
                    foreach ($entries as $entry) {
                        if (is_array($entry) && count($entry) >= 2) {
                            $id = (string) $entry[0];
                            $fields = $entry[1];
                            $results[] = [
                                'id' => $id,
                                'fields' => $this->ensureAssociativeFields($fields),
                            ];
                        }
                    }
                }
            } elseif (is_string(array_key_first($raw))) {
                // Associative top-level array of id => fields
                foreach ($raw as $id => $fields) {
                    if (is_array($fields)) {
                        $results[] = [
                            'id' => (string) $id,
                            'fields' => $this->ensureAssociativeFields($fields),
                        ];
                    }
                }
                break;
            }
        }

        return $results;
    }

    /**
     * Normalize XCLAIM return values.
     *
     * @return list<array{id: string, fields: array<string, mixed>}>
     */
    private function normalizeClaimedEntries(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $results = [];

        foreach ($raw as $key => $val) {
            if (is_array($val) && count($val) >= 2) {
                // List of [id, fields]
                $id = (string) $val[0];
                $fields = $val[1] ?? [];
                $results[] = [
                    'id' => $id,
                    'fields' => $this->ensureAssociativeFields($fields),
                ];
            } elseif (is_string($key) && is_array($val)) {
                $results[] = [
                    'id' => $key,
                    'fields' => $this->ensureAssociativeFields($val),
                ];
            }
        }

        return $results;
    }

    /**
     * Normalize XPENDING return values into standardized entries.
     *
     * @param  array<mixed, mixed>  $raw
     * @return list<array{id: string, consumer: string, idle_ms: int, delivery_count: int}>
     */
    private function normalizePendingEntries(array $raw): array
    {
        $entries = [];

        foreach ($raw as $item) {
            if (! is_array($item)) {
                continue;
            }

            if (isset($item['id'])) {
                $entries[] = [
                    'id' => (string) $item['id'],
                    'consumer' => (string) ($item['consumer'] ?? ''),
                    'idle_ms' => (int) ($item['idle'] ?? $item['idle_ms'] ?? 0),
                    'delivery_count' => (int) ($item['delivery_count'] ?? $item['deliveries'] ?? 1),
                ];
            } elseif (count($item) >= 4) {
                // Standard redis array format: [id, consumer, idle_ms, delivery_count]
                $entries[] = [
                    'id' => (string) $item[0],
                    'consumer' => (string) $item[1],
                    'idle_ms' => (int) $item[2],
                    'delivery_count' => (int) $item[3],
                ];
            }
        }

        return $entries;
    }

    /**
     * Ensure fields array is associative.
     *
     * @return array<string, mixed>
     */
    private function ensureAssociativeFields(mixed $fields): array
    {
        if (! is_array($fields) || empty($fields)) {
            return [];
        }

        if (is_string(array_key_first($fields))) {
            return $fields;
        }

        $assoc = [];
        $count = count($fields);
        for ($i = 0; $i < $count; $i += 2) {
            if (array_key_exists($i, $fields) && array_key_exists($i + 1, $fields)) {
                $assoc[(string) $fields[$i]] = $fields[$i + 1];
            }
        }

        return $assoc;
    }

    /**
     * Flatten key-value pairs for raw command execution.
     *
     * @param  array<string, mixed>  $data
     * @return list<string>
     */
    private function flattenKeyValuePairs(array $data): array
    {
        $flat = [];
        foreach ($data as $key => $value) {
            $flat[] = (string) $key;
            $flat[] = (string) $value;
        }

        return $flat;
    }
}
