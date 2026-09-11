<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\SiteHazardTicket;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class LogSiteHazardTicket
{
    /**
     * @param array{
     *     project_site: string,
     *     category: string,
     *     severity: string,
     *     description: string,
     *     location_detail: string,
     *     photo_evidence_url?: string|null,
     *     corrective_action_required: string,
     *     work_stoppage_issued?: bool,
     * } $data
     */
    public function handle(User $reporter, array $data): SiteHazardTicket
    {
        return DB::transaction(function () use ($reporter, $data): SiteHazardTicket {
            $code = sprintf('HAZ-%s-%s', date('Ymd'), strtoupper(Str::random(4)));

            return SiteHazardTicket::query()->create([
                'ticket_code' => $code,
                'project_site' => $data['project_site'],
                'reporter_id' => $reporter->id,
                'category' => $data['category'],
                'severity' => $data['severity'],
                'description' => $data['description'],
                'location_detail' => $data['location_detail'],
                'photo_evidence_url' => $data['photo_evidence_url'] ?? null,
                'corrective_action_required' => $data['corrective_action_required'],
                'status' => 'open',
                'work_stoppage_issued' => (bool) ($data['work_stoppage_issued'] ?? false) || $data['severity'] === 'imminent_danger',
            ]);
        });
    }

    public function rectify(User $user, SiteHazardTicket $ticket): SiteHazardTicket
    {
        return DB::transaction(function () use ($user, $ticket): SiteHazardTicket {
            $ticket->update([
                'status' => 'rectified',
                'rectified_by' => $user->id,
                'rectified_at' => Carbon::now(),
            ]);

            return $ticket->fresh();
        });
    }
}
