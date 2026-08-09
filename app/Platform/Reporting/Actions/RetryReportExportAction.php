<?php

namespace App\Platform\Reporting\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Jobs\GenerateReportExportJob;
use App\Platform\Reporting\Models\ReportExport;
use Illuminate\Support\Facades\DB;

final class RetryReportExportAction
{
    public function __construct(
        private readonly RecordAuditEvent $recordAudit,
    ) {}

    /**
     * Lock the export before changing its state so duplicate retry requests
     * can observe the first queued transition and do not dispatch duplicate
     * generation jobs.
     *
     * @return array{export: ReportExport, queued: bool}
     */
    public function execute(User $actor, ReportExport $export): array
    {
        [$export, $queued] = DB::transaction(function () use ($actor, $export): array {
            $locked = ReportExport::query()
                ->whereKey($export->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($locked->status !== ReportExportStatus::Failed) {
                return [$locked, false];
            }

            $now = now();
            $locked->update([
                'status' => ReportExportStatus::Queued,
                'file_path' => null,
                'mime_type' => null,
                'checksum_sha256' => null,
                'file_size_bytes' => null,
                'row_count' => null,
                'error_message' => null,
                'started_at' => null,
                'completed_at' => null,
                'expires_at' => $now->copy()->addDay(),
                'download_expires_at' => $now->copy()->addDay(),
                'purge_at' => $now->copy()->addDays(7),
            ]);

            $this->recordAudit->handle(
                actor: $actor,
                subject: $locked,
                action: 'report_export.retried',
                after: ['export_id' => $locked->getKey()],
            );

            return [$locked->fresh(), true];
        });

        if ($queued) {
            GenerateReportExportJob::dispatch($export->getKey())->afterCommit();
        }

        return ['export' => $export, 'queued' => $queued];
    }
}
