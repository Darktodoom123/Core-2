<?php

namespace App\Modules\Fuel;

use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\Fuel\Policies\FuelLogPolicy;
use App\Modules\Fuel\Policies\FuelRequestPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class FuelServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(FuelRequest::class, FuelRequestPolicy::class);
        Gate::policy(FuelLog::class, FuelLogPolicy::class);
    }
}
