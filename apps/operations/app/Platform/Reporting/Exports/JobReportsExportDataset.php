<?php

namespace App\Platform\Reporting\Exports;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
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
        return ['Report ID', 'Dispatch Reference', 'Author', 'Status', 'Started At', 'Ended At', 'Work Summary', 'Submitted At'];
    }

    public function rows(User $actor, array $filters): Generator
    {
        $query = $this->applyDateFilters(JobReport::visibleTo($actor)->with(['job', 'author']), $filters);
        foreach ($query->orderBy('id')->lazyById(500) as $report) {
            yield [$report->id, $report->job->reference, $report->author->name, $report->status->value, $report->started_at?->toIso8601String(), $report->ended_at?->toIso8601String(), $report->work_summary, $report->submitted_at?->toIso8601String()];
        }
    }
}
