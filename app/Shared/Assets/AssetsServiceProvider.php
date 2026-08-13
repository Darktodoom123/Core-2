<?php

namespace App\Shared\Assets;

use App\Shared\Assets\Contracts\AssetUsageConflictChecker;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Policies\OperationalAssetPolicy;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class AssetsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->when(OperationalAssetAvailability::class)
            ->needs('$checkers')
            ->giveTagged(AssetUsageConflictChecker::TAG);
    }

    public function boot(): void
    {
        Gate::policy(OperationalAsset::class, OperationalAssetPolicy::class);
    }
}
