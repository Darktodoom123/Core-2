<?php

use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Services\DatabaseTrackingClient;
use App\Platform\Tracking\Services\HttpTrackingClient;
use App\Platform\Tracking\Testing\FakeTrackingClient;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

afterEach(function (): void {
    config(['services.tracking.driver' => 'fake']);
    app()->forgetInstance(TrackingClientInterface::class);
});

it('resolves FakeTrackingClient by default in testing environment when driver is not configured', function (): void {
    config(['services.tracking.driver' => null]);
    app()->forgetInstance(TrackingClientInterface::class);

    $client = app(TrackingClientInterface::class);

    expect($client)->toBeInstanceOf(FakeTrackingClient::class);
});

it('resolves FakeTrackingClient when driver is explicitly set to fake', function (): void {
    config(['services.tracking.driver' => 'fake']);
    app()->forgetInstance(TrackingClientInterface::class);

    $client = app(TrackingClientInterface::class);

    expect($client)->toBeInstanceOf(FakeTrackingClient::class);
});

it('resolves HttpTrackingClient when driver is set to http', function (): void {
    config([
        'services.tracking.driver' => 'http',
        'services.tracking.url' => 'http://localhost:8001',
    ]);
    app()->forgetInstance(TrackingClientInterface::class);

    $client = app(TrackingClientInterface::class);

    expect($client)->toBeInstanceOf(HttpTrackingClient::class);
});

it('resolves DatabaseTrackingClient when driver is set to database even if url is configured', function (): void {
    config([
        'services.tracking.driver' => 'database',
        'services.tracking.url' => 'http://localhost:8001', // URL must NOT override database driver
    ]);
    app()->forgetInstance(TrackingClientInterface::class);

    $client = app(TrackingClientInterface::class);

    expect($client)->toBeInstanceOf(DatabaseTrackingClient::class);
});

it('throws InvalidArgumentException when tracking driver is invalid', function (): void {
    config(['services.tracking.driver' => 'unsupported_driver']);
    app()->forgetInstance(TrackingClientInterface::class);

    expect(fn () => app(TrackingClientInterface::class))
        ->toThrow(InvalidArgumentException::class, 'Invalid tracking driver [unsupported_driver]. Supported drivers are: http, database, fake.');
});
