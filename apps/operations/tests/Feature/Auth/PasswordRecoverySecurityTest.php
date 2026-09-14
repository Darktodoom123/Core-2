<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('returns an account-neutral response on forgot-password for registered and unregistered emails', function (): void {
    $user = User::factory()->create(['email' => 'registered@example.com']);

    // Registered email
    $res1 = $this->post('/forgot-password', ['email' => 'registered@example.com']);
    $res1->assertRedirect();
    $res1->assertSessionHas('status', 'If the account exists, a password reset link has been sent.');
    $this->assertDatabaseHas('password_reset_tokens', ['email' => 'registered@example.com']);

    // Unregistered email
    $res2 = $this->post('/forgot-password', ['email' => 'nonexistent@example.com']);
    $res2->assertRedirect();
    $res2->assertSessionHas('status', 'If the account exists, a password reset link has been sent.');
    $this->assertDatabaseMissing('password_reset_tokens', ['email' => 'nonexistent@example.com']);
});

it('validates email input on forgot-password', function (): void {
    $this->post('/forgot-password', ['email' => 'not-an-email'])
        ->assertSessionHasErrors('email');

    $this->post('/forgot-password', ['email' => ''])
        ->assertSessionHasErrors('email');
});

it('rejects invalid or expired password reset tokens', function (): void {
    $user = User::factory()->create(['email' => 'user@example.com']);

    $response = $this->post('/reset-password', [
        'token' => 'invalid-token-12345',
        'email' => $user->email,
        'password' => 'NewPassword123!',
        'password_confirmation' => 'NewPassword123!',
    ]);

    $response->assertSessionHasErrors('email');
    expect(Hash::check('password', $user->refresh()->password))->toBeTrue();
});

it('resets password, revokes trusted devices, api tokens, sessions, and pending OTP challenges', function (): void {
    $user = User::factory()->create([
        'email' => 'operator@example.com',
        'username' => 'operator.reset',
        'password' => Hash::make('OldPassword123!'),
        'email_otp_enabled' => true,
    ]);
    $user->syncRoles([RoleName::OperationsManager->value]);

    // Create trusted device
    $user->trustedDevices()->create([
        'device_id' => (string) Str::uuid(),
        'device_key_hash' => hash('sha256', 'plain-token'),
        'device_label' => 'Test Browser',
        'platform' => 'web',
        'ip_address' => '127.0.0.1',
        'last_used_at' => now(),
        'expires_at' => now()->addDays(30),
    ]);

    // Create API token
    $user->createToken('test-mobile-token');

    // Create pending email OTP challenge
    EmailOneTimeCode::create([
        'user_id' => $user->id,
        'challenge_id' => (string) Str::uuid(),
        'code_hash' => hash('sha256', '123456'),
        'purpose' => 'device_verification',
        'expires_at' => now()->addMinutes(10),
        'attempts' => 0,
        'max_attempts' => 5,
        'resend_count' => 0,
    ]);

    // Create active web session in sessions table
    DB::table('sessions')->insert([
        'id' => 'session_test_123',
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'PHPUnit',
        'payload' => 'payload',
        'last_activity' => now()->timestamp,
    ]);

    expect($user->trustedDevices()->count())->toBe(1);
    expect($user->tokens()->count())->toBe(1);
    expect(EmailOneTimeCode::where('user_id', $user->id)->count())->toBe(1);
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(1);

    // Generate valid reset token
    $token = Password::broker()->createToken($user);

    // Reset password
    $response = $this->post('/reset-password', [
        'token' => $token,
        'email' => $user->email,
        'password' => 'BrandNewPassword123!',
        'password_confirmation' => 'BrandNewPassword123!',
    ]);

    $response->assertRedirect(route('login'));
    $this->assertGuest();

    // Verify password was changed
    $user->refresh();
    expect(Hash::check('BrandNewPassword123!', $user->password))->toBeTrue();
    expect(Hash::check('OldPassword123!', $user->password))->toBeFalse();

    // Verify email_otp_enabled is preserved
    expect($user->email_otp_enabled)->toBeTrue();

    // Verify all revocations occurred
    expect($user->trustedDevices()->count())->toBe(0);
    expect($user->tokens()->count())->toBe(0);
    expect(EmailOneTimeCode::where('user_id', $user->id)->count())->toBe(0);
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0);

    // Token cannot be reused
    $reused = $this->post('/reset-password', [
        'token' => $token,
        'email' => $user->email,
        'password' => 'AnotherPassword123!',
        'password_confirmation' => 'AnotherPassword123!',
    ]);
    $reused->assertSessionHasErrors('email');
});
