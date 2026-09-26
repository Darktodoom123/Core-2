<?php

namespace App\Modules\Fuel\Actions;

use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Requester cancels their own request before the office decides it. */
final class WithdrawFuelRequest
{
    public function __construct(private RecordAuditEvent $audit) {}

    public function handle(User $actor, FuelRequest $fuel, ?string $reason = null): FuelRequest
    {
        if ($fuel->requester_id !== $actor->id) {
            throw new AuthorizationException('Only the requester can withdraw a fuel request.');
        }

        return DB::transaction(function () use ($actor, $fuel, $reason): FuelRequest {
            /** @var FuelRequest $locked */
            $locked = FuelRequest::query()->lockForUpdate()->findOrFail($fuel->id);

            if ($locked->status === FuelRequestStatus::Withdrawn) {
                return $locked;
            }

            if (! $locked->status->isAwaitingDecision()) {
                throw ValidationException::withMessages(['status' => "This request is already {$locked->status->label()} and can no longer be withdrawn."]);
            }

            $before = ['status' => $locked->status->value];
            $locked->update([
                'status' => FuelRequestStatus::Withdrawn,
                'withdrawn_at' => now(),
                'withdrawal_reason' => $reason !== null && trim($reason) !== '' ? trim($reason) : null,
            ]);
            $this->audit->handle($actor, $locked, 'fuel.withdrawn', $before, ['status' => FuelRequestStatus::Withdrawn->value], $locked->withdrawal_reason);

            return $locked->refresh();
        });
    }
}
