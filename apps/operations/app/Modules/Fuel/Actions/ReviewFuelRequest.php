<?php

namespace App\Modules\Fuel\Actions;

use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Single reviewer decision. A submitted request is forwarded and decided in one
 * transaction so both audited stages are kept while the reviewer acts once.
 */
final class ReviewFuelRequest
{
    public function __construct(private TransitionFuelRequest $transition) {}

    public function handle(User $actor, FuelRequest $fuel, FuelRequestStatus $decision, ?string $reason = null): FuelRequest
    {
        if ($decision !== FuelRequestStatus::Approved && $decision !== FuelRequestStatus::Rejected) {
            throw ValidationException::withMessages(['decision' => 'Choose approve or reject.']);
        }

        $reason = $reason !== null && trim($reason) !== '' ? trim($reason) : null;

        if ($decision === FuelRequestStatus::Rejected && $reason === null) {
            throw ValidationException::withMessages(['reason' => 'Give the requester a reason for declining.']);
        }

        return DB::transaction(function () use ($actor, $fuel, $decision, $reason): FuelRequest {
            /** @var FuelRequest $locked */
            $locked = FuelRequest::query()->lockForUpdate()->findOrFail($fuel->id);

            if (! $locked->status->isAwaitingDecision()) {
                throw ValidationException::withMessages(['status' => "This request is already {$locked->status->label()}."]);
            }

            if ($locked->status === FuelRequestStatus::Submitted) {
                $locked = $this->transition->handle($actor, $locked, FuelRequestStatus::Forwarded);
            }

            return $this->transition->handle($actor, $locked, $decision, $reason);
        });
    }
}
