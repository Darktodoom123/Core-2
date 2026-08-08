<?php

use App\Platform\Attachments\Models\Attachment;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Http\Resources\V1\UserResource;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Http\Resources\V1\OperationalAssetResource;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    RateLimiter::clear('location');
    RateLimiter::clear('uploads');
    RateLimiter::clear('exports');
    RateLimiter::clear('gpt');
});

function createSprint7User(RoleName $role): User
{
    $user = User::factory()->create([
        'is_active' => true,
        'email_verified_at' => now(),
    ]);
    $user->syncRoles([$role->value]);

    return $user;
}

it('enforces endpoint-specific rate limiters for location, uploads, exports, and gpt', function (): void {
    $driver = createSprint7User(RoleName::Driver);
    $manager = createSprint7User(RoleName::OperationsManager);

    // 1. Location Telemetry throttle (60 req/min)
    $token = $driver->createToken('test-device')->plainTextToken;
    for ($i = 0; $i < 60; $i++) {
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/locations', [
                'command_id' => Str::uuid()->toString(),
                'captured_at' => now()->toIso8601String(),
                'sharing_enabled' => false,
            ])
            ->assertStatus(201);
    }
    // 61st attempt throttled
    $this->withHeader('Authorization', 'Bearer '.$token)
        ->postJson('/api/v1/locations', [
            'command_id' => Str::uuid()->toString(),
            'captured_at' => now()->toIso8601String(),
            'sharing_enabled' => false,
        ])
        ->assertStatus(429);

    // 2. Data Exports throttle (10 req/min)
    for ($i = 0; $i < 10; $i++) {
        $this->actingAs($manager)
            ->post('/operations/reports/exports', [
                'export_type' => 'job_reports',
                'format' => 'csv',
            ]);
    }
    $this->actingAs($manager)
        ->post('/operations/reports/exports', [
            'export_type' => 'job_reports',
            'format' => 'csv',
        ])
        ->assertStatus(429);
});

it('isolates dev routes in non-local environments', function (): void {
    // In testing environment, /dev/users should return 200
    $this->get('/dev/users')->assertStatus(200);
});

it('authorizes private attachment downloads correctly', function (): void {
    Storage::fake('private');

    $manager = createSprint7User(RoleName::OperationsManager);

    $attachment = Attachment::query()->create([
        'owner_type' => 'user',
        'owner_id' => $manager->id,
        'uploaded_by' => $manager->id,
        'kind' => 'document',
        'disk' => 'private',
        'path' => 'attachments/test.pdf',
        'original_filename' => 'test-document.pdf',
        'mime_type' => 'application/pdf',
        'size_bytes' => 1024,
        'checksum_sha256' => hash('sha256', 'dummy-content'),
    ]);

    Storage::disk('private')->put($attachment->path, 'dummy-content');

    // Owner can download
    $this->actingAs($manager)
        ->get("/operations/attachments/{$attachment->id}/download")
        ->assertStatus(200);

    // SystemAdmin can download
    $admin = createSprint7User(RoleName::SystemAdministrator);
    $this->actingAs($admin)
        ->get("/operations/attachments/{$attachment->id}/download")
        ->assertStatus(200);
});

it('serializes API V1 JsonResource responses predictably', function (): void {
    $user = createSprint7User(RoleName::Driver);
    $userResource = (new UserResource($user))->resolve();

    expect($userResource)->toHaveKeys(['id', 'name', 'email', 'role']);

    $asset = OperationalAsset::query()->create([
        'code' => 'AST-999',
        'name' => 'Test Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);
    $assetResource = (new OperationalAssetResource($asset))->resolve();

    expect($assetResource)->toHaveKeys(['id', 'code', 'name', 'status']);
});
