<?php

namespace App\Modules\Fuel\Actions;

use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\Fuel\Notifications\FuelRequestStatusNotification;
use App\Modules\Fuel\Notifications\FuelRequestSubmittedNotification;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\Jobs\SendQueuedNotificationJob;
use Illuminate\Support\Facades\DB;

/** Queues fuel notifications only after the surrounding transaction commits. */
final class FuelNotifier
{
    private const REQUESTER_STATUSES = [
        FuelRequestStatus::Approved,
        FuelRequestStatus::Rejected,
        FuelRequestStatus::Verified,
    ];

    public function statusChanged(FuelRequest $fuel): void
    {
        if (! in_array($fuel->status, self::REQUESTER_STATUSES, true)) {
            return;
        }

        $fuelId = $fuel->id;

        DB::afterCommit(function () use ($fuelId): void {
            $fresh = FuelRequest::query()->with(['requester', 'asset:id,code', 'job:id,reference'])->find($fuelId);

            if ($fresh === null || ! $fresh->requester->is_active) {
                return;
            }

            SendQueuedNotificationJob::dispatch(
                $fresh->requester,
                new FuelRequestStatusNotification($fresh),
                "fuel.status:{$fresh->id}:{$fresh->status->value}",
            );
        });
    }

    public function submitted(FuelRequest $fuel): void
    {
        $fuelId = $fuel->id;

        DB::afterCommit(function () use ($fuelId): void {
            $fresh = FuelRequest::query()->with(['requester:id,name', 'asset:id,code'])->find($fuelId);

            if ($fresh === null) {
                return;
            }

            $reviewers = User::query()
                ->where('is_active', true)
                ->whereKeyNot($fresh->requester_id)
                ->permission(PermissionName::FuelForward->value)
                ->get();

            foreach ($reviewers as $reviewer) {
                SendQueuedNotificationJob::dispatch(
                    $reviewer,
                    new FuelRequestSubmittedNotification($fresh),
                    "fuel.submitted:{$fresh->id}:{$reviewer->id}",
                );
            }
        });
    }
}
