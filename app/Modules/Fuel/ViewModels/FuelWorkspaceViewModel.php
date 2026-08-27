<?php

namespace App\Modules\Fuel\ViewModels;

use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use Illuminate\Support\Collection;

final class FuelWorkspaceViewModel
{
    /**
     * @param  Collection<int, FuelRequest>  $requests
     * @return array<int, array<string, mixed>>
     */
    public static function collection(Collection $requests): array
    {
        return $requests->map(static fn (FuelRequest $request): array => self::single($request))->values()->all();
    }

    /**
     * @return array<string, mixed>
     */
    public static function single(FuelRequest $request): array
    {
        return [
            'id' => (int) $request->getKey(),
            'reference' => $request->reference,
            'requester' => [
                'id' => (int) $request->requester->getKey(),
                'name' => $request->requester->name,
            ],
            'job' => $request->job === null ? null : [
                'id' => (int) $request->job->getKey(),
                'reference' => $request->job->reference,
                'title' => $request->job->title,
            ],
            'asset' => $request->asset === null ? null : [
                'id' => (int) $request->asset->getKey(),
                'code' => $request->asset->code,
                'name' => $request->asset->name,
                'meter_type' => $request->asset->meter_type,
                'meter_value' => $request->asset->meter_value !== null ? (string) $request->asset->meter_value : null,
                'baseline_burn_rate' => $request->asset->baseline_burn_rate !== null ? (string) $request->asset->baseline_burn_rate : null,
                'burn_rate_unit' => $request->asset->burn_rate_unit,
            ],
            'quantity_litres' => (string) $request->quantity_litres,
            'fuel_type' => $request->fuel_type,
            'purpose' => $request->purpose,
            'status' => [
                'value' => $request->status->value,
                'label' => $request->status->label(),
            ],
            'decision_reason' => $request->decision_reason,
            'reviewed_at' => $request->reviewed_at?->toIso8601String(),
            'approved_at' => $request->approved_at?->toIso8601String(),
            'verified_at' => $request->verified_at?->toIso8601String(),
            'logs' => $request->relationLoaded('logs')
                ? $request->logs->map(static fn (FuelLog $log): array => [
                    'id' => (int) $log->getKey(),
                    'quantity_litres' => (string) $log->quantity_litres,
                    'odometer_km' => $log->odometer_km,
                    'hour_meter' => $log->hour_meter !== null ? (string) $log->hour_meter : null,
                    'price_per_litre' => $log->price_per_litre !== null ? (string) $log->price_per_litre : null,
                    'total_cost' => $log->total_cost !== null ? (string) $log->total_cost : null,
                    'fuel_station' => $log->fuel_station,
                    'remarks' => $log->remarks,
                    'variance_litres' => $log->variance_litres !== null ? (string) $log->variance_litres : null,
                    'variance_percentage' => $log->variance_percentage !== null ? (string) $log->variance_percentage : null,
                    'effective_burn_rate' => $log->effective_burn_rate !== null ? (string) $log->effective_burn_rate : null,
                    'burn_rate_unit' => $log->burn_rate_unit,
                    'is_anomaly' => (bool) $log->is_anomaly,
                    'anomaly_reason' => $log->anomaly_reason,
                    'receipt_path' => $log->receipt_path,
                    'recorded_by' => $log->relationLoaded('recorder') ? [
                        'id' => (int) $log->recorder->getKey(),
                        'name' => $log->recorder->name,
                    ] : null,
                    'recorded_at' => $log->recorded_at?->toIso8601String(),
                ])->values()->all()
                : [],
        ];
    }
}
