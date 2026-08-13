<?php

namespace App\Modules\Rental;

use App\Modules\Rental\Services\RentalAssetUsageConflictChecker;
use App\Shared\Assets\Contracts\AssetUsageConflictChecker;
use Illuminate\Support\ServiceProvider;

final class RentalServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->tag(RentalAssetUsageConflictChecker::class, AssetUsageConflictChecker::TAG);
    }
}
