<?php

declare(strict_types=1);

namespace Tests\Unit\Platform\Storage;

use Illuminate\Support\Facades\Config;
use Tests\TestCase;

uses(TestCase::class);

test('dual-tier R2 filesystem disks are properly configured in filesystems configuration', function () {
    $r2 = Config::get('filesystems.disks.r2');
    $r2Public = Config::get('filesystems.disks.r2-public');
    $r2Private = Config::get('filesystems.disks.r2-private');

    expect($r2)->toBeArray()
        ->and($r2['driver'])->toBe('s3')
        ->and($r2['visibility'])->toBe('public')
        ->and($r2['use_path_style_endpoint'])->toBeTrue();

    expect($r2Public)->toBeArray()
        ->and($r2Public['driver'])->toBe('s3')
        ->and($r2Public['visibility'])->toBe('public')
        ->and($r2Public['use_path_style_endpoint'])->toBeTrue();

    expect($r2Private)->toBeArray()
        ->and($r2Private['driver'])->toBe('s3')
        ->and($r2Private['visibility'])->toBe('private')
        ->and($r2Private['url'])->toBeNull()
        ->and($r2Private['use_path_style_endpoint'])->toBeTrue();
});

test('protected documents disk and dvir photo disk bindings are defined', function () {
    expect(Config::get('filesystems.protected_disk'))->toBe('r2-private')
        ->and(in_array(Config::get('filesystems.dvir_disk'), ['public', 'r2', 'r2-public'], true))->toBeTrue();
});

test('cors-r2.json contains valid S3 CORS specification for web and mobile origins', function () {
    $corsPath = config_path('cors-r2.json');

    expect(file_exists($corsPath))->toBeTrue();

    $corsContent = file_get_contents($corsPath);
    expect($corsContent)->not->toBeFalse();

    /** @var array<int, array<string, mixed>>|null $rules */
    $rules = json_decode((string) $corsContent, true);

    expect($rules)->toBeArray()->and(count($rules))->toBeGreaterThan(0);

    $rule = $rules[0];
    expect($rule)->toHaveKeys(['AllowedOrigins', 'AllowedMethods', 'AllowedHeaders', 'ExposeHeaders', 'MaxAgeSeconds']);

    $origins = $rule['AllowedOrigins'];
    expect($origins)->toContain('https://core-2.alibaton-ph.com')
        ->and($origins)->toContain('http://localhost:8000')
        ->and($origins)->toContain('http://localhost:5173')
        ->and($origins)->toContain('http://localhost:8081');

    $methods = $rule['AllowedMethods'];
    expect($methods)->toContain('GET')
        ->and($methods)->toContain('HEAD')
        ->and($methods)->toContain('PUT')
        ->and($methods)->toContain('OPTIONS');
});
