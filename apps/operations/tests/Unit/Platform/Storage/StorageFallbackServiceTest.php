<?php

declare(strict_types=1);

namespace Tests\Unit\Platform\Storage;

use App\Platform\Storage\Contracts\StorageFallbackServiceInterface;
use App\Platform\Storage\Facades\StorageFallback;
use App\Platform\Storage\Services\StorageFallbackService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

uses(TestCase::class);

test('isConfigured accurately evaluates disk readiness across local and s3 configurations', function () {
    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    // Non-existent disk
    expect($service->isConfigured('non_existent_disk_123'))->toBeFalse();

    // Standard local disks
    expect($service->isConfigured('local'))->toBeTrue()
        ->and($service->isConfigured('public'))->toBeTrue()
        ->and($service->isConfigured('private'))->toBeTrue();

    // Unconfigured R2 disk (default state in local development without .env credentials)
    Config::set('filesystems.disks.test_r2', [
        'driver' => 's3',
        'key' => '',
        'secret' => '',
        'bucket' => '',
        'endpoint' => '',
    ]);
    expect($service->isConfigured('test_r2'))->toBeFalse();

    // Missing R2 endpoint
    Config::set('filesystems.disks.test_r2', [
        'driver' => 's3',
        'key' => 'valid-key',
        'secret' => 'valid-secret',
        'bucket' => 'valid-bucket',
        'endpoint' => '',
    ]);
    expect($service->isConfigured('test_r2'))->toBeFalse();

    // Fully configured R2 disk
    Config::set('filesystems.disks.test_r2', [
        'driver' => 's3',
        'key' => 'valid-key',
        'secret' => 'valid-secret',
        'bucket' => 'valid-bucket',
        'endpoint' => 'https://account-id.r2.cloudflarestorage.com',
    ]);
    expect($service->isConfigured('test_r2'))->toBeTrue();

    // Storage::fake transforms disk into local driver, so it is considered configured
    Storage::fake('fake_disk');
    expect($service->isConfigured('fake_disk'))->toBeTrue();
});

test('resolveDisk returns desired disk when configured and falls back with structured logging when unconfigured', function () {
    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    // Desired disk is configured
    expect($service->resolveDisk('public', 'private'))->toBe('public');

    // Desired disk is unconfigured
    Config::set('filesystems.disks.unconfigured_cloud', [
        'driver' => 's3',
        'key' => null,
        'secret' => null,
        'bucket' => null,
    ]);

    Log::shouldReceive('info')
        ->once()
        ->with(
            'Storage disk [unconfigured_cloud] is unconfigured; falling back to [public].',
            [
                'desired_disk' => 'unconfigured_cloud',
                'fallback_disk' => 'public',
            ]
        );

    $service = app(StorageFallbackServiceInterface::class);
    $resolved = $service->resolveDisk('unconfigured_cloud', 'public');
    expect($resolved)->toBe('public');
});

test('safeExecute executes against fallback disk when desired disk is unconfigured', function () {
    Config::set('filesystems.disks.unconfigured_cloud', [
        'driver' => 's3',
        'key' => null,
    ]);

    Log::shouldReceive('info')
        ->once()
        ->with(
            'Storage disk [unconfigured_cloud] is unconfigured; falling back to [public].',
            \Mockery::any()
        );

    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    $executedOn = null;
    $result = $service->safeExecute('unconfigured_cloud', 'public', function (string $disk) use (&$executedOn) {
        $executedOn = $disk;

        return 'fallback-success';
    });

    expect($result)->toBe('fallback-success')
        ->and($executedOn)->toBe('public');
});

test('safeExecute executes against desired disk when configured and returns output', function () {
    Storage::fake('test_configured');

    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    $executedOn = null;
    $result = $service->safeExecute('test_configured', 'public', function (string $disk) use (&$executedOn) {
        $executedOn = $disk;

        return 'desired-success';
    });

    expect($result)->toBe('desired-success')
        ->and($executedOn)->toBe('test_configured');
});

test('safeExecute catches runtime exceptions on desired disk, logs warning, and executes fallback', function () {
    Storage::fake('failing_disk');

    Log::shouldReceive('warning')
        ->once()
        ->with(
            \Mockery::pattern('/Storage disk \[failing_disk\] unreachable or operation failed/'),
            \Mockery::subset([
                'desired_disk' => 'failing_disk',
                'fallback_disk' => 'public',
                'exception' => RuntimeException::class,
            ])
        );

    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    $executed = [];
    $result = $service->safeExecute('failing_disk', 'public', function (string $disk) use (&$executed) {
        $executed[] = $disk;
        if ($disk === 'failing_disk') {
            throw new RuntimeException('Connection timeout to cloud storage');
        }

        return 'fallback-after-error';
    });

    expect($result)->toBe('fallback-after-error')
        ->and($executed)->toBe(['failing_disk', 'public']);
});

test('safeExecute rethrows exception when desired and fallback disks are the same', function () {
    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    Storage::fake('sole_disk');

    expect(function () use ($service) {
        $service->safeExecute('sole_disk', 'sole_disk', function () {
            throw new RuntimeException('Fatal disk write error');
        });
    })->toThrow(RuntimeException::class, 'Fatal disk write error');
});

test('resolvePublicDisk and resolveProtectedDisk convenience methods resolve appropriately', function () {
    // Isolate test state: clear credentials to verify unconfigured fallback path
    Config::set('filesystems.disks.r2.key', '');
    Config::set('filesystems.disks.r2-public.key', '');
    Config::set('filesystems.disks.r2-private.key', '');
    Config::set('filesystems.dvir_disk', 'r2-public');
    Config::set('filesystems.protected_disk', 'r2-private');

    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    // In local dev without credentials, r2-public falls back to public
    expect($service->resolvePublicDisk())->toBe('public')
        ->and($service->resolveProtectedDisk())->toBe('private');

    // When r2-public is faked or configured, it resolves to r2-public
    Storage::fake('r2-public');
    expect($service->resolvePublicDisk('r2-public'))->toBe('r2-public');
});

test('StorageFallback facade delegates correctly to registered service', function () {
    expect(StorageFallback::isConfigured('local'))->toBeTrue()
        ->and(StorageFallback::isConfigured('non_existent_disk_xyz'))->toBeFalse();
});
