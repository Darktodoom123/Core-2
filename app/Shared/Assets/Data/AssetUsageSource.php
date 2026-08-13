<?php

namespace App\Shared\Assets\Data;

use InvalidArgumentException;

final readonly class AssetUsageSource
{
    public function __construct(
        public string $aggregateType,
        public int $aggregateId,
    ) {
        if ($this->aggregateType === '') {
            throw new InvalidArgumentException('An asset usage source type is required.');
        }

        if ($this->aggregateId < 1) {
            throw new InvalidArgumentException('An asset usage source ID must be positive.');
        }
    }
}
