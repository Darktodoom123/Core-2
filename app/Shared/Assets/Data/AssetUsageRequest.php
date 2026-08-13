<?php

namespace App\Shared\Assets\Data;

use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use Carbon\CarbonImmutable;
use InvalidArgumentException;

final readonly class AssetUsageRequest
{
    public function __construct(
        public int $assetId,
        public AssetUsageType $usageType,
        public ?CarbonImmutable $windowStart = null,
        public ?CarbonImmutable $windowEnd = null,
        public ?AssetStatus $targetStatus = null,
        public ?AssetUsageSource $source = null,
        /** @var array<int, int> */
        public array $excludedAssignmentIds = [],
    ) {
        if ($this->assetId < 1) {
            throw new InvalidArgumentException('An asset ID must be positive.');
        }

        if (($this->windowStart === null) !== ($this->windowEnd === null)) {
            throw new InvalidArgumentException('Asset usage windows require both boundaries.');
        }

        if ($this->windowStart !== null && $this->windowEnd !== null && ! $this->windowStart->lt($this->windowEnd)) {
            throw new InvalidArgumentException('Asset usage windows must be half-open and non-empty.');
        }

        if (array_filter($this->excludedAssignmentIds, static fn (int $id): bool => $id < 1) !== []) {
            throw new InvalidArgumentException('Excluded assignment IDs must be positive.');
        }
    }

    public static function rental(
        int $assetId,
        AssetUsageType $usageType,
        CarbonImmutable $windowStart,
        CarbonImmutable $windowEnd,
        ?AssetUsageSource $source = null,
    ): self {
        return new self($assetId, $usageType, $windowStart, $windowEnd, source: $source);
    }

    /** @param array<int, int> $excludedAssignmentIds */
    public static function dispatch(
        int $assetId,
        AssetUsageType $usageType,
        ?CarbonImmutable $windowStart,
        ?CarbonImmutable $windowEnd,
        ?AssetUsageSource $source = null,
        array $excludedAssignmentIds = [],
    ): self {
        return new self($assetId, $usageType, $windowStart, $windowEnd, source: $source, excludedAssignmentIds: $excludedAssignmentIds);
    }
}
