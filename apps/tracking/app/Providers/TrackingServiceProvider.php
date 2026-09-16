<?php

namespace Tracking\Providers;

use Illuminate\Support\ServiceProvider;
use Tracking\Console\Commands\ConsumeTelemetryStreamCommand;
use Tracking\Console\Commands\PruneLocationUpdatesCommand;

final class TrackingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([
                PruneLocationUpdatesCommand::class,
                ConsumeTelemetryStreamCommand::class,
            ]);
        }
    }
}
