<?php

namespace App\Modules\Dispatch\Data;

final readonly class DispatchReadinessProjection
{
    /**
     * @param  list<DispatchReadinessBlocker>  $blockers
     * @param  list<string>  $labels
     */
    public function __construct(
        public bool $ready,
        public bool $scheduled,
        public bool $awaitingApproval,
        public array $labels,
        public array $blockers,
        public int $attemptVersion,
        public ?int $planVersion,
    ) {}

    /**
     * @return array{ready: bool, scheduled: bool, awaiting_approval: bool, labels: list<string>, blockers: list<array<string, mixed>>, attempt_version: int, plan_version: int|null}
     */
    public function toArray(): array
    {
        return [
            'ready' => $this->ready,
            'scheduled' => $this->scheduled,
            'awaiting_approval' => $this->awaitingApproval,
            'labels' => $this->labels,
            'blockers' => array_map(static fn (DispatchReadinessBlocker $blocker): array => $blocker->toArray(), $this->blockers),
            'attempt_version' => $this->attemptVersion,
            'plan_version' => $this->planVersion,
        ];
    }

    /** @return list<array<string, mixed>> */
    public function blockerArrays(): array
    {
        return array_map(static fn (DispatchReadinessBlocker $blocker): array => $blocker->toArray(), $this->blockers);
    }
}
