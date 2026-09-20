<?php

use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Mail\EmailOtpMail;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    Mail::fake();
    $this->seed(RolePermissionSeeder::class);
    $this->withoutMiddleware(ThrottleRequests::class);
});

it('requires a sanctum bearer token to access account endpoints', function (): void {
    $this->getJson('/api/v1/account')->assertUnauthorized();
    $this->patchJson('/api/v1/account/profile', ['phone' => '+15551234567'])->assertUnauthorized();
    $this->postJson('/api/v1/account/password', ['password' => 'new-password'])->assertUnauthorized();
});

it('returns unified account details for authenticated mobile operator', function (): void {
    /** @var User $user */
    $user = User::factory()->create([
        'name' => 'John Operator',
        'username' => 'john.operator',
        'email' => 'john.operator@core2.test',
        'phone' => '+15551234567',
        'is_active' => true,
        'email_verified_at' => now(),
        'email_otp_enabled' => false,
    ]);
    $user->syncRoles([RoleName::CraneOperator->value]);
    $token = $user->createToken('Field Android Tablet')->plainTextToken;

    // Seed an audit event
    AuditEvent::query()->create([
        'subject_type' => $user->getMorphClass(),
        'subject_id' => (string) $user->id,
        'action' => 'user.login',
        'ip_address' => '127.0.0.1',
        'occurred_at' => now()->subHours(2),
        'after' => ['outcome' => 'success'],
    ]);

    $response = $this->withToken($token)->getJson('/api/v1/account');

    $response->assertOk()
        ->assertJsonPath('profile.name', 'John Operator')
        ->assertJsonPath('profile.username', 'john.operator')
        ->assertJsonPath('profile.email', 'john.operator@core2.test')
        ->assertJsonPath('profile.phone', '+15551234567')
        ->assertJsonPath('profile.role', RoleName::CraneOperator->value)
        ->assertJsonPath('profile.account_status', 'active')
        ->assertJsonPath('security.email_otp_enabled', false)
        ->assertJsonPath('security.has_verified_email', true);

    expect($response->json('sessions'))->toBeArray()->not->toBeEmpty();
    expect($response->json('sessions.0.is_current'))->toBeTrue();
    expect($response->json('recent_activity.data'))->toBeArray()->not->toBeEmpty();
});

it('updates contact phone number and writes audit event', function (): void {
    /** @var User $user */
    $user = User::factory()->create([
        'phone' => '+15550000000',
        'is_active' => true,
    ]);
    $token = $user->createToken('Mobile Client')->plainTextToken;

    $response = $this->withToken($token)->patchJson('/api/v1/account/profile', [
        'phone' => '+15559998888',
    ]);

    $response->assertOk()
        ->assertJsonPath('phone', '+15559998888')
        ->assertJsonPath('message', 'Profile contact details updated successfully.');

    expect($user->fresh()->phone)->toBe('+15559998888');

    $this->assertDatabaseHas('audit_events', [
        'subject_type' => $user->getMorphClass(),
        'subject_id' => (string) $user->id,
        'action' => 'user.profile_updated',
    ]);
});

it('handles full email change request and verification lifecycle', function (): void {
    /** @var User $user */
    $user = User::factory()->create([
        'email' => 'old.email@core2.test',
        'password' => Hash::make('Secret123!'),
        'is_active' => true,
        'email_verified_at' => now(),
    ]);
    $token = $user->createToken('Mobile Client')->plainTextToken;

    // Wrong password rejected
    $this->withToken($token)->postJson('/api/v1/account/email/request', [
        'current_password' => 'WrongPassword',
        'email' => 'new.email@core2.test',
    ])->assertUnprocessable()->assertJsonValidationErrors(['current_password']);

    // Same email rejected
    $this->withToken($token)->postJson('/api/v1/account/email/request', [
        'current_password' => 'Secret123!',
        'email' => 'old.email@core2.test',
    ])->assertUnprocessable()->assertJsonValidationErrors(['email']);

    // Successful request
    $requestRes = $this->withToken($token)->postJson('/api/v1/account/email/request', [
        'current_password' => 'Secret123!',
        'email' => 'new.email@core2.test',
    ]);

    $requestRes->assertOk()->assertJsonStructure(['challenge_id', 'cooldown_seconds']);
    $challengeId = $requestRes->json('challenge_id');

    // Fetch sent OTP code from faked mail
    $sentMail = Mail::sent(EmailOtpMail::class)->last();
    expect($sentMail)->not->toBeNull();

    // Verify email change with code
    $verifyRes = $this->withToken($token)->postJson('/api/v1/account/email/verify', [
        'challenge_id' => $challengeId,
        'code' => $sentMail->code,
    ]);

    $verifyRes->assertOk()->assertJsonPath('message', 'Your email address has been updated and verified successfully.');
    expect($user->fresh()->email)->toBe('new.email@core2.test');

    $this->assertDatabaseHas('audit_events', [
        'subject_type' => $user->getMorphClass(),
        'subject_id' => (string) $user->id,
        'action' => 'user.email_updated',
    ]);
});

it('changes password, revokes web sessions and device trust, while preserving mobile sanctum token', function (): void {
    /** @var User $user */
    $user = User::factory()->create([
        'password' => Hash::make('CurrentSecret123!'),
        'is_active' => true,
    ]);
    $token = $user->createToken('Field Cab Android')->plainTextToken;

    // Create a mock web session
    DB::table('sessions')->insert([
        'id' => 'mock-web-session-id',
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Mozilla/5.0 Chrome/120.0',
        'payload' => 'payload',
        'last_activity' => time(),
    ]);

    // Create a trusted device
    $user->trustedDevices()->create([
        'device_id' => (string) Str::uuid(),
        'device_key_hash' => hash('sha256', 'mock-trust-token'),
        'device_label' => 'Old Laptop',
        'platform' => 'web',
        'expires_at' => now()->addDays(30),
    ]);

    // Wrong current password
    $this->withToken($token)->postJson('/api/v1/account/password', [
        'current_password' => 'WrongPass',
        'password' => 'NewSecurePassword123#',
        'password_confirmation' => 'NewSecurePassword123#',
    ])->assertUnprocessable()->assertJsonValidationErrors(['current_password']);

    // Valid password update
    $response = $this->withToken($token)->postJson('/api/v1/account/password', [
        'current_password' => 'CurrentSecret123!',
        'password' => 'NewSecurePassword123#',
        'password_confirmation' => 'NewSecurePassword123#',
    ]);

    $response->assertOk()
        ->assertJsonPath('message', 'Your password has been changed. All other sessions and device trust have been revoked.');

    // User password hash is updated
    expect(Hash::check('NewSecurePassword123#', $user->fresh()->password))->toBeTrue();

    // Web sessions and trusted devices are revoked
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0);
    expect($user->trustedDevices()->count())->toBe(0);

    // CRITICAL REQUIREMENT: The mobile Sanctum token remains valid!
    $this->withToken($token)->getJson('/api/v1/account')->assertOk();

    // Audit event recorded
    $this->assertDatabaseHas('audit_events', [
        'subject_type' => $user->getMorphClass(),
        'subject_id' => (string) $user->id,
        'action' => 'user.password_changed',
    ]);
});

it('handles 2fa email otp enable and disable lifecycles', function (): void {
    /** @var User $user */
    $user = User::factory()->create([
        'password' => Hash::make('ValidPassword123!'),
        'is_active' => true,
        'email_verified_at' => now(),
        'email_otp_enabled' => false,
    ]);
    $user->syncRoles([RoleName::CraneOperator->value]);
    $token = $user->createToken('Mobile Phone')->plainTextToken;

    // Step 1: Request enable OTP
    $reqEnableRes = $this->withToken($token)->postJson('/api/v1/account/security/otp/request-enable', [
        'current_password' => 'ValidPassword123!',
    ]);

    $reqEnableRes->assertOk()->assertJsonStructure(['challenge_id', 'cooldown_seconds']);
    $enableChallengeId = $reqEnableRes->json('challenge_id');

    // Clear cooldown to test resend endpoint
    RateLimiter::clear('email-otp-cooldown:'.$user->id.':'.EmailOneTimeCode::PURPOSE_ENABLE_OTP);
    $resendRes = $this->withToken($token)->postJson('/api/v1/account/security/otp/resend', [
        'challenge_id' => $enableChallengeId,
        'purpose' => 'enable_email_otp',
    ]);
    $resendRes->assertOk();
    $enableChallengeId = $resendRes->json('challenge_id');

    $code = Mail::sent(EmailOtpMail::class)->last()->code;

    // Step 2: Confirm enable OTP
    $confirmEnableRes = $this->withToken($token)->postJson('/api/v1/account/security/otp/confirm-enable', [
        'challenge_id' => $enableChallengeId,
        'code' => $code,
    ]);

    $confirmEnableRes->assertOk()->assertJsonPath('email_otp_enabled', true);
    expect($user->fresh()->email_otp_enabled)->toBeTrue();

    // Step 3: Request disable OTP
    $reqDisableRes = $this->withToken($token)->postJson('/api/v1/account/security/otp/request-disable', [
        'current_password' => 'ValidPassword123!',
    ]);

    $reqDisableRes->assertOk()->assertJsonStructure(['challenge_id']);
    $disableChallengeId = $reqDisableRes->json('challenge_id');

    $disableCode = Mail::sent(EmailOtpMail::class)->last()->code;

    // Step 4: Confirm disable OTP
    $confirmDisableRes = $this->withToken($token)->postJson('/api/v1/account/security/otp/confirm-disable', [
        'challenge_id' => $disableChallengeId,
        'code' => $disableCode,
    ]);

    $confirmDisableRes->assertOk()->assertJsonPath('email_otp_enabled', false);
    expect($user->fresh()->email_otp_enabled)->toBeFalse();
});

it('blocks system administrators from disabling mandatory 2fa', function (): void {
    /** @var User $admin */
    $admin = User::factory()->create([
        'password' => Hash::make('AdminPass123!'),
        'is_active' => true,
        'email_verified_at' => now(),
        'email_otp_enabled' => true,
    ]);
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $token = $admin->createToken('Admin Phone')->plainTextToken;

    $this->withToken($token)->postJson('/api/v1/account/security/otp/request-disable', [
        'current_password' => 'AdminPass123!',
    ])->assertUnprocessable()->assertJsonValidationErrors(['current_password']);
});

it('allows revoking specific sessions and all other sessions with password', function (): void {
    /** @var User $user */
    $user = User::factory()->create([
        'password' => Hash::make('Password123!'),
        'is_active' => true,
    ]);
    $token = $user->createToken('Current Mobile')->plainTextToken;

    DB::table('sessions')->insert([
        'id' => 'web-session-123',
        'user_id' => $user->id,
        'ip_address' => '192.168.1.50',
        'user_agent' => 'Mozilla/5.0 Mac OS',
        'payload' => 'payload',
        'last_activity' => time(),
    ]);

    DB::table('sessions')->insert([
        'id' => 'web-session-456',
        'user_id' => $user->id,
        'ip_address' => '192.168.1.51',
        'user_agent' => 'Mozilla/5.0 Windows',
        'payload' => 'payload',
        'last_activity' => time(),
    ]);

    // Revoke single session
    $this->withToken($token)->deleteJson('/api/v1/account/sessions/web-session-123')
        ->assertOk()
        ->assertJsonPath('message', 'Session revoked successfully.');

    expect(DB::table('sessions')->where('id', 'web-session-123')->exists())->toBeFalse();
    expect(DB::table('sessions')->where('id', 'web-session-456')->exists())->toBeTrue();

    // Revoke other sessions (requires password)
    $this->withToken($token)->postJson('/api/v1/account/sessions/revoke-others', [
        'current_password' => 'WrongPass',
    ])->assertUnprocessable();

    $this->withToken($token)->postJson('/api/v1/account/sessions/revoke-others', [
        'current_password' => 'Password123!',
    ])->assertOk();

    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(0);
});

it('allows managing trusted devices including revoking, lost device reporting, and revoking all', function (): void {
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $token = $user->createToken('Mobile App')->plainTextToken;

    $dev1 = $user->trustedDevices()->create([
        'device_id' => (string) Str::uuid(),
        'device_key_hash' => hash('sha256', 'trust-1'),
        'device_label' => 'Tablet 1',
        'platform' => 'mobile',
        'expires_at' => now()->addDays(30),
    ]);

    $dev2 = $user->trustedDevices()->create([
        'device_id' => (string) Str::uuid(),
        'device_key_hash' => hash('sha256', 'trust-2'),
        'device_label' => 'Laptop Workstation',
        'platform' => 'web',
        'expires_at' => now()->addDays(30),
    ]);

    // Revoke device 1
    $this->withToken($token)->deleteJson("/api/v1/account/trusted-devices/{$dev1->device_id}")
        ->assertOk()
        ->assertJsonPath('message', 'Trusted device revoked successfully.');

    expect($user->trustedDevices()->where('device_id', $dev1->device_id)->exists())->toBeFalse();

    // Mark device 2 lost
    $this->withToken($token)->postJson("/api/v1/account/trusted-devices/{$dev2->device_id}/lost")
        ->assertOk()
        ->assertJsonPath('message', 'Lost device trust and active sessions revoked successfully.');

    expect($user->trustedDevices()->where('device_id', $dev2->device_id)->exists())->toBeFalse();

    // Add another device and revoke all
    $dev3 = $user->trustedDevices()->create([
        'device_id' => (string) Str::uuid(),
        'device_key_hash' => hash('sha256', 'trust-3'),
        'device_label' => 'Backup Phone',
        'platform' => 'mobile',
        'expires_at' => now()->addDays(30),
    ]);

    $this->withToken($token)->postJson('/api/v1/account/trusted-devices/revoke-all')
        ->assertOk()
        ->assertJsonPath('revoked_count', 1);

    expect($user->trustedDevices()->count())->toBe(0);
});

it('returns paginated security activity audit events', function (): void {
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $token = $user->createToken('Mobile App')->plainTextToken;

    AuditEvent::query()->create([
        'subject_type' => $user->getMorphClass(),
        'subject_id' => (string) $user->id,
        'action' => 'user.login',
        'ip_address' => '10.0.0.1',
        'occurred_at' => now(),
        'after' => ['outcome' => 'success'],
    ]);

    $response = $this->withToken($token)->getJson('/api/v1/account/activity');

    $response->assertOk()
        ->assertJsonStructure(['data', 'current_page', 'total']);
    expect($response->json('data'))->toHaveCount(1);
    expect($response->json('data.0.action'))->toBe('user.login');
});

it('lists other active mobile tokens in sessions and allows revoking other tokens while guarding current token', function (): void {
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $currentTokenResult = $user->createToken('Current Phone');
    $otherTokenResult = $user->createToken('Secondary Tablet');

    $currentToken = $currentTokenResult->plainTextToken;
    $otherTokenId = $otherTokenResult->accessToken->id;
    $currentTokenId = $currentTokenResult->accessToken->id;

    $response = $this->withToken($currentToken)->getJson('/api/v1/account');
    $response->assertOk();

    $sessions = $response->json('sessions');
    expect($sessions)->toHaveCount(2);

    $currentSession = collect($sessions)->firstWhere('is_current', true);
    expect($currentSession['id'])->toBe('token-'.$currentTokenId);

    $otherSession = collect($sessions)->firstWhere('is_current', false);
    expect($otherSession['id'])->toBe('token-'.$otherTokenId);
    expect($otherSession['device_label'])->toBe('Secondary Tablet');

    // Cannot revoke current token via session endpoint
    $this->withToken($currentToken)->deleteJson('/api/v1/account/sessions/token-'.$currentTokenId)
        ->assertStatus(400);

    // Can revoke other mobile token
    $this->withToken($currentToken)->deleteJson('/api/v1/account/sessions/token-'.$otherTokenId)
        ->assertOk()
        ->assertJsonPath('message', 'Session revoked successfully.');

    expect($user->tokens()->where('id', $otherTokenId)->exists())->toBeFalse();
    expect($user->tokens()->where('id', $currentTokenId)->exists())->toBeTrue();
});
