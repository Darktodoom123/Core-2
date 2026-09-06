<?php

declare(strict_types=1);

namespace Tests\Unit\Platform\Storage;

use App\Platform\Storage\Contracts\StorageFallbackServiceInterface;
use App\Platform\Storage\Services\StorageFallbackService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\TestCase;

uses(TestCase::class);

test('isConfigured handles missing, malformed, empty, and non-string configuration keys gracefully', function () {
    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    // 1. Non-existent disk config
    expect($service->isConfigured('unknown_disk_xyz'))->toBeFalse();

    // 2. Disk config is not an array or has missing/empty driver
    Config::set('filesystems.disks.invalid_1', null);
    Config::set('filesystems.disks.invalid_2', '');
    Config::set('filesystems.disks.invalid_3', ['driver' => '']);
    Config::set('filesystems.disks.invalid_4', ['driver' => null]);
    expect($service->isConfigured('invalid_1'))->toBeFalse()
        ->and($service->isConfigured('invalid_2'))->toBeFalse()
        ->and($service->isConfigured('invalid_3'))->toBeFalse()
        ->and($service->isConfigured('invalid_4'))->toBeFalse();

    // 3. Local driver with empty/null/whitespace root
    Config::set('filesystems.disks.local_empty_root', ['driver' => 'local', 'root' => '']);
    Config::set('filesystems.disks.local_null_root', ['driver' => 'local', 'root' => null]);
    Config::set('filesystems.disks.local_valid_root', ['driver' => 'local', 'root' => '/tmp/storage']);
    expect($service->isConfigured('local_empty_root'))->toBeFalse()
        ->and($service->isConfigured('local_null_root'))->toBeFalse()
        ->and($service->isConfigured('local_valid_root'))->toBeTrue();

    // 4. S3 driver with missing / null / empty / whitespace / non-string credentials
    $baseConfig = [
        'driver' => 's3',
        'key' => 'valid-key',
        'secret' => 'valid-secret',
        'bucket' => 'valid-bucket',
        'endpoint' => 'https://account.r2.cloudflarestorage.com',
    ];

    // Key boundaries
    Config::set('filesystems.disks.s3_null_key', array_merge($baseConfig, ['key' => null]));
    Config::set('filesystems.disks.s3_empty_key', array_merge($baseConfig, ['key' => '']));
    Config::set('filesystems.disks.s3_whitespace_key', array_merge($baseConfig, ['key' => "   \t\n "]));
    Config::set('filesystems.disks.s3_array_key', array_merge($baseConfig, ['key' => ['invalid']]));
    expect($service->isConfigured('s3_null_key'))->toBeFalse()
        ->and($service->isConfigured('s3_empty_key'))->toBeFalse()
        ->and($service->isConfigured('s3_whitespace_key'))->toBeFalse()
        ->and($service->isConfigured('s3_array_key'))->toBeFalse();

    // Secret boundaries
    Config::set('filesystems.disks.s3_null_secret', array_merge($baseConfig, ['secret' => null]));
    Config::set('filesystems.disks.s3_empty_secret', array_merge($baseConfig, ['secret' => '']));
    Config::set('filesystems.disks.s3_whitespace_secret', array_merge($baseConfig, ['secret' => '   ']));
    expect($service->isConfigured('s3_null_secret'))->toBeFalse()
        ->and($service->isConfigured('s3_empty_secret'))->toBeFalse()
        ->and($service->isConfigured('s3_whitespace_secret'))->toBeFalse();

    // Bucket boundaries
    Config::set('filesystems.disks.s3_null_bucket', array_merge($baseConfig, ['bucket' => null]));
    Config::set('filesystems.disks.s3_empty_bucket', array_merge($baseConfig, ['bucket' => '']));
    Config::set('filesystems.disks.s3_whitespace_bucket', array_merge($baseConfig, ['bucket' => '   ']));
    expect($service->isConfigured('s3_null_bucket'))->toBeFalse()
        ->and($service->isConfigured('s3_empty_bucket'))->toBeFalse()
        ->and($service->isConfigured('s3_whitespace_bucket'))->toBeFalse();

    // R2 endpoint boundaries (disks containing 'r2' require valid endpoint)
    Config::set('filesystems.disks.r2_test_no_endpoint', [
        'driver' => 's3',
        'key' => 'valid-key',
        'secret' => 'valid-secret',
        'bucket' => 'valid-bucket',
    ]);
    Config::set('filesystems.disks.r2_test_null_endpoint', array_merge($baseConfig, ['endpoint' => null]));
    Config::set('filesystems.disks.r2_test_empty_endpoint', array_merge($baseConfig, ['endpoint' => '']));
    Config::set('filesystems.disks.r2_test_whitespace_endpoint', array_merge($baseConfig, ['endpoint' => '   ']));
    Config::set('filesystems.disks.r2_test_valid', $baseConfig);

    expect($service->isConfigured('r2_test_no_endpoint'))->toBeFalse()
        ->and($service->isConfigured('r2_test_null_endpoint'))->toBeFalse()
        ->and($service->isConfigured('r2_test_empty_endpoint'))->toBeFalse()
        ->and($service->isConfigured('r2_test_whitespace_endpoint'))->toBeFalse()
        ->and($service->isConfigured('r2_test_valid'))->toBeTrue();
});

test('Storage::fake interactions across r2 and r2-private support independent isolation', function () {
    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    // Initial state: r2 and r2-private are not configured in local testing env
    Config::set('filesystems.disks.r2.key', null);
    Config::set('filesystems.disks.r2-private.key', null);

    // 1. Fake only r2
    Storage::fake('r2');
    expect($service->isConfigured('r2'))->toBeTrue()
        ->and($service->isConfigured('r2-private'))->toBeFalse();

    // Write file to fake r2
    Storage::disk('r2')->put('photos/walkaround_01.jpg', 'photo-binary-data');
    Storage::disk('r2')->assertExists('photos/walkaround_01.jpg');

    // 2. Fake r2-private as well
    Storage::fake('r2-private');
    expect($service->isConfigured('r2'))->toBeTrue()
        ->and($service->isConfigured('r2-private'))->toBeTrue();

    // Write file to fake r2-private
    Storage::disk('r2-private')->put('reports/signed_job_101.pdf', 'pdf-binary-data');
    Storage::disk('r2-private')->assertExists('reports/signed_job_101.pdf');

    // Assert strict isolation: r2 does not see r2-private files and vice-versa
    Storage::disk('r2')->assertMissing('reports/signed_job_101.pdf');
    Storage::disk('r2-private')->assertMissing('photos/walkaround_01.jpg');

    // 3. Verify resolvePublicDisk and resolveProtectedDisk honor the faked disks
    expect($service->resolvePublicDisk('r2'))->toBe('r2')
        ->and($service->resolveProtectedDisk('r2-private'))->toBe('r2-private');
});

test('multiple Storage::fake calls fake all tiers simultaneously', function () {
    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    Storage::fake('r2');
    Storage::fake('r2-public');
    Storage::fake('r2-private');

    expect($service->isConfigured('r2'))->toBeTrue()
        ->and($service->isConfigured('r2-public'))->toBeTrue()
        ->and($service->isConfigured('r2-private'))->toBeTrue();

    Storage::disk('r2-public')->put('thumb.jpg', 'thumb');
    Storage::disk('r2-private')->put('confidential.pdf', 'secret');

    Storage::disk('r2-public')->assertExists('thumb.jpg');
    Storage::disk('r2-private')->assertExists('confidential.pdf');
    Storage::disk('r2-public')->assertMissing('confidential.pdf');
});

test('safeExecute handles exceptions in operation callback and escalates to fallback disk', function () {
    Storage::fake('desired_disk');
    Storage::fake('fallback_disk');

    Log::shouldReceive('warning')
        ->once()
        ->with(
            \Mockery::pattern('/Storage disk \[desired_disk\] unreachable or operation failed/'),
            \Mockery::on(function ($context) {
                return $context['desired_disk'] === 'desired_disk'
                    && $context['fallback_disk'] === 'fallback_disk'
                    && $context['exception'] === RuntimeException::class
                    && str_contains($context['message'], 'Simulated S3 connection timeout');
            })
        );

    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    $attemptCount = 0;
    $result = $service->safeExecute('desired_disk', 'fallback_disk', function (string $disk) use (&$attemptCount) {
        $attemptCount++;
        if ($disk === 'desired_disk') {
            throw new RuntimeException('Simulated S3 connection timeout (504)');
        }

        return "saved_on_{$disk}";
    });

    expect($result)->toBe('saved_on_fallback_disk')
        ->and($attemptCount)->toBe(2);
});

test('safeExecute catches and escalates TypeErrors and PHP Engine errors from desired disk to fallback', function () {
    Storage::fake('desired_disk');
    Storage::fake('fallback_disk');

    Log::shouldReceive('warning')
        ->once()
        ->with(
            \Mockery::pattern('/Storage disk \[desired_disk\] unreachable or operation failed/'),
            \Mockery::subset([
                'desired_disk' => 'desired_disk',
                'fallback_disk' => 'fallback_disk',
                'exception' => \Error::class,
            ])
        );

    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    $result = $service->safeExecute('desired_disk', 'fallback_disk', function (string $disk) {
        if ($disk === 'desired_disk') {
            // Deliberate type error
            /** @var callable $badCall */
            $badCall = 'not_a_callable';
            $badCall(1, 2);
        }

        return 'recovered_on_fallback';
    });

    expect($result)->toBe('recovered_on_fallback');
});

test('safeExecute rethrows immediately when fallback disk itself throws an exception', function () {
    // Scenario A: Desired disk is unconfigured, so fallback disk is called immediately, and fallback throws
    Config::set('filesystems.disks.unconfigured_cloud', [
        'driver' => 's3',
        'key' => null,
    ]);
    Storage::fake('fallback_disk');

    Log::shouldReceive('info')
        ->once()
        ->with(
            'Storage disk [unconfigured_cloud] is unconfigured; falling back to [fallback_disk].',
            \Mockery::any()
        );

    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    expect(function () use ($service) {
        $service->safeExecute('unconfigured_cloud', 'fallback_disk', function (string $disk) {
            expect($disk)->toBe('fallback_disk');
            throw new RuntimeException('Disk full error on fallback storage');
        });
    })->toThrow(RuntimeException::class, 'Disk full error on fallback storage');
});

test('safeExecute rethrows when desired disk fails and fallback disk ALSO fails', function () {
    // Scenario B: Desired disk throws, fallback is attempted, fallback also throws
    Storage::fake('desired_disk');
    Storage::fake('fallback_disk');

    Log::shouldReceive('warning')
        ->once()
        ->with(
            \Mockery::pattern('/Storage disk \[desired_disk\] unreachable or operation failed/'),
            \Mockery::any()
        );

    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    expect(function () use ($service) {
        $service->safeExecute('desired_disk', 'fallback_disk', function (string $disk) {
            if ($disk === 'desired_disk') {
                throw new RuntimeException('Cloud S3 unreachable');
            }

            throw new RuntimeException('Local filesystem permission denied on fallback');
        });
    })->toThrow(RuntimeException::class, 'Local filesystem permission denied on fallback');
});

test('safeExecute preserves return types including null, array, and object', function () {
    Storage::fake('test_disk');
    Storage::fake('fallback_disk');

    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    // Null return
    $nullResult = $service->safeExecute('test_disk', 'fallback_disk', fn () => null);
    expect($nullResult)->toBeNull();

    // Array return
    $arrayResult = $service->safeExecute('test_disk', 'fallback_disk', fn () => ['file_id' => '123', 'bytes' => 4096]);
    expect($arrayResult)->toBe(['file_id' => '123', 'bytes' => 4096]);

    // Object return
    $objResult = $service->safeExecute('test_disk', 'fallback_disk', fn () => (object) ['status' => 'uploaded']);
    expect($objResult)->toEqual((object) ['status' => 'uploaded']);
});

test('disk lifecycle correctly transitions between configured and unconfigured with Storage::fake and Storage::purge', function () {
    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    Config::set('filesystems.disks.r2.key', null);

    // Initial state: unconfigured
    expect($service->isConfigured('r2'))->toBeFalse();

    // After fake: configured
    Storage::fake('r2');
    expect($service->isConfigured('r2'))->toBeTrue();

    // After purge: returns to unconfigured state
    Storage::purge('r2');
    expect($service->isConfigured('r2'))->toBeFalse();
});

test('standard S3 disks with declared null endpoint evaluate to false due to array_key_exists check', function () {
    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    // Standard AWS S3 without 'endpoint' key present in array
    Config::set('filesystems.disks.aws_no_endpoint_key', [
        'driver' => 's3',
        'key' => 'AKIAIOSFODNN7EXAMPLE',
        'secret' => 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'bucket' => 'my-bucket',
    ]);
    expect($service->isConfigured('aws_no_endpoint_key'))->toBeTrue();

    // Standard Laravel filesystems.php includes 'endpoint' => env('AWS_ENDPOINT') which resolves to null.
    // array_key_exists('endpoint', $config) is true, triggering endpoint validation and evaluating to false.
    Config::set('filesystems.disks.aws_with_null_endpoint', [
        'driver' => 's3',
        'key' => 'AKIAIOSFODNN7EXAMPLE',
        'secret' => 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'bucket' => 'my-bucket',
        'endpoint' => null,
    ]);
    expect($service->isConfigured('aws_with_null_endpoint'))->toBeFalse();
});

test('safeExecute fallback re-executes callable causing side effects to execute twice when desired disk fails', function () {
    Storage::fake('desired_failing_disk');
    Storage::fake('fallback_working_disk');

    Log::shouldReceive('warning')->once();

    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    $sideEffectCounter = 0;
    $result = $service->safeExecute('desired_failing_disk', 'fallback_working_disk', function (string $disk) use (&$sideEffectCounter) {
        $sideEffectCounter++;
        if ($disk === 'desired_failing_disk') {
            throw new RuntimeException('Disk failure');
        }

        return 'success';
    });

    expect($result)->toBe('success')
        ->and($sideEffectCounter)->toBe(2);
});

test('resolveDisk with empty or nonexistent disks returns fallback disk and logs info', function () {
    Log::shouldReceive('info')
        ->once()
        ->with(
            'Storage disk [] is unconfigured; falling back to [local].',
            ['desired_disk' => '', 'fallback_disk' => 'local']
        );

    /** @var StorageFallbackService $service */
    $service = app(StorageFallbackServiceInterface::class);

    expect($service->resolveDisk('', 'local'))->toBe('local');
});
