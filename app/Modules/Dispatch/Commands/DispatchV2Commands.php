<?php

namespace App\Modules\Dispatch\Commands;

use App\Modules\Assignment\Services\DispatchAssignmentOfferCommandService;
use App\Modules\Dispatch\Data\DispatchReadinessProjection;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchEmergencyOverride;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchPlanApproval;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Modules\Dispatch\Services\DispatchEmergencyOverrideCommandService;
use App\Modules\Dispatch\Services\DispatchLeadCommandService;
use App\Modules\Dispatch\Services\DispatchV2CommandService;
use App\Platform\Identity\Models\User;

/**
 * Adapter-facing typed command boundary. Controllers and mobile adapters can depend on this class
 * without knowing about persistence, locks, audit lineage, or the legacy dispatch job.
 */
final class DispatchV2Commands
{
    public function __construct(
        private readonly DispatchV2CommandService $service,
        private readonly DispatchAssignmentOfferCommandService $offers,
        private readonly DispatchLeadCommandService $leads,
        private readonly DispatchEmergencyOverrideCommandService $overrides,
    ) {}

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

    public function rejectPlan(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchPlanApproval
    {
        return $this->service->rejectPlan($actor, $attempt, $mutation);
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

    public function proposeOffer(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->offers->propose($actor, $attempt, $mutation);
    }

    public function offer(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->offers->offer($actor, $offer, $mutation);
    }

    public function acceptOffer(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->offers->accept($actor, $offer, $mutation);
    }

    public function rejectOffer(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->offers->reject($actor, $offer, $mutation);
    }

    public function withdrawOffer(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->offers->withdraw($actor, $offer, $mutation);
    }

    public function expireOffer(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->offers->expire($actor, $offer, $mutation);
    }

    public function endOffer(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->offers->end($actor, $offer, $mutation);
    }

    public function designateLead(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchExecutionAttempt
    {
        return $this->leads->designate($actor, $attempt, $mutation);
    }

    public function replaceLead(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchExecutionAttempt
    {
        return $this->leads->replace($actor, $attempt, $mutation);
    }

    public function proposeEmergencyOverride(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchEmergencyOverride
    {
        return $this->overrides->propose($actor, $attempt, $mutation);
    }

    public function approveEmergencyOverride(User $actor, DispatchEmergencyOverride|int $override, DispatchV2Mutation $mutation): DispatchEmergencyOverride
    {
        return $this->overrides->decide($actor, $override, $mutation, true);
    }

    public function rejectEmergencyOverride(User $actor, DispatchEmergencyOverride|int $override, DispatchV2Mutation $mutation): DispatchEmergencyOverride
    {
        return $this->overrides->decide($actor, $override, $mutation, false);
    }
}
