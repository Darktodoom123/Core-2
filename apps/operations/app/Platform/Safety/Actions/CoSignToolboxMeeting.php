<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Events\ToolboxMeetingChanged;
use App\Platform\Safety\Models\ToolboxMeeting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class CoSignToolboxMeeting
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(User $safetyOfficer, ToolboxMeeting $meeting): ToolboxMeeting
    {
        return DB::transaction(function () use ($safetyOfficer, $meeting): ToolboxMeeting {
            /** @var ToolboxMeeting $lockedMeeting */
            $lockedMeeting = ToolboxMeeting::query()->whereKey($meeting->id)->lockForUpdate()->firstOrFail();

            if ($lockedMeeting->safety_officer_signed_at !== null) {
                return $lockedMeeting;
            }

            $before = $lockedMeeting->only(['safety_officer_id', 'safety_officer_signed_at']);
            $lockedMeeting->update([
                'safety_officer_id' => $safetyOfficer->id,
                'safety_officer_signed_at' => Carbon::now(),
            ]);

            $refreshed = $lockedMeeting->fresh();
            $this->audit->handle($safetyOfficer, $refreshed, 'safety.toolbox_meeting_cosigned', $before, $refreshed->only(['safety_officer_id', 'safety_officer_signed_at']));
            event(new ToolboxMeetingChanged($refreshed, 'cosigned'));

            return $refreshed;
        });
    }
}
