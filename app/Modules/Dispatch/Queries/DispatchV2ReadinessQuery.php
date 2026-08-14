<?php

namespace App\Modules\Dispatch\Queries;

use App\Modules\Dispatch\Data\DispatchReadinessProjection;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Services\DispatchV2CommandService;
use App\Platform\Identity\Models\User;

final class DispatchV2ReadinessQuery
{
    public function __construct(private readonly DispatchV2CommandService $commands) {}

    public function handle(
        User $actor,
        DispatchExecutionAttempt|int $attempt,
        string $workspaceKey = 'operations',
        ?int $expectedVersion = null,
    ): DispatchReadinessProjection {
        return $this->commands->readiness($actor, $attempt, $workspaceKey, $expectedVersion);
    }
}
