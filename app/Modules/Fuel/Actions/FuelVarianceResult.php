<?php

namespace App\Modules\Fuel\Actions;

final readonly class FuelVarianceResult
{
    public function __construct(
        public float $varianceLitres,
        public float $variancePercentage,
        public ?float $effectiveBurnRate,
        public ?string $burnRateUnit,
        public bool $isAnomaly,
        public ?string $anomalyReason,
    ) {}
}
