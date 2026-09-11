<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    RateLimiter::clear('api');
    RateLimiter::clear('login');
    RateLimiter::clear('password-reset');
    RateLimiter::clear('safety');
    RateLimiter::clear('weather');
    RateLimiter::clear('downloads');
    RateLimiter::clear('uploads');
    RateLimiter::clear('location');
});

it('throttles mobile api login by ip after 10 attempts even with different usernames', function (): void {
    for ($i = 0; $i < 10; $i++) {
        $this->postJson('/api/v1/auth/login', [
            'username' => "testuser{$i}",
            'password' => 'wrong-password',
        ])->assertStatus(422);
    }

    $response = $this->postJson('/api/v1/auth/login', [
        'username' => 'anotheruser',
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(429);
    $response->assertJson([
        'error' => 'rate_limited',
    ]);
    expect($response->headers->has('Retry-After'))->toBeTrue();
    expect($response->json('retry_after'))->toBeGreaterThan(0);
});

it('throttles mobile api login for same username after 5 attempts', function (): void {
    User::factory()->create(['username' => 'targetuser']);

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/auth/login', [
            'username' => 'targetuser',
            'password' => 'wrong-password',
        ])->assertStatus(422);
    }

    $response = $this->postJson('/api/v1/auth/login', [
        'username' => 'targetuser',
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(429);
});

it('throttles web login after 10 attempts from the same ip', function (): void {
    for ($i = 0; $i < 10; $i++) {
        $this->post('/login', [
            'username' => "webuser{$i}",
            'password' => 'wrong-password',
        ]);
    }

    $response = $this->post('/login', [
        'username' => 'yet-another-user',
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(429);
});

it('throttles password reset link requests after 5 attempts', function (): void {
    for ($i = 0; $i < 5; $i++) {
        $this->post('/forgot-password', [
            'email' => "user{$i}@example.com",
        ]);
    }

    $response = $this->post('/forgot-password', [
        'email' => 'overflow@example.com',
    ]);

    $response->assertStatus(429);
});

it('throttles password reset submissions after 5 attempts', function (): void {
    for ($i = 0; $i < 5; $i++) {
        $this->post('/reset-password', [
            'token' => 'invalid-token-'.$i,
            'email' => "user{$i}@example.com",
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);
    }

    $response = $this->post('/reset-password', [
        'token' => 'overflow-token',
        'email' => 'overflow@example.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
    ]);

    $response->assertStatus(429);
});

it('throttles safety api endpoints after 60 requests per minute', function (): void {
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::OperationsManager->value]);
    $token = $user->createToken('Safety Device')->plainTextToken;

    for ($i = 0; $i < 60; $i++) {
        $this->withToken($token)
            ->getJson('/api/v1/safety/hazards')
            ->assertOk();
    }

    $response = $this->withToken($token)
        ->getJson('/api/v1/safety/hazards');

    $response->assertStatus(429);
    $response->assertJson([
        'error' => 'rate_limited',
    ]);
});

it('decouples weather endpoint rate limiting from location telemetry', function (): void {
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::CraneOperator->value]);
    $token = $user->createToken('Mobile App')->plainTextToken;

    // Send 60 weather requests
    for ($i = 0; $i < 60; $i++) {
        $this->withToken($token)
            ->getJson('/api/v1/telemetry/weather')
            ->assertOk();
    }

    // 61st weather request is throttled
    $this->withToken($token)
        ->getJson('/api/v1/telemetry/weather')
        ->assertStatus(429);

    // Location upload is NOT throttled because it uses independent rate limiter
    $this->withToken($token)
        ->postJson('/api/v1/locations', [
            'command_id' => Str::uuid()->toString(),
            'captured_at' => now()->toIso8601String(),
            'sharing_enabled' => false,
        ])
        ->assertStatus(201);
});

it('decouples attachment downloads from upload rate limiting quota', function (): void {
    config(['attachments.disk' => 'local']);
    Storage::fake('local');

    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::OperationsManager->value]);

    // Exhaust upload quota (20 uploads)
    $lastAttachment = null;
    for ($i = 0; $i < 20; $i++) {
        $job = DispatchJob::query()->create([
            'reference' => 'DISP-DOWNLOAD-'.$i.'-'.uniqid(),
            'client' => 'Client',
            'title' => 'Download Job '.$i,
            'site' => 'Site',
            'status' => DispatchStatus::Draft,
            'priority' => DispatchPriority::Routine,
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(2),
            'created_by' => $user->id,
            'version' => 1,
        ]);

        $res = $this->actingAs($user)
            ->postJson('/operations/attachments', [
                'file' => UploadedFile::fake()->create("doc-{$i}.pdf", 1, 'application/pdf'),
                'owner_type' => 'dispatch_job',
                'owner_id' => $job->id,
            ])
            ->assertCreated();

        $lastAttachment = Attachment::query()->where('owner_id', $job->id)->first();
    }

    $overflowJob = DispatchJob::query()->create([
        'reference' => 'DISP-DOWNLOAD-OVERFLOW-'.uniqid(),
        'client' => 'Client',
        'title' => 'Download Job Overflow',
        'site' => 'Site',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'created_by' => $user->id,
        'version' => 1,
    ]);

    // 21st upload is throttled
    $this->actingAs($user)
        ->postJson('/operations/attachments', [
            'file' => UploadedFile::fake()->create('overflow.pdf', 1, 'application/pdf'),
            'owner_type' => 'dispatch_job',
            'owner_id' => $overflowJob->id,
        ])
        ->assertStatus(429);

    // Downloading is NOT throttled by upload limit
    expect($lastAttachment)->not->toBeNull();
    $this->actingAs($user)
        ->get("/operations/attachments/{$lastAttachment->id}/download")
        ->assertOk();
});
