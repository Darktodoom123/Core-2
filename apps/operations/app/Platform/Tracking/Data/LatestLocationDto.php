<?php

namespace App\Platform\Tracking\Data;

use App\Platform\Tracking\Models\LocationUpdate;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

final readonly class LatestLocationDto
{
    /**
     * @param  array{id: int, name: string}|null  $user
     * @param  array{id: int, code: string, name: string, kind: string, location?: ?string}|null  $asset
     * @param  array{id: int, reference: string, title: string, site?: ?string}|null  $job
     */
    public function __construct(
        public int $id,
        public int $userId,
        public ?int $operationalAssetId = null,
        public ?int $dispatchJobId = null,
        public ?float $latitude = null,
        public ?float $longitude = null,
        public ?float $accuracyMetres = null,
        public ?float $speed = null,
        public ?string $remarks = null,
        public string $source = 'mobile',
        public bool $sharingEnabled = true,
        public ?CarbonImmutable $capturedAt = null,
        public ?CarbonImmutable $receivedAt = null,
        public string $freshnessStatus = 'offline',
        public ?array $user = null,
        public ?array $asset = null,
        public ?array $job = null,
    ) {}

    public static function computeFreshness(?CarbonInterface $timestamp, bool $sharingEnabled): string
    {
        if (! $sharingEnabled || ! $timestamp) {
            return 'offline';
        }

        $secondsAgo = (int) abs(now()->diffInSeconds($timestamp));

        if ($secondsAgo <= 180) {
            return 'fresh';
        }

        if ($secondsAgo < 900) {
            return 'delayed';
        }

        if ($secondsAgo <= 1800) {
            return 'stale';
        }

        return 'offline';
    }

    public static function fromLocationUpdate(LocationUpdate $update): self
    {
        $capturedAt = $update->captured_at ? CarbonImmutable::instance($update->captured_at) : null;
        $receivedAt = $update->received_at ? CarbonImmutable::instance($update->received_at) : null;
        $freshnessTimestamp = $receivedAt ?? $capturedAt;

        return new self(
            id: (int) $update->getKey(),
            userId: (int) $update->user_id,
            operationalAssetId: $update->operational_asset_id !== null ? (int) $update->operational_asset_id : null,
            dispatchJobId: $update->dispatch_job_id !== null ? (int) $update->dispatch_job_id : null,
            latitude: $update->latitude !== null ? (float) $update->latitude : null,
            longitude: $update->longitude !== null ? (float) $update->longitude : null,
            accuracyMetres: $update->accuracy_metres !== null ? (float) $update->accuracy_metres : null,
            speed: $update->speed !== null ? (float) $update->speed : null,
            remarks: $update->remarks,
            source: (string) ($update->source ?? 'mobile'),
            sharingEnabled: (bool) $update->sharing_enabled,
            capturedAt: $capturedAt,
            receivedAt: $receivedAt,
            freshnessStatus: self::computeFreshness($freshnessTimestamp, (bool) $update->sharing_enabled),
        );
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $capturedAt = self::parseCarbon($data['captured_at'] ?? $data['capturedAt'] ?? null);
        $receivedAt = self::parseCarbon($data['received_at'] ?? $data['receivedAt'] ?? null);
        $sharing = (bool) ($data['sharing_enabled'] ?? $data['sharingEnabled'] ?? true);
        $freshness = isset($data['freshness_status'])
            ? (string) $data['freshness_status']
            : self::computeFreshness($receivedAt ?? $capturedAt, $sharing);

        /** @var array{id: int, name: string}|null $userPayload */
        $userPayload = isset($data['user']) && is_array($data['user']) ? [
            'id' => (int) $data['user']['id'],
            'name' => (string) $data['user']['name'],
        ] : null;

        /** @var array{id: int, code: string, name: string, kind: string, location?: string|null}|null $assetPayload */
        $assetPayload = isset($data['asset']) && is_array($data['asset']) ? [
            'id' => (int) $data['asset']['id'],
            'code' => (string) $data['asset']['code'],
            'name' => (string) $data['asset']['name'],
            'kind' => (string) $data['asset']['kind'],
            'location' => isset($data['asset']['location']) ? (string) $data['asset']['location'] : null,
        ] : null;

        /** @var array{id: int, reference: string, title: string, site?: string|null}|null $jobPayload */
        $jobPayload = isset($data['job']) && is_array($data['job']) ? [
            'id' => (int) $data['job']['id'],
            'reference' => (string) $data['job']['reference'],
            'title' => (string) $data['job']['title'],
            'site' => isset($data['job']['site']) ? (string) $data['job']['site'] : null,
        ] : null;

        return new self(
            id: (int) ($data['id'] ?? 0),
            userId: (int) ($data['user_id'] ?? $data['userId'] ?? 0),
            operationalAssetId: isset($data['operational_asset_id']) ? (int) $data['operational_asset_id'] : (isset($data['operationalAssetId']) ? (int) $data['operationalAssetId'] : null),
            dispatchJobId: isset($data['dispatch_job_id']) ? (int) $data['dispatch_job_id'] : (isset($data['dispatchJobId']) ? (int) $data['dispatchJobId'] : null),
            latitude: isset($data['latitude']) ? (float) $data['latitude'] : null,
            longitude: isset($data['longitude']) ? (float) $data['longitude'] : null,
            accuracyMetres: isset($data['accuracy_metres']) ? (float) $data['accuracy_metres'] : (isset($data['accuracyMetres']) ? (float) $data['accuracyMetres'] : null),
            speed: isset($data['speed']) ? (float) $data['speed'] : null,
            remarks: isset($data['remarks']) ? (string) $data['remarks'] : null,
            source: (string) ($data['source'] ?? 'mobile'),
            sharingEnabled: $sharing,
            capturedAt: $capturedAt,
            receivedAt: $receivedAt,
            freshnessStatus: $freshness,
            user: $userPayload,
            asset: $assetPayload,
            job: $jobPayload,
        );
    }

    /**
     * Return a new instance with hydrated entity data.
     *
     * @param  array{id: int, name: string}|null  $user
     * @param  array{id: int, code: string, name: string, kind: string, location?: ?string}|null  $asset
     * @param  array{id: int, reference: string, title: string, site?: ?string}|null  $job
     */
    public function withHydratedEntities(?array $user, ?array $asset, ?array $job): self
    {
        return new self(
            id: $this->id,
            userId: $this->userId,
            operationalAssetId: $this->operationalAssetId,
            dispatchJobId: $this->dispatchJobId,
            latitude: $this->latitude,
            longitude: $this->longitude,
            accuracyMetres: $this->accuracyMetres,
            speed: $this->speed,
            remarks: $this->remarks,
            source: $this->source,
            sharingEnabled: $this->sharingEnabled,
            capturedAt: $this->capturedAt,
            receivedAt: $this->receivedAt,
            freshnessStatus: $this->freshnessStatus,
            user: $user,
            asset: $asset,
            job: $job,
        );
    }

    /** @return array<string, mixed> */
    public function toViewModel(): array
    {
        return [
            'id' => $this->id,
            'user' => $this->user ?? [
                'id' => $this->userId,
                'name' => 'Unassigned',
            ],
            'asset' => $this->asset,
            'job' => $this->job,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'accuracy_metres' => $this->accuracyMetres,
            'speed' => $this->speed,
            'remarks' => $this->remarks,
            'source' => $this->source,
            'sharing_enabled' => $this->sharingEnabled,
            'captured_at' => $this->capturedAt?->toIso8601String(),
            'received_at' => $this->receivedAt?->toIso8601String(),
            'freshness_status' => $this->freshnessStatus,
        ];
    }

    private static function parseCarbon(mixed $value): ?CarbonImmutable
    {
        if ($value instanceof CarbonInterface) {
            return CarbonImmutable::instance($value);
        }
        if (is_string($value) && $value !== '') {
            return CarbonImmutable::parse($value);
        }

        return null;
    }
}
