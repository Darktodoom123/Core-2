<?php

namespace App\Modules\Dispatch\Data;

use Carbon\CarbonImmutable;

final readonly class DispatchScheduleWindow
{
    public function __construct(
        public int $dispatchJobId,
        public string $reference,
        public ?CarbonImmutable $start,
        public ?CarbonImmutable $end,
    ) {}

    public function overlaps(?CarbonImmutable $leftStart, ?CarbonImmutable $leftEnd): bool
    {
        if ($leftStart === null || $leftEnd === null || $this->start === null || $this->end === null) {
            return true;
        }

        return $leftStart->lt($this->end) && $this->start->lt($leftEnd);
    }
}
