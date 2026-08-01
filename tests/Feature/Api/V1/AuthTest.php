<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    RateLimiter::clear('dispatcher@example.com|127.0.0.1');
});

it('allows active verified users to authenticate and receive a Sanctum token', function (): void {
    /** @var User $user */
    $user = User::factory()->create([
        'email' => 'dispatcher@example.com',
        'is_active' => true,
        'email_verified_at' => now(),
    ]);
    $user->syncRoles([RoleName::Dispatcher->value]);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'dispatcher@example.com',
        'password' => 'password',
        'device_name' => 'Field iPad Air Pro',
    ]);

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                'token',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'phone',
                    'role',
                    'is_active',
                    'email_verified_at',
                    'created_at',
                    'updated_at',
                ],
            ],
        ]);

    $data = $response->json('data');
    expect($data['token'])->toBeString()
        ->and($data['user']['email'])->toBe('dispatcher@example.com')
        ->and($data['user']['role'])->toBe(RoleName::Dispatcher->value);

    // Verify token does not expose password or remember_token
    $response->assertJsonMissingPath('data.user.password')
        ->assertJsonMissingPath('data.user.remember_token');
});

it('rejects login with invalid credentials', function (): void {
    User::factory()->create(['email' => 'dispatcher@example.com']);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'dispatcher@example.com',
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['email']);
});

it('rejects suspended accounts with 403 Forbidden', function (): void {
    /** @var User $user */
    $user = User::factory()->suspended()->create([
        'email' => 'suspended@example.com',
    ]);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'suspended@example.com',
        'password' => 'password',
    ]);

    $response->assertStatus(403)
        ->assertJson([
            'message' => 'This account is suspended. Contact a system administrator.',
        ]);
});

it('rejects unverified email accounts with 403 Forbidden', function (): void {
    /** @var User $user */
    $user = User::factory()->unverified()->create([
        'email' => 'unverified@example.com',
        'is_active' => true,
    ]);

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'unverified@example.com',
        'password' => 'password',
    ]);

    $response->assertStatus(403)
        ->assertJson([
            'message' => 'Your email address is not verified.',
        ]);
});

it('throttles excessive login attempts with 429 Too Many Requests', function (): void {
    User::factory()->create(['email' => 'dispatcher@example.com']);

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/v1/auth/login', [
            'email' => 'dispatcher@example.com',
            'password' => 'wrong-password',
        ]);
    }

    $response = $this->postJson('/api/v1/auth/login', [
        'email' => 'dispatcher@example.com',
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(429);
});

it('allows current user profile retrieval with valid bearer token', function (): void {
    /** @var User $user */
    $user = User::factory()->create(['email' => 'driver@example.com', 'is_active' => true]);
    $user->syncRoles([RoleName::Driver->value]);
    $token = $user->createToken('Mobile Phone')->plainTextToken;

    $response = $this->withToken($token)
        ->getJson('/api/v1/auth/me');

    $response->assertOk()
        ->assertJson([
            'data' => [
                'id' => $user->id,
                'email' => 'driver@example.com',
                'role' => RoleName::Driver->value,
                'is_active' => true,
            ],
        ]);
});

it('requires a bearer device token for the versioned mobile boundary', function (): void {
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);

    $this->actingAs($user)
        ->getJson('/api/v1/auth/me')
        ->assertUnauthorized()
        ->assertJson(['message' => 'A bearer device token is required for this API.']);
});

it('returns the current user resource through the versioned user alias', function (): void {
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $token = $user->createToken('Mobile Phone')->plainTextToken;

    $response = $this->withToken($token)->getJson('/api/v1/user');

    $response->assertOk()
        ->assertJsonStructure(['data' => ['id', 'name', 'email', 'role']])
        ->assertJsonMissingPath('data.password')
        ->assertJsonMissingPath('data.remember_token');
});

it('revokes Sanctum device token on logout and blocks subsequent requests', function (): void {
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $token = $user->createToken('Mobile Phone')->plainTextToken;

    // First request with token works
    $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk();

    // Logout revokes token
    $logoutResponse = $this->withToken($token)->postJson('/api/v1/auth/logout');
    $logoutResponse->assertOk()
        ->assertJson(['message' => 'Successfully logged out and revoked device token.']);
    expect($user->tokens()->count())->toBe(0);

    // Forget cached auth state in test runner so guard re-checks DB
    $this->app['auth']->forgetGuards();

    // Subsequent request with revoked token fails with 401 Unauthenticated
    $this->withToken($token)->getJson('/api/v1/auth/me')->assertStatus(401);
});

it('blocks token access if user is suspended after token issuance', function (): void {
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $token = $user->createToken('Mobile Phone')->plainTextToken;

    // Verify initial access works
    $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk();

    // Suspend the user
    $user->update(['is_active' => false, 'suspended_at' => now()]);

    // Forget cached auth state in test runner so user state is reloaded from DB
    $this->app['auth']->forgetGuards();

    // Request is rejected with 403 Forbidden
    $this->withToken($token)
        ->getJson('/api/v1/auth/me')
        ->assertStatus(403)
        ->assertJson(['message' => 'This account is suspended. Contact a system administrator.']);
});
