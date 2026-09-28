<?php

namespace App\Platform\Geocoding\Jobs;

use App\Platform\Geocoding\Services\PlaceNameResolver;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;

final class ResolvePlaceNameJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    /** Provider failures are recorded and retried later by describe(). */
    public int $tries = 1;

    public int $timeout = 30;

    public function __construct(
        public readonly float $latitude,
        public readonly float $longitude,
    ) {}

    public function handle(PlaceNameResolver $resolver): void
    {
        $resolver->resolveNow($this->latitude, $this->longitude);
    }
}
