<?php

namespace App\Platform\Reporting\Exports;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Generator;

final class MaintenanceLogsExportDataset extends AbstractReportExportDataset
{
    public function type(): ReportExportType
    {
        return ReportExportType::MaintenanceLogs;
    }

    public function authorize(User $actor): bool
    {
        return $actor->can(PermissionName::FleetViewAll->value);
    }

    public function headers(): array
    {
        return ['Work Order ID', 'Asset ID', 'Defect', 'Status', 'Scheduled At', 'Created At'];
    }

    public function rows(User $actor, array $filters): Generator
    {
        $query = MaintenanceWorkOrder::query()
            ->whereIn('operational_asset_id', OperationalAsset::visibleTo($actor)->select('id'));
        $query = $this->applyDateFilters($query, $filters);
        foreach ($query->orderBy('id')->lazyById(500) as $order) {
            yield [$order->id, $order->operational_asset_id, $order->defect, $order->status, $order->scheduled_at?->toIso8601String(), $order->created_at?->toIso8601String()];
        }
    }
}
