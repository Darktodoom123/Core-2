<?php

namespace App\Modules\Assignment\Commands;

use App\Modules\Assignment\Services\DispatchAssignmentOfferCommandService;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Platform\Identity\Models\User;

final class DispatchAssignmentOfferCommands
{
    public function __construct(private readonly DispatchAssignmentOfferCommandService $service) {}

    public function propose(User $actor, DispatchExecutionAttempt|int $attempt, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->service->propose($actor, $attempt, $mutation);
    }

    public function offer(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->service->offer($actor, $offer, $mutation);
    }

    public function accept(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->service->accept($actor, $offer, $mutation);
    }

    public function reject(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->service->reject($actor, $offer, $mutation);
    }

    public function withdraw(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->service->withdraw($actor, $offer, $mutation);
    }

    public function expire(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->service->expire($actor, $offer, $mutation);
    }

    public function end(User $actor, DispatchAssignmentOffer|int $offer, DispatchV2Mutation $mutation): DispatchAssignmentOffer
    {
        return $this->service->end($actor, $offer, $mutation);
    }
}
