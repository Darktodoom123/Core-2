<?php

namespace App\Actions;

use App\Enums\FuelRequestStatus;
use App\Enums\PermissionName;
use App\Models\FuelRequest;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class TransitionFuelRequest
{
    public function __construct(private RecordAuditEvent $audit) {}

    public function handle(User $actor, FuelRequest $fuel, FuelRequestStatus $next, ?string $reason = null): FuelRequest
    {
        $rule = match ($next) {
            FuelRequestStatus::Forwarded => [FuelRequestStatus::Submitted, PermissionName::FuelForward, 'reviewed_by', 'reviewed_at'],
            FuelRequestStatus::Approved, FuelRequestStatus::Rejected => [FuelRequestStatus::Forwarded, PermissionName::FuelApprove, 'approved_by', 'approved_at'],
            FuelRequestStatus::Verified => [FuelRequestStatus::Approved, PermissionName::FuelVerify, 'verified_by', 'verified_at'],
            default => throw ValidationException::withMessages(['status' => 'Unsupported fuel transition.']),
        };
        if (! $actor->can($rule[1]->value) || ($next === FuelRequestStatus::Approved && $fuel->requester_id === $actor->id)) {
            throw new AuthorizationException;
        }

        return DB::transaction(function () use ($actor, $fuel, $next, $reason, $rule): FuelRequest {
            $fuel = FuelRequest::query()->lockForUpdate()->findOrFail($fuel->id);
            if ($fuel->status !== $rule[0]) {
                throw ValidationException::withMessages(['status' => 'The fuel request is not at the required stage.']);
            }
            $before = ['status' => $fuel->status->value];
            $fuel->update(['status' => $next, $rule[2] => $actor->id, $rule[3] => now(), 'decision_reason' => $reason]);
            $this->audit->handle($actor, $fuel, 'fuel.status_updated', $before, ['status' => $next->value], $reason);

            return $fuel->refresh();
        });
    }
}
