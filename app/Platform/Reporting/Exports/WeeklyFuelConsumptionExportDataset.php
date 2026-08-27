<?php

namespace App\Platform\Reporting\Exports;

use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportType;
use Generator;

final class WeeklyFuelConsumptionExportDataset extends AbstractReportExportDataset
{
    public function type(): ReportExportType
    {
        return ReportExportType::WeeklyFuelConsumption;
    }

    public function authorize(User $actor): bool
    {
        return $actor->can(PermissionName::FuelReport->value) || $actor->can(PermissionName::FuelViewAll->value);
    }

    public function headers(): array
    {
        return [
            'Log ID',
            'Week Range',
            'Asset Code',
            'Asset Name',
            'Job Reference',
            'Fuel Type',
            'Quantity Requested (L)',
            'Quantity Actual (L)',
            'Variance (L)',
            'Variance (%)',
            'Total Cost',
            'Effective Burn Rate',
            'Burn Rate Unit',
            'Baseline Burn Rate',
            'Is Anomaly',
            'Anomaly Diagnostic',
            'Station',
            'Recorded By',
            'Recorded At',
        ];
    }

    public function rows(User $actor, array $filters): Generator
    {
        $query = FuelLog::query()
            ->with(['request.asset', 'request.job', 'recorder'])
            ->whereIn('fuel_request_id', FuelRequest::visibleTo($actor)->select('id'));

        $query = $this->applyDateFilters($query, $filters, 'recorded_at');

        /** @var FuelLog $log */
        foreach ($query->orderBy('id')->lazyById(500) as $log) {
            $recordedAt = $log->recorded_at;
            $weekRange = $recordedAt
                ? $recordedAt->copy()->startOfWeek()->format('Y-m-d').' to '.$recordedAt->copy()->endOfWeek()->format('Y-m-d')
                : 'N/A';

            $asset = $log->request->asset;
            $job = $log->request->job;

            yield [
                $log->id,
                $weekRange,
                $asset !== null ? $asset->code : 'N/A',
                $asset !== null ? $asset->name : 'N/A',
                $job !== null ? $job->reference : 'N/A',
                $log->request->fuel_type,
                $log->request->quantity_litres,
                $log->quantity_litres,
                $log->variance_litres ?? '0.00',
                $log->variance_percentage !== null ? $log->variance_percentage.'%' : '0.00%',
                $log->total_cost !== null ? '$'.$log->total_cost : 'N/A',
                $log->effective_burn_rate ?? 'N/A',
                $log->burn_rate_unit ?? 'N/A',
                $asset !== null && $asset->baseline_burn_rate !== null ? (string) $asset->baseline_burn_rate : 'N/A',
                $log->is_anomaly ? 'YES' : 'NO',
                $log->anomaly_reason ?? 'None',
                $log->fuel_station ?? 'N/A',
                $log->recorder->name,
                $recordedAt?->toIso8601String(),
            ];
        }
    }
}
