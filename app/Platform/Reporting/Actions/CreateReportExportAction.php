<?php

namespace App\Platform\Reporting\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Jobs\GenerateReportExportJob;
use App\Platform\Reporting\Models\ReportExport;

class CreateReportExportAction
{
    public function __construct(
        private readonly RecordAuditEvent $recordAudit
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     */
    public function execute(User $user, ReportExportType $type, string $format, array $filters = []): ReportExport
    {
        $export = ReportExport::query()->create([
            'user_id' => $user->id,
            'export_type' => $type,
            'format' => strtolower($format),
            'status' => ReportExportStatus::Queued,
            'filters' => $filters,
            'expires_at' => now()->addDays(7),
        ]);

        $this->recordAudit->handle(
            actor: $user,
            subject: $export,
            action: 'report_export.requested',
            after: [
                'export_type' => $type->value,
                'format' => $format,
                'filters' => $filters,
            ]
        );

        GenerateReportExportJob::dispatch($export->id);

        return $export;
    }
}
