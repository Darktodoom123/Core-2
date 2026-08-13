<?php

namespace App\Shared\Assets\Data;

final readonly class AssetUsageConflict
{
    /** @param array<string, scalar|null> $details */
    public function __construct(
        public string $code,
        public string $message,
        public ?AssetUsageSource $source = null,
        public array $details = [],
    ) {}

    /** @return array{code: string, message: string, source: array{type: string, id: int}|null, details: array<string, scalar|null>} */
    public function toArray(): array
    {
        return [
            'code' => $this->code,
            'message' => $this->message,
            'source' => $this->source === null ? null : [
                'type' => $this->source->aggregateType,
                'id' => $this->source->aggregateId,
            ],
            'details' => $this->details,
        ];
    }
}
