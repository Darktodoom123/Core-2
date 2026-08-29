<?php

namespace App\Platform\Reporting\Exports;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Models\JobReport;
use Generator;

final class DailyAccomplishmentExportDataset extends AbstractReportExportDataset
{
    public function type(): ReportExportType
    {
        return ReportExportType::DailyAccomplishment;
    }

    public function authorize(User $actor): bool
    {
        return $actor->can(PermissionName::ReportsViewAll->value)
            || $actor->can(PermissionName::ReportsViewOwn->value);
    }

    public function headers(): array
    {
        return [
            'Report ID',
            'Dispatch Reference',
            'Project Site',
            'Lead Foreman / Operator',
            'Operating Hours',
            'Work & Lift Accomplishment Summary',
            'Status',
            'Date Submitted',
        ];
    }

    public function rows(User $actor, array $filters): Generator
    {
        $query = $this->applyDateFilters(JobReport::visibleTo($actor)->with(['job', 'author']), $filters);

        /** @var JobReport $report */
        foreach ($query->orderByDesc('id')->lazyById(200) as $report) {
            $hours = 0;
            if ($report->started_at !== null && $report->ended_at !== null) {
                $hours = round($report->started_at->diffInMinutes($report->ended_at) / 60, 2);
            }

            yield [
                $report->id,
                $report->job->reference,
                $report->job->site ?? 'Metropolitan Manila',
                $report->author->name,
                $hours > 0 ? "{$hours} hrs" : 'Full Shift',
                $report->work_summary,
                strtoupper($report->status->value),
                $report->submitted_at?->toIso8601String() ?? $report->created_at?->toIso8601String(),
            ];
        }
    }
}
