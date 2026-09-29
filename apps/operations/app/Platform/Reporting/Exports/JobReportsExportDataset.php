<?php

namespace App\Platform\Reporting\Exports;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Models\JobReport;
use Generator;

final class JobReportsExportDataset extends AbstractReportExportDataset
{
    public function type(): ReportExportType
    {
        return ReportExportType::JobReports;
    }

    public function authorize(User $actor): bool
    {
        return $actor->can(PermissionName::ReportsViewAll->value) || $actor->can(PermissionName::ReportsViewOwn->value);
    }

    public function headers(): array
    {
        return [
            'Report ID',
            'Dispatch Reference',
            'Job Title',
            'Author',
            'Status',
            'Started At',
            'Ended At',
            'Duration (Minutes)',
            'Ending Meter',
            'Meter Unit',
            'Client Sign-Off',
            'Signed At',
            'Attachments',
            'Resubmissions',
            'Submitted At',
            'Work Summary',
        ];
    }

    public function rows(User $actor, array $filters): Generator
    {
        $query = $this->applyDateFilters(
            JobReport::visibleTo($actor)->with(['job', 'author'])->withCount('attachments'),
            $filters,
        );

        $status = is_string($filters['status'] ?? null) ? JobReportStatus::tryFrom($filters['status']) : null;
        if ($status !== null) {
            $query->where('status', $status->value);
        }

        foreach ($query->orderBy('id')->lazyById(500) as $report) {
            $duration = $report->started_at !== null && $report->ended_at !== null && $report->ended_at->gte($report->started_at)
                ? (int) round($report->started_at->diffInMinutes($report->ended_at))
                : null;

            yield [
                $report->id,
                $report->job->reference,
                $report->job->title,
                $report->author?->name,
                $report->status->label(),
                $report->started_at?->toIso8601String(),
                $report->ended_at?->toIso8601String(),
                $duration,
                $report->ending_meter_value,
                match ($report->meter_type) {
                    'engine_hours' => 'hrs',
                    'odometer_km' => 'km',
                    default => null,
                },
                $report->signer_name,
                $report->signed_at?->toIso8601String(),
                (int) $report->attachments_count,
                (int) $report->resubmitted_count,
                $report->submitted_at?->toIso8601String(),
                $report->work_summary,
            ];
        }
    }
}
