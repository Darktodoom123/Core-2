<?php

namespace App\Platform\Tracking\Data;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

final readonly class LocationSampleDto
{
    public function __construct(
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
        public ?string $commandId = null,
        public ?int $id = null,
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        return new self(
            userId: (int) ($data['user_id'] ?? $data['userId'] ?? 0),
            operationalAssetId: isset($data['operational_asset_id']) ? (int) $data['operational_asset_id'] : (isset($data['operationalAssetId']) ? (int) $data['operationalAssetId'] : null),
            dispatchJobId: isset($data['dispatch_job_id']) ? (int) $data['dispatch_job_id'] : (isset($data['dispatchJobId']) ? (int) $data['dispatchJobId'] : null),
            latitude: isset($data['latitude']) ? (float) $data['latitude'] : null,
            longitude: isset($data['longitude']) ? (float) $data['longitude'] : null,
            accuracyMetres: isset($data['accuracy_metres']) ? (float) $data['accuracy_metres'] : (isset($data['accuracyMetres']) ? (float) $data['accuracyMetres'] : null),
            speed: isset($data['speed']) ? (float) $data['speed'] : null,
            remarks: isset($data['remarks']) ? (string) $data['remarks'] : null,
            source: (string) ($data['source'] ?? 'mobile'),
            sharingEnabled: (bool) ($data['sharing_enabled'] ?? $data['sharingEnabled'] ?? true),
            capturedAt: self::parseCarbon($data['captured_at'] ?? $data['capturedAt'] ?? null),
            receivedAt: self::parseCarbon($data['received_at'] ?? $data['receivedAt'] ?? null),
            commandId: isset($data['command_id']) ? (string) $data['command_id'] : (isset($data['commandId']) ? (string) $data['commandId'] : null),
            id: isset($data['id']) ? (int) $data['id'] : null,
        );
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

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->userId,
            'operational_asset_id' => $this->operationalAssetId,
            'dispatch_job_id' => $this->dispatchJobId,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'accuracy_metres' => $this->accuracyMetres,
            'speed' => $this->speed,
            'remarks' => $this->remarks,
            'source' => $this->source,
            'sharing_enabled' => $this->sharingEnabled,
            'captured_at' => $this->capturedAt?->toIso8601String(),
            'received_at' => $this->receivedAt?->toIso8601String(),
            'command_id' => $this->commandId,
        ];
    }
}
