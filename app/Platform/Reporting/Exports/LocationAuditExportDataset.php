<?php

namespace App\Platform\Reporting\Exports;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Tracking\Models\LocationUpdate;
use Generator;

final class LocationAuditExportDataset extends AbstractReportExportDataset
{
    public function type(): ReportExportType
    {
        return ReportExportType::LocationAudit;
    }

    public function authorize(User $actor): bool
    {
        return $actor->can(PermissionName::TrackingViewAll->value);
    }

    public function headers(): array
    {
        return ['Update ID', 'User ID', 'Asset ID', 'Dispatch ID', 'Sharing Enabled', 'Captured At', 'Received At'];
    }

    public function rows(User $actor, array $filters): Generator
    {
        $query = $this->applyDateFilters(LocationUpdate::visibleTo($actor), $filters, 'captured_at');
        foreach ($query->orderBy('id')->lazyById(500) as $update) {
            yield [$update->id, $update->user_id, $update->operational_asset_id, $update->dispatch_job_id, $update->sharing_enabled ? 'yes' : 'no', $update->captured_at?->toIso8601String(), $update->received_at?->toIso8601String()];
        }
    }
}
