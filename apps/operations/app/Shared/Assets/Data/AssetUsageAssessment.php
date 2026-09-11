<?php

namespace App\Shared\Assets\Data;

final readonly class AssetUsageAssessment
{
    /** @param list<AssetUsageConflict> $conflicts */
    public function __construct(public array $conflicts = []) {}

    public function allowed(): bool
    {
        return $this->conflicts === [];
    }

    public function hasConflicts(): bool
    {
        return ! $this->allowed();
    }

    /** @return list<array{code: string, message: string, source: array{type: string, id: int}|null, details: array<string, scalar|null>}> */
    public function toArray(): array
    {
        return array_map(static fn (AssetUsageConflict $conflict): array => $conflict->toArray(), $this->conflicts);
    }
}
