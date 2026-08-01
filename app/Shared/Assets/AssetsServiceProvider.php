<?php

namespace App\Shared\Assets;

use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Policies\OperationalAssetPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class AssetsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(OperationalAsset::class, OperationalAssetPolicy::class);
    }
}
