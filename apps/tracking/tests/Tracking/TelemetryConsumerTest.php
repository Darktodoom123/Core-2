<?php

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Str;
use Tracking\Models\LatestLocation;
use Tracking\Models\LocationSample;
use Tracking\Models\TrackingCommandReceipt;

beforeEach(function (): void {
    config()->set('services.tracking.secret', 'test-tracking-service-secret');
});

function createSignedStreamMessage(
    int $userId,
    ?int $assetId,
    ?int $jobId,
    ?float $lat,
    ?float $lng,
    ?string $capturedAt = null,
    ?string $commandId = null,
    string $secret = 'test-tracking-service-secret',
    string $streamKey = 'telemetry.gps.v1',
    bool $tamperSignature = false,
): array {
    $commandId = $commandId ?? (string) Str::uuid();
    $now = CarbonImmutable::now();
    $capturedAtIso = $capturedAt ?? $now->toIso8601String();

    $payloadData = [
        'user_id' => $userId,
        'operational_asset_id' => $assetId,
        'dispatch_job_id' => $jobId,
        'latitude' => $lat !== null ? round((float) $lat, 7) : null,
        'longitude' => $lng !== null ? round((float) $lng, 7) : null,
        'accuracy_metres' => 5.0,
        'speed' => 12.5,
        'remarks' => 'Normal ping',
        'source' => 'field-mobile',
        'sharing_enabled' => true,
        'command_id' => $commandId,
        'captured_at' => $capturedAtIso,
        'received_at' => $now->toIso8601String(),
    ];
    ksort($payloadData);

    $rawPayload = json_encode($payloadData, JSON_THROW_ON_ERROR);
    $timestamp = (string) time();
    $digest = hash('sha256', $rawPayload);

    $stringToSign = "STREAM\n{$streamKey}\n{$timestamp}\n{$digest}";
    $signature = $tamperSignature
        ? 'invalid-tampered-signature-0000000000'
        : hash_hmac('sha256', $stringToSign, $secret);

    return [
        'command_id' => $commandId,
        'user_id' => (string) $userId,
        'payload' => $rawPayload,
        'signature' => $signature,
        'timestamp' => $timestamp,
        'digest' => $digest,
        'service' => 'operations',
    ];
}

it('consumes and ingests telemetry messages from Redis Stream, updating latest location and acknowledging message', function (): void {
    $commandId = (string) Str::uuid();
    $streamMessage = createSignedStreamMessage(
        userId: 42,
        assetId: 101,
        jobId: 202,
        lat: 14.5995,
        lng: 120.9842,
        commandId: $commandId,
    );

    $messageId = '1726500000000-0';

    Redis::shouldReceive('xgroup')
        ->with('CREATE', 'telemetry.gps.v1', 'tracking-ingest-workers', '0', Mockery::any())
        ->andReturnTrue();

    Redis::shouldReceive('xpending')
        ->andReturn([]);

    Redis::shouldReceive('xreadgroup')
        ->once()
        ->with('tracking-ingest-workers', Mockery::any(), ['telemetry.gps.v1' => '>'], 50, 2000)
        ->andReturn([
            'telemetry.gps.v1' => [
                $messageId => $streamMessage,
            ],
        ]);

    Redis::shouldReceive('xack')
        ->once()
        ->with('telemetry.gps.v1', 'tracking-ingest-workers', [$messageId])
        ->andReturn(1);

    $exitCode = Artisan::call('tracking:consume-telemetry', [
        '--once' => true,
    ]);

    expect($exitCode)->toBe(0);

    // Verify projection created
    $projection = LatestLocation::query()->where('user_id', 42)->first();
    expect($projection)->not->toBeNull()
        ->and($projection->operational_asset_id)->toBe(101)
        ->and($projection->dispatch_job_id)->toBe(202)
        ->and($projection->latitude)->toBe(14.5995)
        ->and($projection->longitude)->toBe(120.9842)
        ->and($projection->sharing_enabled)->toBeTrue();

    // Verify sample created
    $sample = LocationSample::query()->where('command_id', $commandId)->first();
    expect($sample)->not->toBeNull()
        ->and($sample->user_id)->toBe(42)
        ->and($sample->latitude)->toBe(14.5995)
        ->and($sample->longitude)->toBe(120.9842);

    // Verify command receipt created
    $receipt = TrackingCommandReceipt::query()->where('command_id', $commandId)->first();
    expect($receipt)->not->toBeNull()
        ->and($receipt->status_code)->toBe(201);
});

it('enforces strict idempotency and avoids duplicate row insertion for replayed stream samples', function (): void {
    $commandId = (string) Str::uuid();
    $streamMessage = createSignedStreamMessage(
        userId: 42,
        assetId: 101,
        jobId: 202,
        lat: 14.5995,
        lng: 120.9842,
        commandId: $commandId,
    );

    $messageId = '1726500000000-1';

    Redis::shouldReceive('xgroup')->andReturnTrue();
    Redis::shouldReceive('xpending')->andReturn([]);
    Redis::shouldReceive('xreadgroup')
        ->once()
        ->andReturn([
            'telemetry.gps.v1' => [
                $messageId => $streamMessage,
            ],
        ]);
    Redis::shouldReceive('xack')
        ->once()
        ->with('telemetry.gps.v1', 'tracking-ingest-workers', [$messageId])
        ->andReturn(1);

    // First ingestion
    Artisan::call('tracking:consume-telemetry', ['--once' => true]);
    expect(LocationSample::query()->where('command_id', $commandId)->count())->toBe(1);

    // Second ingestion with same command ID and same payload
    Redis::shouldReceive('xgroup')->andReturnTrue();
    Redis::shouldReceive('xpending')->andReturn([]);
    Redis::shouldReceive('xreadgroup')
        ->once()
        ->andReturn([
            'telemetry.gps.v1' => [
                '1726500000000-2' => $streamMessage,
            ],
        ]);
    Redis::shouldReceive('xack')
        ->once()
        ->with('telemetry.gps.v1', 'tracking-ingest-workers', ['1726500000000-2'])
        ->andReturn(1);

    Artisan::call('tracking:consume-telemetry', ['--once' => true]);

    // Count should still be 1 (no duplicate row)
    expect(LocationSample::query()->where('command_id', $commandId)->count())->toBe(1);
});

it('routes messages exceeding max delivery attempts in PEL to dead letter queue (telemetry.gps.dlq)', function (): void {
    $poisonId = '1726500000099-0';

    Redis::shouldReceive('xgroup')->andReturnTrue();

    // Mock XPENDING returning a message with 4 delivery attempts (max is 3)
    Redis::shouldReceive('xpending')
        ->once()
        ->with('telemetry.gps.v1', 'tracking-ingest-workers', '-', '+', 50)
        ->andReturn([
            [$poisonId, 'crashed-worker-1', 45000, 4],
        ]);

    // DLQ xadd expectation
    Redis::shouldReceive('xadd')
        ->once()
        ->withArgs(function ($dlqKey, $id, $fields) use ($poisonId): bool {
            expect($dlqKey)->toBe('telemetry.gps.dlq')
                ->and($id)->toBe('*')
                ->and($fields['original_id'])->toBe($poisonId)
                ->and($fields['error'])->toContain('Exceeded max delivery attempts');

            return true;
        })
        ->andReturn('dlq-1726500000099-0');

    // Message acknowledged on main stream so it leaves PEL
    Redis::shouldReceive('xack')
        ->once()
        ->with('telemetry.gps.v1', 'tracking-ingest-workers', [$poisonId])
        ->andReturn(1);

    // No new messages
    Redis::shouldReceive('xreadgroup')->andReturn([]);

    $exitCode = Artisan::call('tracking:consume-telemetry', ['--once' => true]);
    expect($exitCode)->toBe(0);
});

it('claims and processes idle pending messages from PEL within delivery attempt limits', function (): void {
    $pendingId = '1726500000050-0';
    $commandId = (string) Str::uuid();

    $streamMessage = createSignedStreamMessage(
        userId: 77,
        assetId: 300,
        jobId: null,
        lat: 14.5000,
        lng: 121.0000,
        commandId: $commandId,
    );

    Redis::shouldReceive('xgroup')->andReturnTrue();

    // Mock XPENDING returning message with 2 delivery attempts and idle for 15,000ms (threshold is 10,000ms)
    Redis::shouldReceive('xpending')
        ->once()
        ->andReturn([
            [$pendingId, 'previous-worker', 15000, 2],
        ]);

    // Mock XCLAIM returning the message
    Redis::shouldReceive('xclaim')
        ->once()
        ->withArgs(function ($stream, $group, $consumer, $minIdle, $ids) use ($pendingId): bool {
            expect($stream)->toBe('telemetry.gps.v1')
                ->and($group)->toBe('tracking-ingest-workers')
                ->and($minIdle)->toBe(10000)
                ->and($ids)->toBe([$pendingId]);

            return true;
        })
        ->andReturn([
            [$pendingId, $streamMessage],
        ]);

    Redis::shouldReceive('xreadgroup')->andReturn([]);

    Redis::shouldReceive('xack')
        ->once()
        ->with('telemetry.gps.v1', 'tracking-ingest-workers', [$pendingId])
        ->andReturn(1);

    $exitCode = Artisan::call('tracking:consume-telemetry', ['--once' => true]);
    expect($exitCode)->toBe(0);

    // Sample should be ingested from claimed message
    $sample = LocationSample::query()->where('command_id', $commandId)->first();
    expect($sample)->not->toBeNull()
        ->and($sample->user_id)->toBe(77);
});

it('rejects tampered or invalid HMAC signatures and sends them to DLQ without executing database projection update', function (): void {
    $tamperedId = '1726500000088-0';
    $tamperedMessage = createSignedStreamMessage(
        userId: 999,
        assetId: 888,
        jobId: null,
        lat: 14.5995,
        lng: 120.9842,
        tamperSignature: true, // Corrupted signature
    );

    Redis::shouldReceive('xgroup')->andReturnTrue();
    Redis::shouldReceive('xpending')->andReturn([]);

    Redis::shouldReceive('xreadgroup')
        ->once()
        ->andReturn([
            'telemetry.gps.v1' => [
                $tamperedId => $tamperedMessage,
            ],
        ]);

    // DLQ expectation
    Redis::shouldReceive('xadd')
        ->once()
        ->withArgs(function ($dlqKey, $id, $fields) use ($tamperedId): bool {
            expect($dlqKey)->toBe('telemetry.gps.dlq')
                ->and($id)->toBe('*')
                ->and($fields['original_id'])->toBe($tamperedId)
                ->and($fields['error'])->toContain('HMAC payload integrity validation failed');

            return true;
        })
        ->andReturn('dlq-tampered-1');

    Redis::shouldReceive('xack')
        ->once()
        ->with('telemetry.gps.v1', 'tracking-ingest-workers', [$tamperedId])
        ->andReturn(1);

    $exitCode = Artisan::call('tracking:consume-telemetry', ['--once' => true]);
    expect($exitCode)->toBe(0);

    // User 999 projection must NOT be created
    expect(LatestLocation::query()->where('user_id', 999)->exists())->toBeFalse();
    expect(LocationSample::query()->where('user_id', 999)->exists())->toBeFalse();
});

it('immediately nullifies coordinates on delayed offline samples older than 30 days pursuant to retention guardrails', function (): void {
    $commandId = (string) Str::uuid();
    $oldCapturedAt = CarbonImmutable::now()->subDays(35)->toIso8601String();

    $streamMessage = createSignedStreamMessage(
        userId: 55,
        assetId: 105,
        jobId: 205,
        lat: 14.5995,
        lng: 120.9842,
        capturedAt: $oldCapturedAt,
        commandId: $commandId,
    );

    $messageId = '1726500000077-0';

    Redis::shouldReceive('xgroup')->andReturnTrue();
    Redis::shouldReceive('xpending')->andReturn([]);
    Redis::shouldReceive('xreadgroup')->once()->andReturn([
        'telemetry.gps.v1' => [
            $messageId => $streamMessage,
        ],
    ]);
    Redis::shouldReceive('xack')->once()->with('telemetry.gps.v1', 'tracking-ingest-workers', [$messageId])->andReturn(1);

    Artisan::call('tracking:consume-telemetry', ['--once' => true]);

    // Sample must be created with nullified coordinates and purged annotation
    $sample = LocationSample::query()->where('command_id', $commandId)->first();
    expect($sample)->not->toBeNull()
        ->and($sample->latitude)->toBeNull()
        ->and($sample->longitude)->toBeNull()
        ->and($sample->remarks)->toContain('[COORDINATES_PURGED_RETENTION_EXPIRED]');

    // Projection must have coordinates nullified
    $projection = LatestLocation::query()->where('user_id', 55)->first();
    expect($projection)->not->toBeNull()
        ->and($projection->latitude)->toBeNull()
        ->and($projection->longitude)->toBeNull();
});

it('terminates consumer and rejects execution in production when tracking secret is too short or a default placeholder', function (): void {
    $originalEnv = app()->environment();
    try {
        app()->detectEnvironment(fn () => 'production');
        config()->set('services.tracking.secret', 'short');

        $exitCode = Artisan::call('tracking:consume-telemetry', ['--once' => true]);

        expect($exitCode)->toBe(1);
    } finally {
        app()->detectEnvironment(fn () => $originalEnv);
    }
});

it('rejects messages from unauthorized producer services and routes them to DLQ', function (): void {
    $messageId = '1726500000099-1';
    $message = createSignedStreamMessage(
        userId: 50,
        assetId: null,
        jobId: null,
        lat: 14.5,
        lng: 121.0,
    );
    $message['service'] = 'rogue-service';

    Redis::shouldReceive('xgroup')->andReturnTrue();
    Redis::shouldReceive('xpending')->andReturn([]);
    Redis::shouldReceive('xreadgroup')->once()->andReturn([
        'telemetry.gps.v1' => [
            $messageId => $message,
        ],
    ]);

    Redis::shouldReceive('xadd')
        ->once()
        ->withArgs(function ($dlqKey, $id, $fields) use ($messageId): bool {
            expect($dlqKey)->toBe('telemetry.gps.dlq')
                ->and($fields['original_id'])->toBe($messageId)
                ->and($fields['error'])->toContain('Unauthorized or unknown producer service');

            return true;
        })
        ->andReturn('dlq-unauth-1');

    Redis::shouldReceive('xack')->once()->with('telemetry.gps.v1', 'tracking-ingest-workers', [$messageId])->andReturn(1);

    $exitCode = Artisan::call('tracking:consume-telemetry', ['--once' => true]);
    expect($exitCode)->toBe(0);
    expect(LatestLocation::query()->where('user_id', 50)->exists())->toBeFalse();
});

it('rejects messages with invalid user_id and routes them to DLQ', function (): void {
    $messageId = '1726500000099-2';
    $message = createSignedStreamMessage(
        userId: 0,
        assetId: null,
        jobId: null,
        lat: 14.5,
        lng: 121.0,
    );

    Redis::shouldReceive('xgroup')->andReturnTrue();
    Redis::shouldReceive('xpending')->andReturn([]);
    Redis::shouldReceive('xreadgroup')->once()->andReturn([
        'telemetry.gps.v1' => [
            $messageId => $message,
        ],
    ]);

    Redis::shouldReceive('xadd')
        ->once()
        ->withArgs(function ($dlqKey, $id, $fields) use ($messageId): bool {
            expect($dlqKey)->toBe('telemetry.gps.dlq')
                ->and($fields['original_id'])->toBe($messageId)
                ->and($fields['error'])->toContain('Invalid or missing user_id');

            return true;
        })
        ->andReturn('dlq-invalid-user-1');

    Redis::shouldReceive('xack')->once()->with('telemetry.gps.v1', 'tracking-ingest-workers', [$messageId])->andReturn(1);

    $exitCode = Artisan::call('tracking:consume-telemetry', ['--once' => true]);
    expect($exitCode)->toBe(0);
});

it('preserves failed message payload in DLQ when delivery attempts are exceeded in PEL', function (): void {
    $poisonId = '1726500000099-3';
    $streamMessage = createSignedStreamMessage(
        userId: 60,
        assetId: null,
        jobId: null,
        lat: 14.5,
        lng: 121.0,
    );

    Redis::shouldReceive('xgroup')->andReturnTrue();

    // PEL returns message with 4 delivery attempts (max is 3)
    Redis::shouldReceive('xpending')
        ->once()
        ->with('telemetry.gps.v1', 'tracking-ingest-workers', '-', '+', 50)
        ->andReturn([
            [$poisonId, 'crashed-worker-2', 50000, 4],
        ]);

    // xrange returns the original message fields
    Redis::shouldReceive('xrange')
        ->once()
        ->with('telemetry.gps.v1', $poisonId, $poisonId)
        ->andReturn([
            $poisonId => $streamMessage,
        ]);

    // DLQ receives original payload
    Redis::shouldReceive('xadd')
        ->once()
        ->withArgs(function ($dlqKey, $id, $fields) use ($poisonId, $streamMessage): bool {
            expect($dlqKey)->toBe('telemetry.gps.dlq')
                ->and($fields['original_id'])->toBe($poisonId)
                ->and($fields['payload'])->toBe($streamMessage['payload']);

            return true;
        })
        ->andReturn('dlq-pel-preserved-1');

    Redis::shouldReceive('xack')->once()->with('telemetry.gps.v1', 'tracking-ingest-workers', [$poisonId])->andReturn(1);
    Redis::shouldReceive('xreadgroup')->andReturn([]);

    $exitCode = Artisan::call('tracking:consume-telemetry', ['--once' => true]);
    expect($exitCode)->toBe(0);
});
