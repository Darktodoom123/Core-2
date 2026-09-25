<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Events\CriticalLiftPlanChanged;
use App\Platform\Safety\Models\CriticalLiftPlan;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AuthorizeCriticalLiftPlan
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function authorize(User $safetyOfficer, CriticalLiftPlan $liftPlan): CriticalLiftPlan
    {
        return DB::transaction(function () use ($safetyOfficer, $liftPlan): CriticalLiftPlan {
            /** @var CriticalLiftPlan $lockedPlan */
            $lockedPlan = CriticalLiftPlan::query()->where('id', $liftPlan->id)->lockForUpdate()->firstOrFail();

            if ($lockedPlan->status === 'approved') {
                return $lockedPlan;
            }

            if ($lockedPlan->status !== 'pending_so_review') {
                throw ValidationException::withMessages([
                    'decision' => 'Only a lift plan awaiting review can be authorized. Refresh the plan and review its current status.',
                ]);
            }

            $before = $lockedPlan->only(['status', 'safety_officer_id', 'safety_officer_signed_at', 'rejection_reason']);
            $lockedPlan->update([
                'status' => 'approved',
                'safety_officer_id' => $safetyOfficer->id,
                'safety_officer_signed_at' => Carbon::now(),
                'rejection_reason' => null,
            ]);

            $refreshed = $lockedPlan->fresh();
            $this->audit->handle($safetyOfficer, $refreshed, 'safety.critical_lift_plan_approved', $before, $refreshed->only(['status', 'safety_officer_id', 'safety_officer_signed_at', 'rejection_reason']));
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

            if ($lockedPlan->status !== 'pending_so_review') {
                throw ValidationException::withMessages([
                    'decision' => 'Only a lift plan awaiting review can be rejected. Refresh the plan and review its current status.',
                ]);
            }

            $before = $lockedPlan->only(['status', 'safety_officer_id', 'safety_officer_signed_at', 'rejection_reason']);
            $lockedPlan->update([
                'status' => 'rejected',
                'safety_officer_id' => $safetyOfficer->id,
                'safety_officer_signed_at' => Carbon::now(),
                'rejection_reason' => $reason,
            ]);

            $refreshed = $lockedPlan->fresh();
            $this->audit->handle($safetyOfficer, $refreshed, 'safety.critical_lift_plan_rejected', $before, $refreshed->only(['status', 'safety_officer_id', 'safety_officer_signed_at', 'rejection_reason']), $reason);
            event(new CriticalLiftPlanChanged($refreshed, 'rejected'));

            return $refreshed;
        });
    }
}
