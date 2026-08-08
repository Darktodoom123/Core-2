<?php

namespace App\Platform\Reporting\Exports;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportType;
use Generator;

final class DispatchesExportDataset extends AbstractReportExportDataset
{
    public function type(): ReportExportType
    {
        return ReportExportType::Dispatches;
    }

    public function authorize(User $actor): bool
    {
        return $actor->can(PermissionName::DispatchViewAll->value);
    }

    public function headers(): array
    {
        return ['Job ID', 'Reference Number', 'Title', 'Status', 'Priority', 'Scheduled Start', 'Scheduled End', 'Created At'];
    }

    public function rows(User $actor, array $filters): Generator
    {
        $query = $this->applyDateFilters(DispatchJob::visibleTo($actor), $filters);
        foreach ($query->orderBy('id')->lazyById(500) as $job) {
            yield [$job->id, $job->reference, $job->title, $job->status->value, $job->priority->value, $job->scheduled_start?->toIso8601String(), $job->scheduled_end?->toIso8601String(), $job->created_at?->toIso8601String()];
        }
    }
}
