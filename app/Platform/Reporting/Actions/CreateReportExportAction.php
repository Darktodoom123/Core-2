<?php

namespace App\Platform\Reporting\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Exports\ReportExportCatalog;
use App\Platform\Reporting\Jobs\GenerateReportExportJob;
use App\Platform\Reporting\Models\ReportExport;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class CreateReportExportAction
{
    public function __construct(
        private readonly RecordAuditEvent $recordAudit,
        private readonly ReportExportCatalog $catalog,
    ) {}

    /**
     * @param  array<string, mixed>  $filters
     */
    public function execute(User $user, ReportExportType $type, string $format, array $filters = []): ReportExport
    {
        $this->catalog->authorize($user, $type);
        $format = strtolower($format);
        ksort($filters);
        $fingerprint = hash('sha256', json_encode([
            'user_id' => $user->id,
            'export_type' => $type->value,
            'format' => $format,
            'filters' => $filters,
        ], JSON_THROW_ON_ERROR));

        try {
            return DB::transaction(function () use ($user, $type, $format, $filters, $fingerprint): ReportExport {
                $existing = ReportExport::query()
                    ->where('request_fingerprint', $fingerprint)
                    ->lockForUpdate()
                    ->first();

                if ($existing !== null) {
                    return $existing;
                }

                $export = ReportExport::query()->create([
                    'user_id' => $user->id,
                    'export_type' => $type,
                    'format' => $format,
                    'status' => ReportExportStatus::Queued,
                    'filters' => $filters,
                    'authorization_snapshot' => [
                        'user_id' => $user->id,
                        'permissions' => $user->getAllPermissions()->pluck('name')->sort()->values()->all(),
                    ],
                    'request_fingerprint' => $fingerprint,
                    // Legacy readers use expires_at until all consumers adopt download_expires_at.
                    'expires_at' => now()->addDay(),
                    'download_expires_at' => now()->addDay(),
                    'purge_at' => now()->addDays(7),
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
            });
        } catch (QueryException $e) {
            $existing = ReportExport::query()
                ->where('request_fingerprint', $fingerprint)
                ->first();

            if ($existing !== null) {
                return $existing;
            }

            throw $e;
        }
    }
}
