<?php

namespace App\Modules\Sales;

use App\Modules\Sales\Services\SalesAssetUsageConflictChecker;
use App\Shared\Assets\Contracts\AssetUsageConflictChecker;
use Illuminate\Support\ServiceProvider;

final class SalesServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->tag(SalesAssetUsageConflictChecker::class, AssetUsageConflictChecker::TAG);
    }
}
