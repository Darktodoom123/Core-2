<?php

namespace App\Platform\Tracking\Services;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Exceptions\TrackingConflictException;
use App\Platform\Tracking\Exceptions\TrackingServiceUnavailableException;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class HttpTrackingClient implements TrackingClientInterface
{
    protected string $baseUrl;

    protected string $secret;

    protected float $timeout;

    protected float $connectTimeout;

    protected DatabaseTrackingClient $fallbackClient;

    protected bool $allowIngestFallback;

    protected bool $allowReadFallback;

    public function __construct(
        ?string $baseUrl = null,
        ?string $secret = null,
        ?float $timeout = null,
        ?float $connectTimeout = null,
        ?DatabaseTrackingClient $fallbackClient = null,
        ?bool $allowIngestFallback = null,
        ?bool $allowReadFallback = null,
    ) {
        $this->baseUrl = rtrim($baseUrl ?? (string) config('services.tracking.url', 'http://localhost:8001'), '/');
        $this->secret = $secret ?? (string) config('services.tracking.secret', 'test-tracking-service-secret');
        $this->timeout = $timeout ?? (float) config('services.tracking.timeout', 5.0);
        $this->connectTimeout = $connectTimeout ?? (float) config('services.tracking.connect_timeout', 3.0);
        $this->fallbackClient = $fallbackClient ?? new DatabaseTrackingClient;

        if (app()->environment('production')) {
            $isDevSecret = in_array($this->secret, [
                'test-tracking-service-secret',
                'secret',
                'changeme',
                '<local-only-shared-secret>',
                'password',
                '',
            ], true) || strlen($this->secret) < 16;

            if ($isDevSecret) {
                throw new RuntimeException('Tracking service signing secret is insecure or using development placeholder in production.');
            }

            // In production, never write to a secondary authoritative database during outages,
            // and never present its stale rows as live positions.
            $this->allowIngestFallback = false;
            $this->allowReadFallback = false;
        } else {
            $this->allowIngestFallback = $allowIngestFallback ?? (bool) config('services.tracking.allow_ingest_fallback', false);
            $this->allowReadFallback = $allowReadFallback ?? (bool) config('services.tracking.allow_read_fallback', false);
        }
    }

    /**
     * Generate canonical signed headers for outbound requests to the Tracking microservice.
     *
     * @return array<string, string>
     */
    public function buildSignedHeaders(string $method, string $path, string $rawBody = ''): array
    {
        $timestamp = (string) time();
        $digest = hash('sha256', $rawBody);
        $normalizedPath = '/'.trim((string) parse_url($path, PHP_URL_PATH), '/');

        $stringToSign = strtoupper($method)."\n".$normalizedPath."\n".$timestamp."\n".$digest;
        $signature = hash_hmac('sha256', $stringToSign, $this->secret);

        $headers = [
            'X-Service-Name' => 'operations',
            'X-Timestamp' => $timestamp,
            'X-Payload-Digest' => $digest,
            'X-Signature' => $signature,
            'Accept' => 'application/json',
        ];

        $correlationId = null;
        if (app()->bound('request')) {
            $req = request();
            $correlationId = $req->header('X-Correlation-Id') ?? $req->header('X-Request-Id');
        }
        if (is_string($correlationId) && $correlationId !== '') {
            $headers['X-Correlation-Id'] = $correlationId;
        }

        return $headers;
    }

    public function ingestLocation(LocationSampleDto $sample): LatestLocationDto
    {
        $path = '/internal/v1/locations';
        $url = $this->baseUrl.$path;

        $payload = array_filter($sample->toArray(), static fn (mixed $val): bool => $val !== null);
        unset($payload['id']);
        if ($sample->commandId !== null && $sample->commandId !== '') {
            $payload['command_id'] = $sample->commandId;
        }
        $payload['sharing_enabled'] = $sample->sharingEnabled;

        $rawBody = (string) json_encode($payload, JSON_THROW_ON_ERROR);
        $headers = $this->buildSignedHeaders('POST', $path, $rawBody);
        if ($sample->commandId !== null && $sample->commandId !== '') {
            $headers['X-Command-Id'] = $sample->commandId;
        }

        $isIdempotent = $sample->commandId !== null && $sample->commandId !== '';

        try {
            $pendingRequest = Http::timeout($this->timeout)
                ->connectTimeout($this->connectTimeout)
                ->withHeaders([...$headers, 'Content-Type' => 'application/json'])
                ->withBody($rawBody, 'application/json');

            if ($isIdempotent) {
                $pendingRequest = $pendingRequest->retry(2, 100, function ($exception): bool {
                    return $exception instanceof ConnectionException;
                }, throw: false);
            }

            /** @var Response $response */
            $response = $pendingRequest->post($url);

            if ($response->status() === 409) {
                $message = (string) ($response->json('message') ?? 'This command ID was already used for a different command payload.');
                Log::warning('Tracking microservice returned 409 Conflict', [
                    'user_id' => $sample->userId,
                    'command_id' => $sample->commandId,
                    'message' => $message,
                ]);

                /** @var array<string, mixed>|null $body */
                $body = $response->json();
                throw new TrackingConflictException($message, $body);
            }

            if ($response->status() === 422) {
                /** @var array<string, list<string>>|null $errors */
                $errors = $response->json('errors');
                $message = (string) ($response->json('message') ?? 'The given location data was invalid.');

                Log::warning('Tracking microservice returned 422 Unprocessable Entity', [
                    'user_id' => $sample->userId,
                    'command_id' => $sample->commandId,
                    'message' => $message,
                ]);

                throw ValidationException::withMessages($errors ?? ['location' => [$message]]);
            }

            if ($response->successful()) {
                /** @var array<string, mixed> $data */
                $data = $response->json('data') ?? [];

                return LatestLocationDto::fromArray($data);
            }

            Log::warning('Tracking microservice returned error on ingestLocation', [
                'status' => $response->status(),
                'user_id' => $sample->userId,
            ]);

            if (! $this->allowIngestFallback) {
                $errorMessage = (string) ($response->json('message') ?? 'Tracking microservice returned an error. Please retry.');
                throw new TrackingServiceUnavailableException($errorMessage, $response->json());
            }
        } catch (TrackingConflictException|TrackingServiceUnavailableException|ValidationException $e) {
            throw $e;
        } catch (Throwable $e) {
            if (! $this->allowIngestFallback) {
                Log::warning('Tracking microservice unavailable during ingestLocation, raising service unavailable exception', [
                    'error' => $e->getMessage(),
                    'user_id' => $sample->userId,
                ]);

                throw new TrackingServiceUnavailableException(
                    'Tracking microservice is temporarily unavailable. Please retry.',
                    null,
                    $e
                );
            }

            Log::warning('Tracking microservice unavailable during ingestLocation, falling back to local database', [
                'error' => $e->getMessage(),
                'user_id' => $sample->userId,
            ]);
        }

        return $this->fallbackClient->ingestLocation($sample);
    }

    public function getLatestLocations(?User $user = null): Collection
    {
        if ($user !== null) {
            $canView = $user->can(PermissionName::TrackingViewAll->value)
                || $user->can(PermissionName::TrackingShareOwn->value);

            if (! $canView) {
                return collect();
            }
        }

        return $this->fetchLatestVisibleTo($user)
            ?? $this->unavailableRead(
                fn (): Collection => $this->fallbackClient->getLatestLocations($user),
                collect(),
            );
    }

    public function getLatestLocationForUser(int $userId): ?LatestLocationDto
    {
        $locations = $this->fetchLatest('getLatestLocationForUser', ['user_id' => $userId], ['user_id' => $userId]);

        return $locations === null
            ? $this->unavailableRead(
                fn (): ?LatestLocationDto => $this->fallbackClient->getLatestLocationForUser($userId),
                null,
            )
            : $locations->first();
    }

    public function getLatestLocationForAsset(int $assetId): ?LatestLocationDto
    {
        $locations = $this->fetchLatest('getLatestLocationForAsset', ['operational_asset_id' => $assetId], ['asset_id' => $assetId]);

        return $locations === null
            ? $this->unavailableRead(
                fn (): ?LatestLocationDto => $this->fallbackClient->getLatestLocationForAsset($assetId),
                null,
            )
            : $locations->first();
    }

    public function getLatestLocationForJob(int $jobId, ?User $user = null): ?LatestLocationDto
    {
        $locations = $this->fetchLatest('getLatestLocationForJob', ['dispatch_job_id' => $jobId], ['job_id' => $jobId]);

        if ($locations === null) {
            return $this->unavailableRead(
                fn (): ?LatestLocationDto => $this->fallbackClient->getLatestLocationForJob($jobId, $user),
                null,
            );
        }

        if ($user !== null && ! $user->can(PermissionName::TrackingViewAll->value)) {
            $locations = $locations->filter(
                static fn (LatestLocationDto $dto): bool => $dto->userId === $user->id
            );
        }

        return $locations->first();
    }

    public function queryLocationHistory(array $filters = []): Collection
    {
        $path = '/internal/v1/locations';
        $url = $this->baseUrl.$path;
        $headers = $this->buildSignedHeaders('GET', $path, '');

        try {
            /** @var Response $response */
            $response = Http::timeout($this->timeout)
                ->connectTimeout($this->connectTimeout)
                ->withHeaders($headers)
                ->get($url, $filters);

            if ($response->successful()) {
                /** @var list<array<string, mixed>> $data */
                $data = $response->json('data') ?? [];

                /** @var Collection<int, LocationSampleDto> $samples */
                $samples = collect($data)->map(
                    static fn (array $item): LocationSampleDto => LocationSampleDto::fromArray($item)
                );

                return $samples->values();
            }

            Log::warning('Tracking microservice returned error on queryLocationHistory', [
                'status' => $response->status(),
            ]);
        } catch (Throwable $e) {
            Log::warning($this->readFailureMessage('queryLocationHistory'), [
                'error' => $e->getMessage(),
            ]);
        }

        // History feeds audit exports: failing is safer than returning an empty or partial trail.
        if (! $this->allowReadFallback) {
            throw new TrackingServiceUnavailableException(
                'Tracking microservice is temporarily unavailable. Location history could not be loaded.'
            );
        }

        return $this->fallbackClient->queryLocationHistory($filters);
    }

    public function getTrackingFreshness(User $user, CarbonImmutable $refreshedAt, int $staleAfterSeconds = 120): array
    {
        $canViewTracking = $user->can(PermissionName::TrackingViewAll->value)
            || $user->can(PermissionName::TrackingShareOwn->value);

        if (! $canViewTracking) {
            return [
                'refreshed_at' => $refreshedAt->toIso8601String(),
                'stale_after_seconds' => $staleAfterSeconds,
                'latest_received_at' => null,
                'current_user' => null,
            ];
        }

        $locations = $this->fetchLatestVisibleTo($user);
        if ($locations === null) {
            return $this->unavailableFreshness($user, $refreshedAt, $staleAfterSeconds);
        }

        /** @var LatestLocationDto|null $latestVisible */
        $latestVisible = $locations
            ->sortByDesc(static fn (LatestLocationDto $l): ?string => $l->receivedAt?->toIso8601String())
            ->first();

        $latestOwn = $locations->first(static fn (LatestLocationDto $l): bool => $l->userId === $user->id);
        if ($latestOwn === null) {
            $ownLocations = $this->fetchLatest('getLatestLocationForUser', ['user_id' => $user->id], ['user_id' => $user->id]);
            if ($ownLocations === null) {
                return $this->unavailableFreshness($user, $refreshedAt, $staleAfterSeconds);
            }

            $latestOwn = $ownLocations->first();
        }

        return [
            'refreshed_at' => $refreshedAt->toIso8601String(),
            'stale_after_seconds' => $staleAfterSeconds,
            'latest_received_at' => $latestVisible?->receivedAt?->toIso8601String(),
            'current_user' => [
                'sharing_enabled' => $latestOwn?->sharingEnabled,
                'captured_at' => $latestOwn?->capturedAt?->toIso8601String(),
                'received_at' => $latestOwn?->receivedAt?->toIso8601String(),
            ],
            'service_available' => true,
        ];
    }

    /**
     * Query the Tracking latest-position projection.
     *
     * @param  array<string, int>  $query
     * @param  array<string, int>  $logContext
     * @return Collection<int, LatestLocationDto>|null Null when the Tracking service could not answer.
     */
    private function fetchLatest(string $operation, array $query, array $logContext = []): ?Collection
    {
        $path = '/internal/v1/locations/latest';
        $headers = $this->buildSignedHeaders('GET', $path, '');

        try {
            /** @var Response $response */
            $response = Http::timeout($this->timeout)
                ->connectTimeout($this->connectTimeout)
                ->withHeaders($headers)
                ->get($this->baseUrl.$path, $query);

            if ($response->successful()) {
                /** @var list<array<string, mixed>> $data */
                $data = $response->json('data') ?? [];

                return collect($data)
                    ->map(static fn (array $item): LatestLocationDto => LatestLocationDto::fromArray($item))
                    ->values();
            }

            Log::warning("Tracking microservice returned error on {$operation}", [
                'status' => $response->status(),
                ...$logContext,
            ]);
        } catch (Throwable $e) {
            Log::warning($this->readFailureMessage($operation), [
                ...$logContext,
                'error' => $e->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * Latest positions the user may see: everyone's with view-all, otherwise only their own.
     *
     * @return Collection<int, LatestLocationDto>|null Null when the Tracking service could not answer.
     */
    private function fetchLatestVisibleTo(?User $user): ?Collection
    {
        $ownOnly = $user !== null && ! $user->can(PermissionName::TrackingViewAll->value);
        $locations = $this->fetchLatest('getLatestLocations', $ownOnly ? ['user_id' => $user->id] : []);

        if ($locations === null || ! $ownOnly) {
            return $locations;
        }

        return $locations
            ->filter(static fn (LatestLocationDto $dto): bool => $dto->userId === $user->id)
            ->values();
    }

    /**
     * Resolve a read the Tracking service could not answer. Operations rows are served only
     * when read fallback is explicitly enabled; otherwise callers get "no data" rather than
     * stale positions presented as live.
     *
     * @template TResult
     *
     * @param  Closure(): TResult  $fallback
     * @param  TResult  $unavailable
     * @return TResult
     */
    private function unavailableRead(Closure $fallback, mixed $unavailable): mixed
    {
        return $this->allowReadFallback ? $fallback() : $unavailable;
    }

    private function readFailureMessage(string $operation): string
    {
        return "Tracking microservice unavailable during {$operation}, "
            .($this->allowReadFallback ? 'falling back to local database' : 'no local fallback');
    }

    /**
     * @return array{
     *     refreshed_at: string,
     *     stale_after_seconds: int,
     *     latest_received_at: ?string,
     *     current_user: ?array{sharing_enabled: ?bool, captured_at: ?string, received_at: ?string},
     *     service_available: false
     * }
     */
    private function unavailableFreshness(User $user, CarbonImmutable $refreshedAt, int $staleAfterSeconds): array
    {
        $freshness = $this->allowReadFallback
            ? $this->fallbackClient->getTrackingFreshness($user, $refreshedAt, $staleAfterSeconds)
            : [
                'refreshed_at' => $refreshedAt->toIso8601String(),
                'stale_after_seconds' => $staleAfterSeconds,
                'latest_received_at' => null,
                'current_user' => null,
            ];

        return [...$freshness, 'service_available' => false];
    }
}
