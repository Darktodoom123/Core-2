<?php

namespace App\Platform\Reporting\Jobs;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Models\FuelLog;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportStatus;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Reporting\Models\ReportExport;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Throwable;

class GenerateReportExportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public int $timeout = 300;

    public function __construct(
        public readonly string $exportId
    ) {}

    public function handle(RecordAuditEvent $recordAudit): void
    {
        $export = ReportExport::query()->find($this->exportId);
        if (! $export || $export->status->isTerminal()) {
            return;
        }

        $export->update([
            'status' => ReportExportStatus::Processing,
            'started_at' => now(),
        ]);

        try {
            $user = $export->user;
            $format = strtolower($export->format);
            $filename = $export->export_type->filenamePrefix().'-'.$export->id.'.'.$format;
            $relativePath = 'exports/'.$filename;

            $rows = [];
            $headers = [];

            match ($export->export_type) {
                ReportExportType::JobReports => $this->buildJobReportsExport($user, $headers, $rows),
                ReportExportType::Dispatches => $this->buildDispatchesExport($user, $headers, $rows),
                ReportExportType::FuelLogs => $this->buildFuelLogsExport($user, $headers, $rows),
                ReportExportType::MaintenanceLogs => $this->buildMaintenanceLogsExport($user, $headers, $rows),
            };

            $content = $this->generateCsvContent($headers, $rows);
            Storage::disk('private')->put($relativePath, $content);

            $fileSize = Storage::disk('private')->size($relativePath);

            $export->update([
                'status' => ReportExportStatus::Completed,
                'file_path' => $relativePath,
                'file_size_bytes' => $fileSize,
                'row_count' => count($rows),
                'completed_at' => now(),
            ]);

            $recordAudit->handle(
                actor: $user,
                subject: $export,
                action: 'report_export.completed',
                after: [
                    'file_path' => $relativePath,
                    'row_count' => count($rows),
                    'file_size_bytes' => $fileSize,
                ]
            );
        } catch (Throwable $e) {
            $export->update([
                'status' => ReportExportStatus::Failed,
                'error_message' => $e->getMessage(),
            ]);

            $recordAudit->handle(
                actor: $export->user,
                subject: $export,
                action: 'report_export.failed',
                after: [
                    'error' => $e->getMessage(),
                ]
            );

            throw $e;
        }
    }

    /**
     * @param  list<string>  $headers
     * @param  list<list<mixed>>  $rows
     */
    private function buildJobReportsExport(User $user, array &$headers, array &$rows): void
    {
        $headers = ['Report ID', 'Dispatch Reference', 'Author', 'Status', 'Started At', 'Ended At', 'Work Summary', 'Submitted At'];

        JobReport::visibleTo($user)
            ->with(['job', 'author'])
            ->latest()
            ->chunk(500, function ($reports) use (&$rows) {
                foreach ($reports as $report) {
                    $rows[] = [
                        $report->id,
                        $report->job->reference,
                        $report->author ? $report->author->name : 'Unknown',
                        $report->status->value,
                        $report->started_at?->toIso8601String() ?? '',
                        $report->ended_at?->toIso8601String() ?? '',
                        $report->work_summary,
                        $report->submitted_at?->toIso8601String() ?? '',
                    ];
                }
            });
    }

    /**
     * @param  list<string>  $headers
     * @param  list<list<mixed>>  $rows
     */
    private function buildDispatchesExport(User $user, array &$headers, array &$rows): void
    {
        $headers = ['Job ID', 'Reference Number', 'Title', 'Status', 'Priority', 'Scheduled Start', 'Scheduled End', 'Created At'];

        DispatchJob::visibleTo($user)
            ->latest()
            ->chunk(500, function ($jobs) use (&$rows) {
                foreach ($jobs as $job) {
                    $rows[] = [
                        $job->id,
                        $job->reference,
                        $job->title,
                        $job->status->value,
                        $job->priority->value,
                        $job->scheduled_start?->toIso8601String() ?? '',
                        $job->scheduled_end?->toIso8601String() ?? '',
                        $job->created_at?->toIso8601String() ?? '',
                    ];
                }
            });
    }

    /**
     * @param  list<string>  $headers
     * @param  list<list<mixed>>  $rows
     */
    private function buildFuelLogsExport(User $user, array &$headers, array &$rows): void
    {
        $headers = ['Log ID', 'Recorded By', 'Quantity (L)', 'Odometer (KM)', 'Hour Meter', 'Total Cost', 'Station', 'Recorded At'];

        FuelLog::query()
            ->with('recorder')
            ->latest()
            ->chunk(500, function ($logs) use (&$rows) {
                foreach ($logs as $log) {
                    $rows[] = [
                        $log->id,
                        $log->recorder->name,
                        $log->quantity_litres,
                        $log->odometer_km ?? '',
                        $log->hour_meter ?? '',
                        $log->total_cost ?? '',
                        $log->fuel_station ?? '',
                        $log->recorded_at?->toIso8601String() ?? '',
                    ];
                }
            });
    }


    /**
     * @param  list<string>  $headers
     * @param  list<list<mixed>>  $rows
     */
    private function buildMaintenanceLogsExport(User $user, array &$headers, array &$rows): void
    {
        $headers = ['Work Order ID', 'Asset ID', 'Defect', 'Status', 'Scheduled At', 'Created At'];

        MaintenanceWorkOrder::query()
            ->latest()
            ->chunk(500, function ($orders) use (&$rows) {
                foreach ($orders as $order) {
                    $rows[] = [
                        $order->id,
                        $order->operational_asset_id,
                        $order->defect,
                        $order->status,
                        $order->scheduled_at?->toIso8601String() ?? '',
                        $order->created_at?->toIso8601String() ?? '',
                    ];
                }
            });
    }

    /**
     * @param  list<string>  $headers
     * @param  list<list<mixed>>  $rows
     */
    private function generateCsvContent(array $headers, array $rows): string
    {
        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            return '';
        }

        fputcsv($handle, array_map([$this, 'sanitizeCsvValue'], $headers));

        foreach ($rows as $row) {
            fputcsv($handle, array_map([$this, 'sanitizeCsvValue'], $row));
        }

        rewind($handle);
        $content = stream_get_contents($handle);
        fclose($handle);

        return $content !== false ? $content : '';
    }

    private function sanitizeCsvValue(mixed $value): string
    {
        $str = (string) ($value ?? '');

        if ($str === '') {
            return '';
        }

        // Prevent CSV / Excel formula injection (CVE-2014-3524)
        $firstChar = substr($str, 0, 1);
        if (in_array($firstChar, ['=', '+', '-', '@', "\t", "\r"], true)) {
            return "'".$str;
        }

        return $str;
    }
}
