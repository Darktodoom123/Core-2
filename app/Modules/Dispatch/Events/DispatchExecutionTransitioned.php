<?php

namespace App\Modules\Dispatch\Events;

use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

final class DispatchExecutionTransitioned implements ShouldDispatchAfterCommit
{
    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    public function __construct(
        public readonly int $attemptId,
        public readonly string $action,
        public readonly array $before,
        public readonly array $after,
        public readonly ?int $actorId,
    ) {}
}
