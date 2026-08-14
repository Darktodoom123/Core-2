<?php

namespace App\Modules\Dispatch\Commands;

use App\Modules\Dispatch\Data\DispatchReadinessProjection;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchPlanApproval;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Modules\Dispatch\Services\DispatchV2CommandService;
use App\Platform\Identity\Models\User;

/**
 * Adapter-facing typed command boundary. Controllers and mobile adapters can depend on this class
 * without knowing about persistence, locks, audit lineage, or the legacy dispatch job.
 */
final class DispatchV2Commands
{
    public function __construct(private readonly DispatchV2CommandService $service) {}

    public function create(User $actor, DispatchJob|int $job, DispatchV2Mutation $mutation): DispatchExecutionAttempt
    {
        return $this->service->create($actor, $job, $mutation);
    }

    public function submitPlan(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchPlanVersion
    {
        return $this->service->submitPlan($actor, $attempt, $mutation);
    }

    public function approvePlan(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchPlanApproval
    {
        return $this->service->approvePlan($actor, $attempt, $mutation);
    }

    public function dispatch(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchExecutionAttempt
    {
        return $this->service->dispatch($actor, $attempt, $mutation);
    }

    public function progress(User $actor, DispatchExecutionAttempt|int $attempt, DispatchAttemptStatus $next, DispatchV2Mutation $mutation): DispatchExecutionAttempt
    {
        return $this->service->progress($actor, $attempt, $next, $mutation);
    }

    public function cancel(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchExecutionAttempt
    {
        return $this->service->cancel($actor, $attempt, $mutation);
    }

    public function reopen(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchExecutionAttempt
    {
        return $this->service->reopen($actor, $attempt, $mutation);
    }

    public function archive(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchExecutionAttempt
    {
        return $this->service->archive($actor, $attempt, $mutation);
    }

    public function readiness(User $actor, DispatchExecutionAttempt|int $attempt, string $workspaceKey = 'operations', ?int $expectedVersion = null): DispatchReadinessProjection
    {
        return $this->service->readiness($actor, $attempt, $workspaceKey, $expectedVersion);
    }
}
