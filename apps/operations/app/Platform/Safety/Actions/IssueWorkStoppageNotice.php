<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Identity\Models\User;
use App\Platform\Safety\Events\WorkStoppageChanged;
use App\Platform\Safety\Models\WorkStoppageNotice;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class IssueWorkStoppageNotice
{
    /**
     * @param array{
     *     project_site: string,
     *     dole_regulation_reference?: string,
     *     reason: string,
     *     affected_asset_ids?: array<int>|null,
     *     affected_area: string,
     * } $data
     */
    public function handle(User $safetyOfficer, array $data): WorkStoppageNotice
    {
        return DB::transaction(function () use ($safetyOfficer, $data): WorkStoppageNotice {
            $number = sprintf('WSO-%s-%s', date('Ymd'), strtoupper(Str::random(4)));

            $notice = WorkStoppageNotice::query()->create([
                'notice_number' => $number,
                'project_site' => $data['project_site'],
                'safety_officer_id' => $safetyOfficer->id,
                'dole_regulation_reference' => $data['dole_regulation_reference'] ?? 'DOLE D.O. 13 s. 1998 Section 8 & RA 11058 Section 20',
                'reason' => $data['reason'],
                'affected_asset_ids' => $data['affected_asset_ids'] ?? null,
                'affected_area' => $data['affected_area'],
                'is_active' => true,
            ]);

            event(new WorkStoppageChanged($notice, 'issued'));

            return $notice;
        });
    }
}
