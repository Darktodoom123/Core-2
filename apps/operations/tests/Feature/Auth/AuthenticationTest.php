<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Services\DeviceTrustService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('redirects guests to the internal login page', function () {
    $this->get('/')->assertRedirect(route('login'));
    $this->get(route('login'))->assertOk();
});

it('authenticates an active verified user on a trusted browser', function () {
    $user = User::factory()->create(['email' => 'dispatcher@example.com', 'username' => 'dispatch.admin']);
    $user->syncRoles([RoleName::OperationsManager->value]);

    $plainToken = 'test-plain-trust-token-1234567890abcdef';
    $user->trustedDevices()->create([
        'device_id' => (string) Str::uuid(),
        'device_key_hash' => hash('sha256', $plainToken),
        'device_label' => 'Chrome on Windows',
        'platform' => 'web',
        'ip_address' => '127.0.0.1',
        'last_used_at' => now(),
        'expires_at' => now()->addDays(30),
    ]);

    $this->withCookie(DeviceTrustService::COOKIE_NAME, $plainToken)
        ->post('/login', ['username' => ' Dispatch.Admin ', 'password' => 'password'])
        ->assertRedirect('/');
    $this->assertAuthenticatedAs($user);
});

it('redirects an active verified user on an unrecognized browser to verification challenge', function () {
    $user = User::factory()->create(['email' => 'dispatcher@example.com', 'username' => 'dispatch.admin']);
    $user->syncRoles([RoleName::OperationsManager->value]);

    $this->post('/login', ['username' => ' Dispatch.Admin ', 'password' => 'password'])
        ->assertRedirect(route('login.challenge'));
    $this->assertGuest();
});

it('does not lock out unverified users, allowing login to complete email verification', function () {
    $user = User::factory()->unverified()->create(['email' => 'unverified@example.com', 'username' => 'unverified.admin']);

    $this->post('/login', ['username' => 'unverified.admin', 'password' => 'password'])
        ->assertRedirect('/');
    $this->assertAuthenticatedAs($user);
});

it('does not persist a remembered web session', function (): void {
    $user = User::factory()->create([
        'username' => 'no-remember',
        'remember_token' => null,
    ]);

    $plainToken = 'test-plain-trust-token-1234567890abcdef';
    $user->trustedDevices()->create([
        'device_id' => (string) Str::uuid(),
        'device_key_hash' => hash('sha256', $plainToken),
        'device_label' => 'Chrome on Windows',
        'platform' => 'web',
        'ip_address' => '127.0.0.1',
        'last_used_at' => now(),
        'expires_at' => now()->addDays(30),
    ]);

    $this->withCookie(DeviceTrustService::COOKIE_NAME, $plainToken)
        ->post('/login', [
            'username' => $user->username,
            'password' => 'password',
            'remember' => true,
        ])->assertRedirect('/');

    expect($user->refresh()->remember_token)->toBeNull();
});

it('rejects a suspended account', function () {
    $user = User::factory()->suspended()->create();
    $this->post('/login', ['username' => $user->username, 'password' => 'password'])->assertSessionHasErrors('username');
    $this->assertGuest();
});

it('rejects invalid username formats at the web boundary', function (): void {
    $this->post('/login', ['username' => 'not safe', 'password' => 'password'])
        ->assertSessionHasErrors('username');
});

it('throttles web login by normalized username and IP', function (): void {
    RateLimiter::clear('throttle-user|127.0.0.1');
    User::factory()->create(['username' => 'throttle-user']);

    for ($attempt = 0; $attempt < 5; $attempt++) {
        $this->post('/login', [
            'username' => ' Throttle-User ',
            'password' => 'wrong-password',
        ]);
    }

    expect(RateLimiter::tooManyAttempts('throttle-user|127.0.0.1', 5))->toBeTrue();
});

it('keeps password reset email-based', function (): void {
    $user = User::factory()->create(['email' => 'recover@example.com', 'username' => 'recover-user']);

    $this->post('/forgot-password', ['email' => $user->email])
        ->assertRedirect()
        ->assertSessionHas('status');

    $this->assertDatabaseHas('password_reset_tokens', ['email' => $user->email]);
});

it('keeps email verification email-based', function (): void {
    $user = User::factory()->unverified()->create(['email' => 'verify@example.com', 'username' => 'verify-user']);
    $url = URL::temporarySignedRoute('verification.verify', now()->addMinutes(10), [
        'id' => $user->id,
        'hash' => sha1($user->getEmailForVerification()),
    ]);

    $this->actingAs($user)->get($url)->assertRedirect(route('home'));

    expect($user->refresh()->email_verified_at)->not->toBeNull();
});

it('logs out and invalidates the authenticated session', function () {
    $this->actingAs(User::factory()->create())->post('/logout')->assertRedirect(route('login'));
    $this->assertGuest();
});
