<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\TrustedDevice;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Services\DeviceTrustService;
use App\Platform\Identity\Services\EmailOtpService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    RateLimiter::clear('dispatcher|127.0.0.1');
    RateLimiter::clear('otp-send|127.0.0.1');
    RateLimiter::clear('otp-verify|127.0.0.1');
});

it('requires verification challenge when logging in on web with email_otp_enabled and untrusted device', function (): void {
    $user = User::factory()->create([
        'username' => 'field.dispatcher',
        'email' => 'dispatcher@example.com',
        'email_otp_enabled' => true,
        'email_verified_at' => now(),
        'is_active' => true,
    ]);
    $user->syncRoles([RoleName::OperationsManager->value]);

    $response = $this->post('/login', [
        'username' => 'field.dispatcher',
        'password' => 'password',
    ]);

    $response->assertRedirect(route('login.challenge'));
    $this->assertGuest();

    // Check that challenge session and OTP record exist
    expect(session('login.two_factor'))->not->toBeNull()
        ->and(session('login.two_factor.user_id'))->toBe($user->id);

    $this->assertDatabaseHas('email_one_time_codes', [
        'user_id' => $user->id,
        'purpose' => EmailOneTimeCode::PURPOSE_LOGIN,
    ]);
});

it('bypasses web OTP challenge when a valid core2_device_trust cookie is present', function (): void {
    $user = User::factory()->create([
        'username' => 'field.dispatcher',
        'email' => 'dispatcher@example.com',
        'email_otp_enabled' => true,
        'email_verified_at' => now(),
        'is_active' => true,
    ]);
    $user->syncRoles([RoleName::OperationsManager->value]);

    $plainToken = 'test-plain-trust-token-1234567890abcdef';
    $hashedToken = hash('sha256', $plainToken);

    TrustedDevice::create([
        'user_id' => $user->id,
        'device_id' => (string) Str::uuid(),
        'device_key_hash' => $hashedToken,
        'device_label' => 'Chrome on Windows',
        'platform' => 'web',
        'ip_address' => '127.0.0.1',
        'last_used_at' => now(),
        'expires_at' => now()->addDays(30),
    ]);

    $response = $this->withCookie(DeviceTrustService::COOKIE_NAME, $plainToken)
        ->post('/login', [
            'username' => 'field.dispatcher',
            'password' => 'password',
        ]);

    $response->assertRedirect('/');
    $this->assertAuthenticatedAs($user);
});

it('issues a 30-day device trust cookie upon completing web challenge with trust_device checked', function (): void {
    $user = User::factory()->create([
        'username' => 'field.dispatcher',
        'email' => 'dispatcher@example.com',
        'email_otp_enabled' => true,
        'email_verified_at' => now(),
        'is_active' => true,
    ]);

    $code = '654321';
    $codeHash = hash_hmac('sha256', $code, (string) config('app.key'));

    // Create challenge
    EmailOneTimeCode::create([
        'user_id' => $user->id,
        'purpose' => EmailOneTimeCode::PURPOSE_LOGIN,
        'code_hash' => $codeHash,
        'challenge_id' => 'ch-web-test-123',
        'expires_at' => now()->addMinutes(5),
        'attempts' => 0,
        'max_attempts' => 5,
        'resend_count' => 0,
    ]);

    $response = $this->withSession([
        'login.two_factor' => [
            'user_id' => $user->id,
            'challenge_id' => 'ch-web-test-123',
            'expires_at' => now()->addMinutes(5)->timestamp,
        ],
    ])->post('/login/challenge', [
        'code' => $code,
        'trust_device' => true,
    ]);

    $response->assertRedirect('/');
    $this->assertAuthenticatedAs($user);
    $response->assertCookie(DeviceTrustService::COOKIE_NAME);

    // Trust record created
    expect($user->trustedDevices()->count())->toBe(1);
    $trustedDevice = $user->trustedDevices()->first();
    expect($trustedDevice->platform)->toBe('web')
        ->and($trustedDevice->expires_at->isFuture())->toBeTrue();
});

it('does not issue a device trust cookie when trust_device is unchecked', function (): void {
    $user = User::factory()->create([
        'username' => 'field.dispatcher',
        'email' => 'dispatcher@example.com',
        'email_otp_enabled' => true,
        'email_verified_at' => now(),
        'is_active' => true,
    ]);

    $code = '654321';
    $codeHash = hash_hmac('sha256', $code, (string) config('app.key'));

    EmailOneTimeCode::create([
        'user_id' => $user->id,
        'purpose' => EmailOneTimeCode::PURPOSE_LOGIN,
        'code_hash' => $codeHash,
        'challenge_id' => 'ch-web-test-no-trust',
        'expires_at' => now()->addMinutes(5),
        'attempts' => 0,
        'max_attempts' => 5,
        'resend_count' => 0,
    ]);

    $response = $this->withSession([
        'login.two_factor' => [
            'user_id' => $user->id,
            'challenge_id' => 'ch-web-test-no-trust',
            'expires_at' => now()->addMinutes(5)->timestamp,
        ],
    ])->post('/login/challenge', [
        'code' => $code,
        'trust_device' => false,
    ]);

    $response->assertRedirect('/');
    $this->assertAuthenticatedAs($user);
    $response->assertCookieMissing(DeviceTrustService::COOKIE_NAME);
    expect($user->trustedDevices()->count())->toBe(0);
});

it('enforces 45-second cooldown on OTP resend', function (): void {
    $user = User::factory()->create([
        'email' => 'dispatcher@example.com',
        'email_otp_enabled' => true,
        'email_verified_at' => now(),
        'is_active' => true,
    ]);

    $cooldownKey = 'email-otp-cooldown:'.$user->id.':'.EmailOneTimeCode::PURPOSE_ENABLE_OTP;
    RateLimiter::hit($cooldownKey, 45);

    $challengeId = (string) Str::uuid();
    EmailOneTimeCode::create([
        'user_id' => $user->id,
        'purpose' => EmailOneTimeCode::PURPOSE_ENABLE_OTP,
        'code_hash' => hash_hmac('sha256', '112233', (string) config('app.key')),
        'challenge_id' => $challengeId,
        'expires_at' => now()->addMinutes(5),
        'attempts' => 0,
        'max_attempts' => 5,
        'resend_count' => 0,
    ]);

    $response = $this->actingAs($user)->postJson('/account/security/otp/resend', [
        'challenge_id' => $challengeId,
        'purpose' => EmailOneTimeCode::PURPOSE_ENABLE_OTP,
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['code']);
});

it('locks out OTP challenge after 5 invalid attempts', function (): void {
    $user = User::factory()->create([
        'email' => 'dispatcher@example.com',
        'email_otp_enabled' => true,
        'email_verified_at' => now(),
        'is_active' => true,
    ]);

    $otp = EmailOneTimeCode::create([
        'user_id' => $user->id,
        'purpose' => EmailOneTimeCode::PURPOSE_LOGIN,
        'code_hash' => hash_hmac('sha256', '123456', (string) config('app.key')),
        'challenge_id' => 'ch-lockout-test',
        'expires_at' => now()->addMinutes(5),
        'attempts' => 4, // 4 attempts already used
        'max_attempts' => 5,
        'resend_count' => 0,
    ]);

    $response = $this->postJson('/api/v1/auth/challenge/verify', [
        'challenge_id' => 'ch-lockout-test',
        'code' => '999999', // 5th invalid attempt
    ]);

    $response->assertStatus(422);

    $otp->refresh();
    expect($otp->attempts)->toBe(5)
        ->and($otp->isExhausted())->toBeTrue();
});

it('revokes all trusted devices, tokens, sessions, and active challenges on password reset', function (): void {
    $user = User::factory()->create([
        'username' => 'reset.user',
        'email' => 'reset@example.com',
        'email_verified_at' => now(),
        'is_active' => true,
    ]);

    // Create a bearer token
    $token = $user->createToken('Mobile Phone')->plainTextToken;
    expect($user->tokens()->count())->toBe(1);

    // Create a trusted device
    TrustedDevice::create([
        'user_id' => $user->id,
        'device_id' => (string) Str::uuid(),
        'device_label' => 'Device 1',
        'device_key_hash' => hash('sha256', 'token-1'),
        'platform' => 'web',
        'expires_at' => now()->addDays(30),
    ]);
    expect($user->trustedDevices()->count())->toBe(1);

    // Create active OTP challenge
    EmailOneTimeCode::create([
        'user_id' => $user->id,
        'purpose' => EmailOneTimeCode::PURPOSE_LOGIN,
        'code_hash' => hash_hmac('sha256', '123456', (string) config('app.key')),
        'challenge_id' => 'ch-pwd-reset',
        'expires_at' => now()->addMinutes(5),
        'attempts' => 0,
        'max_attempts' => 5,
        'resend_count' => 0,
    ]);

    // Create session record in sessions table
    DB::table('sessions')->insert([
        'id' => 'test-session-id',
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Mozilla/5.0',
        'payload' => serialize(['foo' => 'bar']),
        'last_activity' => time(),
    ]);

    $resetToken = Password::broker()->createToken($user);

    $response = $this->post('/reset-password', [
        'token' => $resetToken,
        'email' => 'reset@example.com',
        'password' => 'NewSecurePassword123!',
        'password_confirmation' => 'NewSecurePassword123!',
    ]);

    $response->assertRedirect(route('login'));

    // Verify all tokens, devices, sessions, and OTP codes are revoked
    expect($user->tokens()->count())->toBe(0)
        ->and($user->trustedDevices()->count())->toBe(0)
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0)
        ->and(EmailOneTimeCode::where('user_id', $user->id)->whereNull('verified_at')->count())->toBe(0);
});

it('returns 426 Upgrade Required for legacy mobile clients when device verification is required', function (): void {
    $user = User::factory()->create([
        'username' => 'operator.mobile',
        'email' => 'operator@example.com',
        'email_otp_enabled' => true,
        'email_verified_at' => now(),
        'is_active' => true,
    ]);

    $response = $this->withHeader('X-Legacy-Client', 'true')
        ->postJson('/api/v1/auth/login', [
            'username' => 'operator.mobile',
            'password' => 'password',
        ]);

    $response->assertStatus(426)
        ->assertJson([
            'error' => 'client_upgrade_required',
            'message' => 'Device verification is required. Please update the field mobile application.',
        ]);
});

it('returns challenge response and no bearer token on API login when verification is required', function (): void {
    $user = User::factory()->create([
        'username' => 'operator.mobile',
        'email' => 'operator@example.com',
        'email_otp_enabled' => true,
        'email_verified_at' => now(),
        'is_active' => true,
    ]);

    $response = $this->postJson('/api/v1/auth/login', [
        'username' => 'operator.mobile',
        'password' => 'password',
    ]);

    $response->assertOk()
        ->assertJson([
            'requires_verification' => true,
            'cooldown_seconds' => 45,
            'expires_in_seconds' => 300,
        ])
        ->assertJsonStructure(['challenge_id', 'email_obfuscated'])
        ->assertJsonMissingPath('data.token');
});

it('bypasses challenge on API login when valid X-Device-Trust header is passed', function (): void {
    $user = User::factory()->create([
        'username' => 'operator.mobile',
        'email' => 'operator@example.com',
        'email_otp_enabled' => true,
        'email_verified_at' => now(),
        'is_active' => true,
    ]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    $plainToken = 'api-mobile-trust-token-1234567890abcdef';
    TrustedDevice::create([
        'user_id' => $user->id,
        'device_id' => (string) Str::uuid(),
        'device_label' => 'iPad Field Pro',
        'device_key_hash' => hash('sha256', $plainToken),
        'platform' => 'mobile',
        'ip_address' => '127.0.0.1',
        'last_used_at' => now(),
        'expires_at' => now()->addDays(30),
    ]);

    $response = $this->withHeader('X-Device-Trust', $plainToken)
        ->postJson('/api/v1/auth/login', [
            'username' => 'operator.mobile',
            'password' => 'password',
        ]);

    $response->assertOk()
        ->assertJson(['requires_verification' => false])
        ->assertJsonStructure(['data' => ['token', 'user']]);
});

it('allows verifying API challenge and issues bearer token and device trust token', function (): void {
    $user = User::factory()->create([
        'username' => 'operator.mobile',
        'email' => 'operator@example.com',
        'email_otp_enabled' => true,
        'email_verified_at' => now(),
        'is_active' => true,
    ]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    $code = '889900';
    $codeHash = hash_hmac('sha256', $code, (string) config('app.key'));

    EmailOneTimeCode::create([
        'user_id' => $user->id,
        'purpose' => EmailOneTimeCode::PURPOSE_LOGIN,
        'code_hash' => $codeHash,
        'challenge_id' => 'ch-api-verify-123',
        'expires_at' => now()->addMinutes(5),
        'attempts' => 0,
        'max_attempts' => 5,
        'resend_count' => 0,
    ]);

    $response = $this->postJson('/api/v1/auth/challenge/verify', [
        'challenge_id' => 'ch-api-verify-123',
        'code' => $code,
        'trust_device' => true,
        'device_name' => 'Field Operator Tablet',
    ]);

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                'token',
                'device_trust_token',
                'user' => ['id', 'username', 'email'],
            ],
        ]);

    $trustToken = $response->json('data.device_trust_token');
    expect($trustToken)->toBeString()
        ->and($user->trustedDevices()->count())->toBe(1);

    $savedDevice = $user->trustedDevices()->first();
    expect($savedDevice->device_key_hash)->toBe(hash('sha256', $trustToken))
        ->and($savedDevice->device_label)->toBe('Field Operator Tablet');
});

it('revokes device trust token on API logout when forget_device is requested', function (): void {
    $user = User::factory()->create([
        'username' => 'operator.mobile',
        'email' => 'operator@example.com',
        'is_active' => true,
    ]);

    $bearerToken = $user->createToken('Mobile')->plainTextToken;

    $trustToken = 'mobile-trust-token-to-revoke';
    $device = TrustedDevice::create([
        'user_id' => $user->id,
        'device_id' => (string) Str::uuid(),
        'device_label' => 'Device To Forget',
        'device_key_hash' => hash('sha256', $trustToken),
        'platform' => 'mobile',
        'expires_at' => now()->addDays(30),
    ]);

    $response = $this->withToken($bearerToken)
        ->withHeader('X-Forget-Device', 'true')
        ->withHeader('X-Device-Trust', $trustToken)
        ->postJson('/api/v1/auth/logout', [
            'forget_device' => true,
            'device_trust_token' => $trustToken,
        ]);

    $response->assertOk();
    expect($user->tokens()->count())->toBe(0)
        ->and(TrustedDevice::where('id', $device->id)->count())->toBe(0);
});

it('prevents administrators from disabling mandatory device verification', function (): void {
    $user = User::factory()->create([
        'username' => 'admin.user',
        'email' => 'admin@example.com',
        'email_verified_at' => now(),
        'email_otp_enabled' => true,
        'is_active' => true,
    ]);
    $user->syncRoles([RoleName::SystemAdministrator->value]);

    $response = $this->actingAs($user)->postJson('/account/security/otp/request-disable', [
        'current_password' => 'password',
    ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['current_password']);
});

it('allows users to revoke a specific trusted device and all trusted devices', function (): void {
    $user = User::factory()->create([
        'username' => 'multi.device',
        'email' => 'multi@example.com',
        'email_verified_at' => now(),
        'is_active' => true,
    ]);

    $deviceId1 = (string) Str::uuid();
    $device1 = TrustedDevice::create([
        'user_id' => $user->id,
        'device_id' => $deviceId1,
        'device_label' => 'MacBook Pro',
        'device_key_hash' => hash('sha256', 'tok1'),
        'platform' => 'web',
        'expires_at' => now()->addDays(30),
    ]);

    $deviceId2 = (string) Str::uuid();
    $device2 = TrustedDevice::create([
        'user_id' => $user->id,
        'device_id' => $deviceId2,
        'device_label' => 'iPhone 15',
        'device_key_hash' => hash('sha256', 'tok2'),
        'platform' => 'mobile',
        'expires_at' => now()->addDays(30),
    ]);

    // Revoke device 1
    $response = $this->actingAs($user)->deleteJson("/account/trusted-devices/{$deviceId1}");
    $response->assertOk();
    expect(TrustedDevice::where('id', $device1->id)->count())->toBe(0)
        ->and(TrustedDevice::where('id', $device2->id)->count())->toBe(1);

    // Revoke all remaining devices
    $responseAll = $this->actingAs($user)->postJson('/account/trusted-devices/revoke-all');
    $responseAll->assertOk();
    expect(TrustedDevice::where('user_id', $user->id)->count())->toBe(0);
});

it('reports a device lost, marking it lost and terminating all sessions and tokens', function (): void {
    $user = User::factory()->create([
        'username' => 'lost.user',
        'email' => 'lost@example.com',
        'email_verified_at' => now(),
        'is_active' => true,
    ]);

    $token = $user->createToken('Lost Device Token')->plainTextToken;

    $deviceId = (string) Str::uuid();
    $device = TrustedDevice::create([
        'user_id' => $user->id,
        'device_id' => $deviceId,
        'device_label' => 'Lost Device Token',
        'device_key_hash' => hash('sha256', 'tok-lost'),
        'platform' => 'mobile',
        'ip_address' => '127.0.0.1',
        'expires_at' => now()->addDays(30),
    ]);

    DB::table('sessions')->insert([
        'id' => 'lost-session-id',
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Mozilla/5.0',
        'payload' => serialize(['foo' => 'bar']),
        'last_activity' => time(),
    ]);

    $response = $this->actingAs($user)->postJson("/account/trusted-devices/{$deviceId}/lost");
    $response->assertOk();

    expect(TrustedDevice::where('id', $device->id)->count())->toBe(0)
        ->and($user->tokens()->count())->toBe(0)
        ->and(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0);
});

it('cleans up OTP state and rate limits gracefully when mail delivery fails', function (): void {
    $user = User::factory()->create([
        'username' => 'failing.mail.user',
        'email' => 'failing@example.com',
        'email_otp_enabled' => true,
        'email_verified_at' => now(),
        'is_active' => true,
    ]);

    Mail::shouldReceive('to->send')->andThrow(new RuntimeException('Brevo SMTP relay unavailable'));

    $service = app(EmailOtpService::class);

    expect(fn () => $service->generateCode($user, EmailOneTimeCode::PURPOSE_LOGIN))
        ->toThrow(ValidationException::class);

    expect(EmailOneTimeCode::where('user_id', $user->id)->count())->toBe(0)
        ->and(RateLimiter::tooManyAttempts('email-otp-cooldown:'.$user->id.':'.EmailOneTimeCode::PURPOSE_LOGIN, 1))->toBeFalse();
});
