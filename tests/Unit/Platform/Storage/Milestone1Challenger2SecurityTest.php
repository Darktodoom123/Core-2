<?php

declare(strict_types=1);

namespace Tests\Unit\Platform\Storage;

use App\Platform\Storage\Contracts\StorageFallbackServiceInterface;
use Illuminate\Support\Env;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

uses(TestCase::class);

describe('Adversarial Verification: Cloudflare R2 CORS Specification (config/cors-r2.json)', function () {
    test('cors-r2.json exists, is valid JSON, and adheres to S3 CORS structure', function () {
        $corsPath = config_path('cors-r2.json');
        expect(file_exists($corsPath))->toBeTrue("Expected config/cors-r2.json to exist at {$corsPath}");

        $content = file_get_contents($corsPath);
        expect($content)->not->toBeFalse();

        /** @var array<int, array<string, mixed>> $rules */
        $rules = json_decode((string) $content, true, 512, JSON_THROW_ON_ERROR);

        expect($rules)->toBeArray()
            ->and(count($rules))->toBeGreaterThanOrEqual(1);

        $rule = $rules[0];
        expect($rule)->toHaveKeys([
            'AllowedOrigins',
            'AllowedMethods',
            'AllowedHeaders',
            'ExposeHeaders',
            'MaxAgeSeconds',
        ]);
    });

    test('CORS AllowedOrigins strictly covers web portal, subdomains, and mobile clients without wildcard origin', function () {
        $corsPath = config_path('cors-r2.json');
        /** @var array<int, array<string, mixed>> $rules */
        $rules = json_decode((string) file_get_contents($corsPath), true, 512, JSON_THROW_ON_ERROR);
        $origins = $rules[0]['AllowedOrigins'];

        // Must NOT allow universal origin '*' which would compromise authenticated cross-origin calls
        expect($origins)->not->toContain('*');

        // Web production and preview domains
        expect($origins)->toContain('https://core-2.alibaton-ph.com')
            ->and($origins)->toContain('https://*.alibaton-ph.com');

        // Web development servers
        expect($origins)->toContain('http://localhost:8000')
            ->and($origins)->toContain('http://localhost:5173')
            ->and($origins)->toContain('http://127.0.0.1:8000');

        // Mobile packager / Metro bundler
        expect($origins)->toContain('http://localhost:8081');

        // Every origin must be well-formed URI schema
        foreach ($origins as $origin) {
            expect($origin)->toMatch('/^https?:\/\//');
        }
    });

    test('CORS AllowedMethods permits GET, HEAD, PUT, OPTIONS but restricts unauthorized mutation methods', function () {
        $corsPath = config_path('cors-r2.json');
        /** @var array<int, array<string, mixed>> $rules */
        $rules = json_decode((string) file_get_contents($corsPath), true, 512, JSON_THROW_ON_ERROR);
        $methods = $rules[0]['AllowedMethods'];

        // Required methods for download, metadata check, direct upload, and preflight
        expect($methods)->toContain('GET')
            ->and($methods)->toContain('HEAD')
            ->and($methods)->toContain('PUT')
            ->and($methods)->toContain('OPTIONS');

        // Dangerous direct mutation methods must NOT be in client CORS (deletion handled via Laravel API)
        expect($methods)->not->toContain('DELETE')
            ->and($methods)->not->toContain('*');
    });

    test('CORS AllowedHeaders and ExposeHeaders include essential S3 and streaming metadata headers', function () {
        $corsPath = config_path('cors-r2.json');
        /** @var array<int, array<string, mixed>> $rules */
        $rules = json_decode((string) file_get_contents($corsPath), true, 512, JSON_THROW_ON_ERROR);
        $rule = $rules[0];

        $headers = $rule['AllowedHeaders'];
        expect($headers)->toContain('Authorization')
            ->and($headers)->toContain('Content-Type')
            ->and($headers)->toContain('Content-MD5')
            ->and($headers)->toContain('x-amz-content-sha256')
            ->and($headers)->toContain('x-amz-date')
            ->and($headers)->toContain('x-amz-user-agent')
            ->and($headers)->toContain('Range')
            ->and($headers)->toContain('*');

        $expose = $rule['ExposeHeaders'];
        expect($expose)->toContain('ETag')
            ->and($expose)->toContain('Content-Length')
            ->and($expose)->toContain('Content-Range')
            ->and($expose)->toContain('x-amz-request-id');

        expect($rule['MaxAgeSeconds'])->toBe(3600);
    });
});

describe('Adversarial Verification: Disk Isolation & Public URL Leakage Prevention', function () {
    test('r2-private strictly prevents public URL exposure with null url config', function () {
        $privateDisk = Config::get('filesystems.disks.r2-private');

        expect($privateDisk)->toBeArray()
            ->and($privateDisk['visibility'])->toBe('private')
            ->and($privateDisk['url'])->toBeNull();
    });

    test('r2-private never inherits public CDN domain even when R2_PUBLIC_URL is populated', function () {
        // Load filesystems configuration dynamically simulating populated public URL environment
        $configPath = config_path('filesystems.php');
        $repo = Env::getRepository();

        $repo->set('R2_PUBLIC_URL', 'https://public-cdn.alibaton-ph.com');
        $repo->set('R2_URL', 'https://fallback-cdn.alibaton-ph.com');

        $simulatedConfig = require $configPath;

        // r2 and r2-public should adopt the public CDN URL
        expect($simulatedConfig['disks']['r2']['url'])->toBe('https://public-cdn.alibaton-ph.com')
            ->and($simulatedConfig['disks']['r2-public']['url'])->toBe('https://public-cdn.alibaton-ph.com');

        // r2-private MUST remain strictly null
        expect($simulatedConfig['disks']['r2-private']['url'])->toBeNull();

        // Clean up environment variables
        $repo->clear('R2_PUBLIC_URL');
        $repo->clear('R2_URL');
    });

    test('protected_disk defaults to r2-private and dvir_disk defaults to public or configured disk', function () {
        expect(Config::get('filesystems.protected_disk'))->toBe('r2-private')
            ->and(in_array(Config::get('filesystems.dvir_disk'), ['public', 'r2', 'r2-public'], true))->toBeTrue();
    });

    test('StorageFallbackService safely routes protected documents to private disk when r2-private is unconfigured', function () {
        // Isolate test state: clear credentials to verify unconfigured fallback path
        Config::set('filesystems.disks.r2.key', '');
        Config::set('filesystems.disks.r2-public.key', '');
        Config::set('filesystems.disks.r2-private.key', '');
        Config::set('filesystems.dvir_disk', 'r2-public');
        Config::set('filesystems.protected_disk', 'r2-private');

        /** @var StorageFallbackServiceInterface $fallbackService */
        $fallbackService = app(StorageFallbackServiceInterface::class);

        // When unconfigured without cloud credentials, r2-private is unconfigured
        expect($fallbackService->isConfigured('r2-private'))->toBeFalse()
            ->and($fallbackService->resolveProtectedDisk())->toBe('private')
            ->and($fallbackService->resolvePublicDisk())->toBe('public');
    });
});

describe('Adversarial Verification: use_path_style_endpoint Strict Boolean Evaluation', function () {
    test('use_path_style_endpoint evaluates to strict boolean true on all R2 disks', function () {
        $r2 = Config::get('filesystems.disks.r2.use_path_style_endpoint');
        $r2Public = Config::get('filesystems.disks.r2-public.use_path_style_endpoint');
        $r2Private = Config::get('filesystems.disks.r2-private.use_path_style_endpoint');

        // Assert strictly boolean true (not string "true", not 1, not truthy)
        expect($r2)->toBeTrue()
            ->and(is_bool($r2))->toBeTrue()
            ->and($r2Public)->toBeTrue()
            ->and(is_bool($r2Public))->toBeTrue()
            ->and($r2Private)->toBeTrue()
            ->and(is_bool($r2Private))->toBeTrue();
    });

    test('use_path_style_endpoint defaults to boolean true when environment variables are omitted', function () {
        $configPath = config_path('filesystems.php');
        $repo = Env::getRepository();

        $originalUsePath = env('R2_USE_PATH_STYLE_ENDPOINT');
        $originalPrivateUsePath = env('R2_PRIVATE_USE_PATH_STYLE_ENDPOINT');

        $repo->clear('R2_USE_PATH_STYLE_ENDPOINT');
        $repo->clear('R2_PRIVATE_USE_PATH_STYLE_ENDPOINT');

        $cleanConfig = require $configPath;

        expect($cleanConfig['disks']['r2']['use_path_style_endpoint'])->toBeTrue()
            ->and(is_bool($cleanConfig['disks']['r2']['use_path_style_endpoint']))->toBeTrue()
            ->and($cleanConfig['disks']['r2-public']['use_path_style_endpoint'])->toBeTrue()
            ->and(is_bool($cleanConfig['disks']['r2-public']['use_path_style_endpoint']))->toBeTrue()
            ->and($cleanConfig['disks']['r2-private']['use_path_style_endpoint'])->toBeTrue()
            ->and(is_bool($cleanConfig['disks']['r2-private']['use_path_style_endpoint']))->toBeTrue();

        // Contrast with AWS S3 default which remains false
        expect($cleanConfig['disks']['s3']['use_path_style_endpoint'])->toBeFalse();

        // Restore environment
        if ($originalUsePath !== null) {
            $repo->set('R2_USE_PATH_STYLE_ENDPOINT', (string) $originalUsePath);
        }
        if ($originalPrivateUsePath !== null) {
            $repo->set('R2_PRIVATE_USE_PATH_STYLE_ENDPOINT', (string) $originalPrivateUsePath);
        }
    });

    test('r2-private inherits R2_USE_PATH_STYLE_ENDPOINT when R2_PRIVATE_USE_PATH_STYLE_ENDPOINT is not set', function () {
        $configPath = config_path('filesystems.php');
        $repo = Env::getRepository();

        $originalUsePath = env('R2_USE_PATH_STYLE_ENDPOINT');
        $originalPrivateUsePath = env('R2_PRIVATE_USE_PATH_STYLE_ENDPOINT');

        $repo->set('R2_USE_PATH_STYLE_ENDPOINT', 'true');
        $repo->clear('R2_PRIVATE_USE_PATH_STYLE_ENDPOINT');

        $inheritedConfig = require $configPath;

        expect($inheritedConfig['disks']['r2-private']['use_path_style_endpoint'])->toBeTrue()
            ->and(is_bool($inheritedConfig['disks']['r2-private']['use_path_style_endpoint']))->toBeTrue();

        // Restore clean environment
        if ($originalUsePath !== null) {
            $repo->set('R2_USE_PATH_STYLE_ENDPOINT', (string) $originalUsePath);
        } else {
            $repo->clear('R2_USE_PATH_STYLE_ENDPOINT');
        }
        if ($originalPrivateUsePath !== null) {
            $repo->set('R2_PRIVATE_USE_PATH_STYLE_ENDPOINT', (string) $originalPrivateUsePath);
        }
    });
});

describe('Adversarial Verification: Runtime URL Generation & Pre-signed Request Security', function () {
    test('r2-private generates valid AWS SigV4 pre-signed temporary URLs with path-style endpoint', function () {
        Config::set('filesystems.disks.r2-private-test', [
            'driver' => 's3',
            'key' => 'mock-access-key-id',
            'secret' => 'mock-secret-access-key-0123456789',
            'region' => 'auto',
            'bucket' => 'mock-compliance-bucket',
            'url' => null,
            'endpoint' => 'https://mock-account.r2.cloudflarestorage.com',
            'use_path_style_endpoint' => true,
            'visibility' => 'private',
            'throw' => false,
            'report' => false,
        ]);

        $disk = Storage::disk('r2-private-test');
        $expiresAt = now()->addMinutes(15);

        $temporaryUrl = $disk->temporaryUrl('inspections/dvir-001-compliance.pdf', $expiresAt);

        // Verify URL uses path-style addressing: endpoint / bucket / key
        expect($temporaryUrl)->toStartWith('https://mock-account.r2.cloudflarestorage.com/mock-compliance-bucket/inspections/dvir-001-compliance.pdf')
            // Verify AWS SigV4 query parameters
            ->and($temporaryUrl)->toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256')
            ->and($temporaryUrl)->toContain('X-Amz-Credential=mock-access-key-id')
            ->and($temporaryUrl)->toContain('X-Amz-Signature=')
            ->and($temporaryUrl)->toMatch('/X-Amz-Expires=(899|900)/');
    });

    test('r2-private url() strictly uses S3 endpoint path and never leaks public CDN base', function () {
        Config::set('filesystems.disks.r2-public-test', [
            'driver' => 's3',
            'key' => 'mock-access-key-id',
            'secret' => 'mock-secret-access-key-0123456789',
            'region' => 'auto',
            'bucket' => 'mock-public-photos',
            'url' => 'https://media-cdn.alibaton-ph.com',
            'endpoint' => 'https://mock-account.r2.cloudflarestorage.com',
            'use_path_style_endpoint' => true,
            'visibility' => 'public',
        ]);

        Config::set('filesystems.disks.r2-private-test', [
            'driver' => 's3',
            'key' => 'mock-access-key-id',
            'secret' => 'mock-secret-access-key-0123456789',
            'region' => 'auto',
            'bucket' => 'mock-compliance-bucket',
            'url' => null,
            'endpoint' => 'https://mock-account.r2.cloudflarestorage.com',
            'use_path_style_endpoint' => true,
            'visibility' => 'private',
        ]);

        $publicDisk = Storage::disk('r2-public-test');
        $privateDisk = Storage::disk('r2-private-test');

        $publicUrl = $publicDisk->url('photos/inspection-123.jpg');
        $privateUrl = $privateDisk->url('reports/job-completion-456.pdf');

        // Public disk URL resolves to public CDN domain
        expect($publicUrl)->toBe('https://media-cdn.alibaton-ph.com/photos/inspection-123.jpg');

        // Private disk URL must NOT use public CDN domain; it resolves to raw S3 authenticated gateway
        expect($privateUrl)->not->toContain('media-cdn.alibaton-ph.com')
            ->and($privateUrl)->toBe('https://mock-account.r2.cloudflarestorage.com/mock-compliance-bucket/reports/job-completion-456.pdf');
    });

    test('local fallback private disk is isolated outside of public web root', function () {
        $privateRoot = Config::get('filesystems.disks.private.root');
        $publicRoot = Config::get('filesystems.disks.public.root');

        expect($privateRoot)->toBe(storage_path('app/private'))
            ->and($publicRoot)->toBe(storage_path('app/public'))
            ->and($privateRoot)->not->toBe($publicRoot);
    });
});
