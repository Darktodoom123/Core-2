<?php

namespace App\Platform\Tracking;

use App\Platform\Tracking\Console\Commands\PruneLocationUpdatesCommand;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Services\DatabaseTrackingClient;
use App\Platform\Tracking\Services\HttpTrackingClient;
use App\Platform\Tracking\Testing\FakeTrackingClient;
use Illuminate\Support\ServiceProvider;
use InvalidArgumentException;

final class TrackingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(TrackingClientInterface::class, function ($app): TrackingClientInterface {
            $driver = config('services.tracking.driver');

            if ($driver === null || $driver === '') {
                $driver = $app->environment('testing') ? 'fake' : 'database';
            }

            return match ($driver) {
                'http' => $app->make(HttpTrackingClient::class),
                'database' => $app->make(DatabaseTrackingClient::class),
                'fake' => new FakeTrackingClient,
                default => throw new InvalidArgumentException(
                    "Invalid tracking driver [{$driver}]. Supported drivers are: http, database, fake."
                ),
            };
        });
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([
                PruneLocationUpdatesCommand::class,
            ]);
        }
    }
}
