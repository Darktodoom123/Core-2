<?php

namespace App\Platform\Tracking;

use App\Platform\Tracking\Console\Commands\PruneLocationUpdatesCommand;
use Illuminate\Support\ServiceProvider;

final class TrackingServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([
                PruneLocationUpdatesCommand::class,
            ]);
        }
    }
}
