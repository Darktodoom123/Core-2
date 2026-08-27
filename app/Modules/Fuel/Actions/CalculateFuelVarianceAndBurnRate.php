<?php

namespace App\Modules\Fuel\Actions;

use App\Modules\Fuel\Enums\FuelBurnRateUnit;
use App\Modules\Fuel\Models\FuelRequest;
use App\Shared\Assets\Models\OperationalAsset;

final class CalculateFuelVarianceAndBurnRate
{
    public const float ANOMALY_VARIANCE_PERCENT_THRESHOLD = 15.0;

    public const float ANOMALY_BURN_RATE_EXCESS_RATIO = 0.15;

    public function execute(FuelRequest $request, float $actualLitres, ?int $newOdometer, ?float $newHours): FuelVarianceResult
    {
        $requestedLitres = (float) $request->quantity_litres;
        $varianceLitres = round($actualLitres - $requestedLitres, 2);
        $variancePercentage = $requestedLitres > 0
            ? round((($actualLitres - $requestedLitres) / $requestedLitres) * 100.0, 2)
            : 0.0;

        $effectiveBurnRate = null;
        $burnRateUnit = null;
        $reasons = [];

        /** @var OperationalAsset|null $asset */
        $asset = $request->asset;

        if ($asset !== null) {
            $isOdometer = in_array($asset->meter_type, ['odometer', 'odometer_km'], true);
            $isHourMeter = in_array($asset->meter_type, ['hour_meter', 'engine_hours'], true);

            if ($isOdometer) {
                $burnRateUnit = FuelBurnRateUnit::LitresPerKm->value;
                $previousMeter = $asset->meter_value !== null ? (float) $asset->meter_value : null;

                if ($newOdometer !== null && $previousMeter !== null && $newOdometer > $previousMeter) {
                    $deltaDistance = $newOdometer - $previousMeter;
                    if ($deltaDistance > 0) {
                        $effectiveBurnRate = round($actualLitres / $deltaDistance, 2);
                    }
                }
            } elseif ($isHourMeter) {
                $burnRateUnit = FuelBurnRateUnit::LitresPerHour->value;
                $previousMeter = $asset->meter_value !== null ? (float) $asset->meter_value : null;

                if ($newHours !== null && $previousMeter !== null && $newHours > $previousMeter) {
                    $deltaHours = $newHours - $previousMeter;
                    if ($deltaHours > 0) {
                        $effectiveBurnRate = round($actualLitres / $deltaHours, 2);
                    }
                }
            } elseif ($asset->burn_rate_unit !== null) {
                $burnRateUnit = $asset->burn_rate_unit;
            }
        }

        // Anomaly Evaluation 1: Quantity Variance exceeds threshold
        if ($variancePercentage >= self::ANOMALY_VARIANCE_PERCENT_THRESHOLD) {
            $reasons[] = sprintf(
                'Quantity variance (+%.1f%%) exceeds %d%% threshold (Requested: %.2f L, Actual: %.2f L)',
                $variancePercentage,
                (int) self::ANOMALY_VARIANCE_PERCENT_THRESHOLD,
                $requestedLitres,
                $actualLitres
            );
        }

        // Anomaly Evaluation 2: Effective Burn Rate exceeds Asset Baseline by threshold
        if ($effectiveBurnRate !== null && $asset !== null && $asset->baseline_burn_rate !== null) {
            $baseline = (float) $asset->baseline_burn_rate;
            if ($baseline > 0) {
                $burnRateExcessRatio = ($effectiveBurnRate - $baseline) / $baseline;
                if ($burnRateExcessRatio >= self::ANOMALY_BURN_RATE_EXCESS_RATIO) {
                    $excessPct = round($burnRateExcessRatio * 100.0, 1);
                    $unit = $burnRateUnit ?? 'units';
                    $reasons[] = sprintf(
                        'Effective burn rate (%.2f %s) exceeds baseline (%.2f %s) by +%.1f%%',
                        $effectiveBurnRate,
                        $unit,
                        $baseline,
                        $unit,
                        $excessPct
                    );
                }
            }
        }

        $isAnomaly = count($reasons) > 0;
        $anomalyReason = $isAnomaly ? implode(' | ', $reasons) : null;

        return new FuelVarianceResult(
            varianceLitres: $varianceLitres,
            variancePercentage: $variancePercentage,
            effectiveBurnRate: $effectiveBurnRate,
            burnRateUnit: $burnRateUnit,
            isAnomaly: $isAnomaly,
            anomalyReason: $anomalyReason,
        );
    }
}
