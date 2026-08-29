<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Identity\Models\User;
use App\Platform\Safety\Events\CriticalLiftPlanChanged;
use App\Platform\Safety\Models\CriticalLiftPlan;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AuthorizeCriticalLiftPlan
{
    public function authorize(User $safetyOfficer, CriticalLiftPlan $liftPlan): CriticalLiftPlan
    {
        return DB::transaction(function () use ($safetyOfficer, $liftPlan): CriticalLiftPlan {
            /** @var CriticalLiftPlan $lockedPlan */
            $lockedPlan = CriticalLiftPlan::query()->where('id', $liftPlan->id)->lockForUpdate()->firstOrFail();

            if ($lockedPlan->status === 'approved') {
                return $lockedPlan;
            }

            $lockedPlan->update([
                'status' => 'approved',
                'safety_officer_id' => $safetyOfficer->id,
                'safety_officer_signed_at' => Carbon::now(),
                'rejection_reason' => null,
            ]);

            $refreshed = $lockedPlan->fresh();
            event(new CriticalLiftPlanChanged($refreshed, 'approved'));

            return $refreshed;
        });
    }

    public function reject(User $safetyOfficer, CriticalLiftPlan $liftPlan, string $reason): CriticalLiftPlan
    {
        if (trim($reason) === '') {
            throw ValidationException::withMessages([
                'reason' => 'A specific safety reason must be provided when rejecting a lift plan.',
            ]);
        }

        return DB::transaction(function () use ($safetyOfficer, $liftPlan, $reason): CriticalLiftPlan {
            /** @var CriticalLiftPlan $lockedPlan */
            $lockedPlan = CriticalLiftPlan::query()->where('id', $liftPlan->id)->lockForUpdate()->firstOrFail();

            $lockedPlan->update([
                'status' => 'rejected',
                'safety_officer_id' => $safetyOfficer->id,
                'safety_officer_signed_at' => Carbon::now(),
                'rejection_reason' => $reason,
            ]);

            $refreshed = $lockedPlan->fresh();
            event(new CriticalLiftPlanChanged($refreshed, 'rejected'));

            return $refreshed;
        });
    }
}
