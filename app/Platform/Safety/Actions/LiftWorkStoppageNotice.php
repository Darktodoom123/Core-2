<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Identity\Models\User;
use App\Platform\Safety\Events\WorkStoppageChanged;
use App\Platform\Safety\Models\WorkStoppageNotice;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class LiftWorkStoppageNotice
{
    public function handle(User $safetyOfficer, WorkStoppageNotice $notice, string $liftReason): WorkStoppageNotice
    {
        if (trim($liftReason) === '') {
            throw ValidationException::withMessages([
                'lift_reason' => 'A formal justification and verification note is required to lift a statutory Work Stoppage Order.',
            ]);
        }

        return DB::transaction(function () use ($safetyOfficer, $notice, $liftReason): WorkStoppageNotice {
            /** @var WorkStoppageNotice $lockedNotice */
            $lockedNotice = WorkStoppageNotice::query()->where('id', $notice->id)->lockForUpdate()->firstOrFail();

            if (! $lockedNotice->is_active) {
                return $lockedNotice;
            }

            $lockedNotice->update([
                'is_active' => false,
                'lifted_by' => $safetyOfficer->id,
                'lifted_at' => Carbon::now(),
                'lift_reason' => $liftReason,
            ]);

            $refreshed = $lockedNotice->fresh();
            event(new WorkStoppageChanged($refreshed, 'lifted'));

            return $refreshed;
        });
    }
}
