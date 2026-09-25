<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Events\WorkStoppageChanged;
use App\Platform\Safety\Models\WorkStoppageNotice;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class LiftWorkStoppageNotice
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(User $manager, WorkStoppageNotice $notice, string $liftReason): WorkStoppageNotice
    {
        if (mb_strlen(trim($liftReason)) < 5) {
            throw ValidationException::withMessages([
                'lift_reason' => 'Enter at least five characters describing the correction and verification before lifting this stop-work order.',
            ]);
        }

        return DB::transaction(function () use ($manager, $notice, $liftReason): WorkStoppageNotice {
            /** @var WorkStoppageNotice $lockedNotice */
            $lockedNotice = WorkStoppageNotice::query()->where('id', $notice->id)->lockForUpdate()->firstOrFail();

            if (! $lockedNotice->is_active) {
                return $lockedNotice;
            }

            $before = $lockedNotice->only(['is_active', 'lifted_by', 'lifted_at', 'lift_reason']);
            $lockedNotice->update([
                'is_active' => false,
                'lifted_by' => $manager->id,
                'lifted_at' => Carbon::now(),
                'lift_reason' => $liftReason,
            ]);

            $refreshed = $lockedNotice->fresh();
            $this->audit->handle($manager, $refreshed, 'safety.work_stoppage_lifted', $before, $refreshed->only(['is_active', 'lifted_by', 'lifted_at', 'lift_reason']), $liftReason);
            event(new WorkStoppageChanged($refreshed, 'lifted'));

            return $refreshed;
        });
    }
}
