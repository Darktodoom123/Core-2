<?php

namespace App\Platform\Reporting\Exports;

use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportType;
use Generator;

final class FuelLogsExportDataset extends AbstractReportExportDataset
{
    public function type(): ReportExportType
    {
        return ReportExportType::FuelLogs;
    }

    public function authorize(User $actor): bool
    {
        return $actor->can(PermissionName::FuelViewAll->value);
    }

    public function headers(): array
    {
        return ['Log ID', 'Recorded By', 'Quantity (L)', 'Odometer (KM)', 'Hour Meter', 'Total Cost', 'Station', 'Recorded At'];
    }

    public function rows(User $actor, array $filters): Generator
    {
        $query = FuelLog::query()
            ->with('recorder')
            ->whereIn('fuel_request_id', FuelRequest::visibleTo($actor)->select('id'));
        $query = $this->applyDateFilters($query, $filters, 'recorded_at');
        foreach ($query->orderBy('id')->lazyById(500) as $log) {
            yield [$log->id, $log->recorder->name, $log->quantity_litres, $log->odometer_km, $log->hour_meter, $log->total_cost, $log->fuel_station, $log->recorded_at?->toIso8601String()];
        }
    }
}
