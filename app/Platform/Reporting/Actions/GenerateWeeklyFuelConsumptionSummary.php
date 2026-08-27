<?php

namespace App\Platform\Reporting\Actions;

use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Carbon;

class GenerateWeeklyFuelConsumptionSummary
{
    /** @return array<string, mixed> */
    public function execute(User $user, ?Carbon $date = null): array
    {
        $targetDate = $date ?? now();
        $startOfWeek = $targetDate->copy()->startOfWeek();
        $endOfWeek = $targetDate->copy()->endOfWeek();

        $visibleRequestIds = FuelRequest::query()->visibleTo($user)->select('id');

        $logsQuery = FuelLog::query()
            ->with(['request.asset', 'request.job', 'recorder'])
            ->whereIn('fuel_request_id', $visibleRequestIds)
            ->whereBetween('recorded_at', [$startOfWeek, $endOfWeek]);

        $logs = $logsQuery->get();

        $totalLitresRequested = (float) FuelRequest::query()
            ->visibleTo($user)
            ->whereIn('id', $logs->pluck('fuel_request_id'))
            ->sum('quantity_litres');

        $totalLitresConsumed = 0.0;
        $totalSpend = 0.0;
        $anomaliesCount = 0;
        $anomaliesList = [];
        $assetStats = [];
        $jobStats = [];
        $fuelTypeStats = [];

        foreach ($logs as $log) {
            $qty = (float) $log->quantity_litres;
            $cost = $log->total_cost !== null ? (float) $log->total_cost : 0.0;
            $totalLitresConsumed += $qty;
            $totalSpend += $cost;

            if ($log->is_anomaly) {
                $anomaliesCount++;
                $anomaliesList[] = [
                    'log_id' => $log->id,
                    'reference' => $log->request->reference,
                    'asset_code' => $log->request->asset?->code,
                    'quantity_litres' => $qty,
                    'variance_litres' => $log->variance_litres !== null ? (float) $log->variance_litres : null,
                    'variance_percentage' => $log->variance_percentage !== null ? (float) $log->variance_percentage : null,
                    'effective_burn_rate' => $log->effective_burn_rate !== null ? (float) $log->effective_burn_rate : null,
                    'burn_rate_unit' => $log->burn_rate_unit,
                    'anomaly_reason' => $log->anomaly_reason,
                    'recorded_at' => $log->recorded_at?->toIso8601String(),
                ];
            }

            // Asset Breakdown
            $asset = $log->request->asset;
            $assetKey = $asset !== null ? (string) $asset->id : 'unassigned';
            if (! isset($assetStats[$assetKey])) {
                $assetStats[$assetKey] = [
                    'asset_id' => $asset?->id,
                    'asset_code' => $asset !== null ? $asset->code : 'N/A',
                    'asset_name' => $asset !== null ? $asset->name : 'Unassigned Equipment',
                    'total_litres' => 0.0,
                    'total_cost' => 0.0,
                    'burn_rates' => [],
                    'burn_rate_unit' => $asset?->burn_rate_unit,
                    'baseline_burn_rate' => $asset?->baseline_burn_rate !== null ? (float) $asset->baseline_burn_rate : null,
                    'anomaly_count' => 0,
                ];
            }
            $assetStats[$assetKey]['total_litres'] += $qty;
            $assetStats[$assetKey]['total_cost'] += $cost;
            if ($log->effective_burn_rate !== null) {
                $assetStats[$assetKey]['burn_rates'][] = (float) $log->effective_burn_rate;
            }
            if ($log->is_anomaly) {
                $assetStats[$assetKey]['anomaly_count']++;
            }

            // Job Breakdown
            $job = $log->request->job;
            if ($job !== null) {
                $jobKey = (string) $job->id;
                if (! isset($jobStats[$jobKey])) {
                    $jobStats[$jobKey] = [
                        'job_id' => $job->id,
                        'reference' => $job->reference,
                        'client' => $job->client,
                        'title' => $job->title,
                        'total_litres' => 0.0,
                        'total_cost' => 0.0,
                        'logs_count' => 0,
                    ];
                }
                $jobStats[$jobKey]['total_litres'] += $qty;
                $jobStats[$jobKey]['total_cost'] += $cost;
                $jobStats[$jobKey]['logs_count']++;
            }

            // Fuel Type Breakdown
            $fuelType = $log->request->fuel_type;
            if (! isset($fuelTypeStats[$fuelType])) {
                $fuelTypeStats[$fuelType] = [
                    'fuel_type' => $fuelType,
                    'total_litres' => 0.0,
                    'total_cost' => 0.0,
                    'logs_count' => 0,
                ];
            }
            $fuelTypeStats[$fuelType]['total_litres'] += $qty;
            $fuelTypeStats[$fuelType]['total_cost'] += $cost;
            $fuelTypeStats[$fuelType]['logs_count']++;
        }

        $formattedAssetBreakdown = array_values(array_map(static function (array $item): array {
            $rates = $item['burn_rates'];
            $avgBurnRate = count($rates) > 0 ? round(array_sum($rates) / count($rates), 2) : null;
            unset($item['burn_rates']);
            $item['average_burn_rate'] = $avgBurnRate;
            $item['total_litres'] = round($item['total_litres'], 2);
            $item['total_cost'] = round($item['total_cost'], 2);

            return $item;
        }, $assetStats));

        $netVarianceLitres = round($totalLitresConsumed - $totalLitresRequested, 2);
        $netVariancePercentage = $totalLitresRequested > 0
            ? round(($netVarianceLitres / $totalLitresRequested) * 100.0, 2)
            : 0.0;

        return [
            'week_starting' => $startOfWeek->toDateString(),
            'week_ending' => $endOfWeek->toDateString(),
            'summary' => [
                'total_litres_requested' => round($totalLitresRequested, 2),
                'total_litres_consumed' => round($totalLitresConsumed, 2),
                'net_variance_litres' => $netVarianceLitres,
                'net_variance_percentage' => $netVariancePercentage,
                'total_spend' => round($totalSpend, 2),
                'average_price_per_litre' => $totalLitresConsumed > 0 ? round($totalSpend / $totalLitresConsumed, 2) : null,
                'logs_count' => $logs->count(),
                'anomalies_count' => $anomaliesCount,
            ],
            'anomalies' => $anomaliesList,
            'by_asset' => $formattedAssetBreakdown,
            'by_job' => array_values($jobStats),
            'by_fuel_type' => array_values($fuelTypeStats),
        ];
    }
}
