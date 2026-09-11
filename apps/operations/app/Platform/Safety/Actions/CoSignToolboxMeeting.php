<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Identity\Models\User;
use App\Platform\Safety\Events\ToolboxMeetingChanged;
use App\Platform\Safety\Models\ToolboxMeeting;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class CoSignToolboxMeeting
{
    public function handle(User $safetyOfficer, ToolboxMeeting $meeting): ToolboxMeeting
    {
        if ($meeting->safety_officer_signed_at !== null) {
            return $meeting;
        }

        return DB::transaction(function () use ($safetyOfficer, $meeting): ToolboxMeeting {
            $meeting->update([
                'safety_officer_id' => $safetyOfficer->id,
                'safety_officer_signed_at' => Carbon::now(),
            ]);

            $refreshed = $meeting->fresh();
            event(new ToolboxMeetingChanged($refreshed, 'cosigned'));

            return $refreshed;
        });
    }
}
