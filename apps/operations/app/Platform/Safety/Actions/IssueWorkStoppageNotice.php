<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Events\WorkStoppageChanged;
use App\Platform\Safety\Models\WorkStoppageNotice;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class IssueWorkStoppageNotice
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    /**
     * @param array{
     *     project_site: string,
     *     dole_regulation_reference?: string,
     *     reason: string,
     *     affected_asset_ids?: array<int>|null,
     *     affected_area: string,
     * } $data
     */
    public function handle(User $issuer, array $data): WorkStoppageNotice
    {
        return DB::transaction(function () use ($issuer, $data): WorkStoppageNotice {
            $number = sprintf('WSO-%s-%s', date('Ymd'), strtoupper(Str::random(4)));

            $notice = WorkStoppageNotice::query()->create([
                'notice_number' => $number,
                'project_site' => $data['project_site'],
                'issued_by' => $issuer->id,
                'dole_regulation_reference' => $data['dole_regulation_reference'] ?? 'DOLE D.O. 13 s. 1998 Section 8 & RA 11058 Section 20',
                'reason' => $data['reason'],
                'affected_asset_ids' => $data['affected_asset_ids'] ?? null,
                'affected_area' => $data['affected_area'],
                'is_active' => true,
            ]);

            $this->audit->handle($issuer, $notice, 'safety.work_stoppage_issued', null, [
                'notice_number' => $notice->notice_number,
                'project_site' => $notice->project_site,
                'affected_area' => $notice->affected_area,
                'is_active' => $notice->is_active,
            ], $notice->reason);

            event(new WorkStoppageChanged($notice, 'issued'));

            return $notice;
        });
    }
}
