<?php

namespace App\Platform\Tracking\Services;

use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Exceptions\TrackingServiceUnavailableException;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Throwable;

class RedisStreamTrackingClient implements TrackingClientInterface
{
    protected string $streamKey;

    protected int $maxLen;

    protected string $secret;

    protected ?string $redisConnection;

    protected HttpTrackingClient $httpTrackingClient;

    public function __construct(
        ?string $streamKey = null,
        ?int $maxLen = null,
        ?string $secret = null,
        ?string $redisConnection = null,
        ?HttpTrackingClient $httpTrackingClient = null,
    ) {
        $this->streamKey = $streamKey ?? (string) config('services.tracking.stream_key', 'telemetry.gps.v1');
        $this->maxLen = $maxLen ?? (int) config('services.tracking.stream_maxlen', 100000);
        $this->secret = $secret ?? (string) config('services.tracking.secret', 'test-tracking-service-secret');
        $this->redisConnection = $redisConnection;
        $this->httpTrackingClient = $httpTrackingClient ?? app(HttpTrackingClient::class);
    }

    /**
     * Publish a canonical signed location sample to the Redis Stream outside of database transactions.
     *
     * @return array{stream_id: string, payload: array<string, mixed>}
     */
    public function publish(LocationSampleDto $sample): array
    {
        // Enforce production security guardrail: reject short or placeholder secrets
        if (app()->environment('production') && (strlen($this->secret) < 16 || in_array($this->secret, ['test-tracking-service-secret', 'placeholder', 'secret', 'default-tracking-secret', 'changeme'], true))) {
            throw new \RuntimeException('Insecure tracking service secret configured for production.');
        }

        // Enforce network I/O boundary constraint: cannot publish inside active database transaction
        $maxAllowedTransactionLevel = app()->runningUnitTests() ? 1 : 0;
        if (DB::transactionLevel() > $maxAllowedTransactionLevel) {
            throw new \LogicException('Redis stream publishing must occur outside database transactions.');
        }

        $now = CarbonImmutable::now();
        $capturedAt = $sample->capturedAt ?? $now;
        $receivedAt = $sample->receivedAt ?? $now;

        $payloadData = [
            'user_id' => $sample->userId,
            'operational_asset_id' => $sample->operationalAssetId,
            'dispatch_job_id' => $sample->dispatchJobId,
            'latitude' => $sample->sharingEnabled && $sample->latitude !== null ? round((float) $sample->latitude, 7) : null,
            'longitude' => $sample->sharingEnabled && $sample->longitude !== null ? round((float) $sample->longitude, 7) : null,
            'accuracy_metres' => $sample->sharingEnabled ? $sample->accuracyMetres : null,
            'speed' => $sample->sharingEnabled ? $sample->speed : null,
            'remarks' => $sample->remarks,
            'source' => $sample->source ?: 'field-mobile',
            'sharing_enabled' => $sample->sharingEnabled,
            'command_id' => $sample->commandId,
            'captured_at' => $capturedAt->toIso8601String(),
            'received_at' => $receivedAt->toIso8601String(),
        ];
        ksort($payloadData);

        $rawPayload = json_encode($payloadData, JSON_THROW_ON_ERROR);
        $timestamp = (string) time();
        $digest = hash('sha256', $rawPayload);

        $stringToSign = "STREAM\n{$this->streamKey}\n{$timestamp}\n{$digest}";
        $signature = hash_hmac('sha256', $stringToSign, $this->secret);

        $fields = [
            'command_id' => (string) ($sample->commandId ?? ''),
            'user_id' => (string) $sample->userId,
            'payload' => $rawPayload,
            'signature' => $signature,
            'timestamp' => $timestamp,
            'digest' => $digest,
            'service' => 'operations',
        ];

        try {
            try {
                $connection = $this->redisConnection !== null ? Redis::connection($this->redisConnection) : Redis::connection();
                $streamId = $connection->xadd(
                    $this->streamKey,
                    '*',
                    $fields,
                    $this->maxLen,
                    true
                );
            } catch (Throwable) {
                // Command fallback for raw redis execution
                $flat = [];
                foreach ($fields as $k => $v) {
                    $flat[] = (string) $k;
                    $flat[] = (string) $v;
                }
                $connection = $this->redisConnection !== null ? Redis::connection($this->redisConnection) : Redis::connection();
                $streamId = $connection->command('xadd', [
                    $this->streamKey, 'MAXLEN', '~', $this->maxLen, '*', ...$flat,
                ]);
            }

            if (! is_string($streamId) && ! is_numeric($streamId)) {
                $streamId = (string) $streamId;
            }

            $streamId = trim((string) $streamId);
            if ($streamId === '' || $streamId === 'false' || $streamId === 'null') {
                throw new \RuntimeException('Redis XADD returned empty or invalid stream ID');
            }
        } catch (Throwable $e) {
            Log::error('Redis stream publish failed for telemetry sample', [
                'stream' => $this->streamKey,
                'user_id' => $sample->userId,
                'command_id' => $sample->commandId,
                'error' => $e->getMessage(),
            ]);

            throw new TrackingServiceUnavailableException(
                'Telemetry streaming service unavailable. Sample retained in outbox: '.$e->getMessage(),
                503,
                $e
            );
        }

        return [
            'stream_id' => (string) $streamId,
            'payload' => $payloadData,
        ];
    }

    public function ingestLocation(LocationSampleDto $sample): LatestLocationDto
    {
        $result = $this->publish($sample);

        $capturedAt = $sample->capturedAt !== null ? CarbonImmutable::instance($sample->capturedAt) : CarbonImmutable::now();
        $receivedAt = $sample->receivedAt !== null ? CarbonImmutable::instance($sample->receivedAt) : CarbonImmutable::now();

        return new LatestLocationDto(
            id: 0,
            userId: $sample->userId,
            operationalAssetId: $sample->operationalAssetId,
            dispatchJobId: $sample->dispatchJobId,
            latitude: $sample->latitude,
            longitude: $sample->longitude,
            accuracyMetres: $sample->accuracyMetres,
            speed: $sample->speed,
            remarks: $sample->remarks,
            source: $sample->source ?: 'field-mobile',
            sharingEnabled: $sample->sharingEnabled,
            capturedAt: $capturedAt,
            receivedAt: $receivedAt,
            freshnessStatus: LatestLocationDto::computeFreshness($receivedAt, $sample->sharingEnabled),
            isQueued: true,
            streamId: $result['stream_id'],
        );
    }

    public function getLatestLocations(?User $user = null): Collection
    {
        return $this->httpTrackingClient->getLatestLocations($user);
    }

    public function getLatestLocationForUser(int $userId): ?LatestLocationDto
    {
        return $this->httpTrackingClient->getLatestLocationForUser($userId);
    }

    public function getLatestLocationForAsset(int $assetId): ?LatestLocationDto
    {
        return $this->httpTrackingClient->getLatestLocationForAsset($assetId);
    }

    public function getLatestLocationForJob(int $jobId, ?User $user = null): ?LatestLocationDto
    {
        return $this->httpTrackingClient->getLatestLocationForJob($jobId, $user);
    }

    public function queryLocationHistory(array $filters = []): Collection
    {
        return $this->httpTrackingClient->queryLocationHistory($filters);
    }

    public function getTrackingFreshness(User $user, CarbonImmutable $refreshedAt, int $staleAfterSeconds = 120): array
    {
        return $this->httpTrackingClient->getTrackingFreshness($user, $refreshedAt, $staleAfterSeconds);
    }
}
