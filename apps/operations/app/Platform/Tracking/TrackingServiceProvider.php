<?php

namespace App\Platform\Tracking;

use App\Platform\Tracking\Console\Commands\PruneLocationUpdatesCommand;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Services\DatabaseTrackingClient;
use App\Platform\Tracking\Services\HttpTrackingClient;
use App\Platform\Tracking\Services\RedisStreamTrackingClient;
use App\Platform\Tracking\Testing\FakeTrackingClient;
use Illuminate\Support\ServiceProvider;

final class TrackingServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(TrackingClientInterface::class, function ($app): TrackingClientInterface {
            $driver = config('services.tracking.driver');
            $url = config('services.tracking.url');

            if ($driver === 'stream') {
                return $app->make(RedisStreamTrackingClient::class);
            }

            if ($driver === 'http') {
                return $app->make(HttpTrackingClient::class);
            }

            if ($app->environment('testing')) {
                return new FakeTrackingClient;
            }

            if (! empty($url)) {
                return $app->make(HttpTrackingClient::class);
            }

            return new DatabaseTrackingClient;
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
