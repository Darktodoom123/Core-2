<?php

use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Mail\EmailOtpMail;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Services\DeviceTrustService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Contracts\Encryption\Encrypter;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rules\Password;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('succeeds with correct current password and valid new matching password', function (): void {
    $user = User::factory()->create([
        'username' => 'pw.change.user',
        'password' => Hash::make('CurrentSecret123!'),
        'email_verified_at' => now(),
    ]);

    // Track an active web session
    $currentSessionId = 'current-session-abc';
    DB::table('sessions')->insert([
        'id' => $currentSessionId,
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'payload' => '',
        'last_activity' => time(),
    ]);

    // Another web session for the same user
    $otherSessionId = 'other-session-def';
    DB::table('sessions')->insert([
        'id' => $otherSessionId,
        'user_id' => $user->id,
        'ip_address' => '192.168.1.50',
        'user_agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        'payload' => '',
        'last_activity' => time() - 500,
    ]);

    // Seed trusted device
    $user->trustedDevices()->create([
        'device_id' => 'device-uuid-1',
        'device_label' => 'Personal Laptop',
        'device_key_hash' => hash('sha256', 'sample-trust-token'),
        'platform' => 'Windows',
        'expires_at' => now()->addDays(30),
    ]);

    // Seed pending OTP challenge
    EmailOneTimeCode::query()->create([
        'user_id' => $user->id,
        'purpose' => EmailOneTimeCode::PURPOSE_LOGIN,
        'destination_email' => $user->email,
        'code_hash' => Hash::make('123456'),
        'challenge_id' => 'pending-challenge-123',
        'expires_at' => now()->addMinutes(5),
    ]);

    $this->actingAs($user);
    session()->setId($currentSessionId);

    $response = $this->withCookie(DeviceTrustService::COOKIE_NAME, 'sample-trust-token')
        ->post('/account/password', [
            'current_password' => 'CurrentSecret123!',
            'password' => 'BrandNewStrongPass123!',
            'password_confirmation' => 'BrandNewStrongPass123!',
        ]);

    $response->assertRedirect();
    $response->assertSessionHas('status', 'Your password has been changed. All other sessions and device trust have been revoked.');
    $response->assertCookieExpired(DeviceTrustService::COOKIE_NAME);

    $user->refresh();
    expect(Hash::check('BrandNewStrongPass123!', $user->password))->toBeTrue();
    expect(Hash::check('CurrentSecret123!', $user->password))->toBeFalse();
    expect($user->remember_token)->toBeNull();

    // Trusted devices cleared
    expect($user->trustedDevices()->count())->toBe(0);

    // Pending OTP challenges cleared
    expect(EmailOneTimeCode::query()->where('user_id', $user->id)->count())->toBe(0);

    // Other session deleted from sessions table
    expect(DB::table('sessions')->where('id', $otherSessionId)->exists())->toBeFalse();

    // Current session remained tracked
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(1);

    // Audit event recorded
    $audit = AuditEvent::query()
        ->where('subject_type', $user->getMorphClass())
        ->where('subject_id', (string) $user->id)
        ->where('action', 'user.password_changed')
        ->first();
    expect($audit)->not->toBeNull();
    expect($audit->after['sessions_revoked'])->toBeTrue();
    expect($audit->after['trust_revoked'])->toBeTrue();
});

it('rejects incorrect current password and leaves user password unchanged', function (): void {
    $originalHash = Hash::make('OriginalPass123!');
    $user = User::factory()->create([
        'password' => $originalHash,
        'email_verified_at' => now(),
    ]);

    $currentSessionId = 'active-session-correct';
    DB::table('sessions')->insert([
        'id' => $currentSessionId,
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'TestBrowser',
        'payload' => '',
        'last_activity' => time(),
    ]);

    $otherSessionId = 'active-session-other';
    DB::table('sessions')->insert([
        'id' => $otherSessionId,
        'user_id' => $user->id,
        'ip_address' => '10.0.0.1',
        'user_agent' => 'OtherBrowser',
        'payload' => '',
        'last_activity' => time(),
    ]);

    $this->actingAs($user);
    session()->setId($currentSessionId);

    $response = $this->post('/account/password', [
        'current_password' => 'WrongCurrentPassword999!',
        'password' => 'NewReplacementPass123!',
        'password_confirmation' => 'NewReplacementPass123!',
    ]);

    $response->assertSessionHasErrors(['current_password']);

    $user->refresh();
    expect($user->password)->toBe($originalHash);
    expect(Hash::check('OriginalPass123!', $user->password))->toBeTrue();
    expect(Hash::check('NewReplacementPass123!', $user->password))->toBeFalse();

    // Other session was NOT deleted on failure
    expect(DB::table('sessions')->where('id', $otherSessionId)->exists())->toBeTrue();
});

it('rejects password change when required fields are missing', function (): void {
    $originalHash = Hash::make('OriginalPass123!');
    $user = User::factory()->create([
        'password' => $originalHash,
        'email_verified_at' => now(),
    ]);

    $this->actingAs($user);

    // Missing current password
    $this->post('/account/password', [
        'password' => 'NewPassword123!',
        'password_confirmation' => 'NewPassword123!',
    ])->assertSessionHasErrors(['current_password']);

    // Missing new password
    $this->post('/account/password', [
        'current_password' => 'OriginalPass123!',
    ])->assertSessionHasErrors(['password']);

    // Missing password confirmation
    $this->post('/account/password', [
        'current_password' => 'OriginalPass123!',
        'password' => 'NewPassword123!',
    ])->assertSessionHasErrors(['password']);

    $user->refresh();
    expect($user->password)->toBe($originalHash);
});

it('rejects password change when confirmation does not match', function (): void {
    $originalHash = Hash::make('OriginalPass123!');
    $user = User::factory()->create([
        'password' => $originalHash,
        'email_verified_at' => now(),
    ]);

    $this->actingAs($user);

    $this->post('/account/password', [
        'current_password' => 'OriginalPass123!',
        'password' => 'NewPassword123!',
        'password_confirmation' => 'MismatchedPassword123!',
    ])->assertSessionHasErrors(['password']);

    $user->refresh();
    expect(Hash::check('OriginalPass123!', $user->password))->toBeTrue();
});

it('rejects password change when new password is identical to current password', function (): void {
    $originalHash = Hash::make('SameOldPassword123!');
    $user = User::factory()->create([
        'password' => $originalHash,
        'email_verified_at' => now(),
    ]);

    $this->actingAs($user);

    $this->post('/account/password', [
        'current_password' => 'SameOldPassword123!',
        'password' => 'SameOldPassword123!',
        'password_confirmation' => 'SameOldPassword123!',
    ])->assertSessionHasErrors(['password']);

    $user->refresh();
    expect($user->password)->toBe($originalHash);
});

it('rejects password change when new password violates length rules', function (): void {
    $originalHash = Hash::make('OriginalPass123!');
    $user = User::factory()->create([
        'password' => $originalHash,
        'email_verified_at' => now(),
    ]);

    $this->actingAs($user);

    // Less than 8 characters
    $this->post('/account/password', [
        'current_password' => 'OriginalPass123!',
        'password' => 'Short1!',
        'password_confirmation' => 'Short1!',
    ])->assertSessionHasErrors(['password']);

    $user->refresh();
    expect($user->password)->toBe($originalHash);
});

it('allows login with new password and rejects login with old password after change', function (): void {
    Mail::fake();

    $user = User::factory()->create([
        'username' => 'crane.technician',
        'password' => Hash::make('OldPasswordPass123!'),
        'email_verified_at' => now(),
        'email_otp_enabled' => false,
        'is_active' => true,
    ]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    // 1. Change password via /account/password
    $this->actingAs($user);
    $this->post('/account/password', [
        'current_password' => 'OldPasswordPass123!',
        'password' => 'FreshNewPass987!',
        'password_confirmation' => 'FreshNewPass987!',
    ])->assertRedirect();

    // 2. Log out
    $this->post('/logout');
    $this->assertGuest();

    // 3. Attempting login with OLD password fails
    $failLogin = $this->post('/login', [
        'username' => 'crane.technician',
        'password' => 'OldPasswordPass123!',
    ]);
    $failLogin->assertSessionHasErrors(['username']);
    $this->assertGuest();

    // 4. Attempting login with NEW password succeeds (redirects to challenge because device trust was revoked)
    $successLogin = $this->post('/login', [
        'username' => 'crane.technician',
        'password' => 'FreshNewPass987!',
    ]);
    $successLogin->assertRedirect(route('login.challenge'));

    $mail = Mail::sent(EmailOtpMail::class)->first();
    expect($mail)->not->toBeNull();

    $challengeResponse = $this->post('/login/challenge', ['code' => $mail->code]);
    $challengeResponse->assertRedirect();
    $this->assertAuthenticatedAs($user);
});

it('requires authentication to update password', function (): void {
    $this->post('/account/password', [
        'current_password' => 'AnyPassword123!',
        'password' => 'NewPassword123!',
        'password_confirmation' => 'NewPassword123!',
    ])->assertRedirect(route('login'));

    $this->postJson('/account/password', [
        'current_password' => 'AnyPassword123!',
        'password' => 'NewPassword123!',
        'password_confirmation' => 'NewPassword123!',
    ])->assertUnauthorized();
});

it('blocks inactive or suspended users from updating password', function (): void {
    $user = User::factory()->create([
        'password' => Hash::make('ValidPass123!'),
        'email_verified_at' => now(),
        'is_active' => false,
        'suspended_at' => now(),
    ]);

    $this->actingAs($user);

    // JSON request gets 403 Forbidden
    $this->postJson('/account/password', [
        'current_password' => 'ValidPass123!',
        'password' => 'NewPassword123!',
        'password_confirmation' => 'NewPassword123!',
    ])->assertForbidden();

    // Web request gets redirected to login with error
    $this->post('/account/password', [
        'current_password' => 'ValidPass123!',
        'password' => 'NewPassword123!',
        'password_confirmation' => 'NewPassword123!',
    ])->assertRedirect(route('login'))->assertSessionHasErrors(['username']);
});

it('supports JSON responses when request expects JSON', function (): void {
    $user = User::factory()->create([
        'password' => Hash::make('JsonCurrent123!'),
        'email_verified_at' => now(),
    ]);

    $this->actingAs($user);

    $response = $this->postJson('/account/password', [
        'current_password' => 'JsonCurrent123!',
        'password' => 'JsonNewStrong123!',
        'password_confirmation' => 'JsonNewStrong123!',
    ]);

    $response->assertOk()
        ->assertJson([
            'message' => 'Your password has been changed. All other sessions and device trust have been revoked.',
        ]);

    $user->refresh();
    expect(Hash::check('JsonNewStrong123!', $user->password))->toBeTrue();
});

it('enforces configured password complexity rules when configured', function (): void {
    // Configure complex rules matching production requirements
    Password::defaults(fn () => Password::min(12)->mixedCase()->letters()->numbers()->symbols());

    $user = User::factory()->create([
        'password' => Hash::make('CurrentSecret123!'),
        'email_verified_at' => now(),
    ]);

    $this->actingAs($user);

    // 1. Shorter than 12 characters
    $this->post('/account/password', [
        'current_password' => 'CurrentSecret123!',
        'password' => 'Short1!Aa',
        'password_confirmation' => 'Short1!Aa',
    ])->assertSessionHasErrors(['password']);

    // 2. Missing numbers
    $this->post('/account/password', [
        'current_password' => 'CurrentSecret123!',
        'password' => 'NoNumbersHere!Aa',
        'password_confirmation' => 'NoNumbersHere!Aa',
    ])->assertSessionHasErrors(['password']);

    // 3. Missing symbols
    $this->post('/account/password', [
        'current_password' => 'CurrentSecret123!',
        'password' => 'NoSymbols12345Aa',
        'password_confirmation' => 'NoSymbols12345Aa',
    ])->assertSessionHasErrors(['password']);

    // 4. Missing uppercase
    $this->post('/account/password', [
        'current_password' => 'CurrentSecret123!',
        'password' => 'alllowercase12345!',
        'password_confirmation' => 'alllowercase12345!',
    ])->assertSessionHasErrors(['password']);

    // 5. Fully compliant password succeeds
    $this->post('/account/password', [
        'current_password' => 'CurrentSecret123!',
        'password' => 'CompliantP@ssword2026!',
        'password_confirmation' => 'CompliantP@ssword2026!',
    ])->assertSessionHasNoErrors();

    $user->refresh();
    expect(Hash::check('CompliantP@ssword2026!', $user->password))->toBeTrue();

    // Reset Password defaults callback to avoid test pollution
    Password::defaults(null);
});

it('enforces CSRF protection on password update endpoint', function (): void {
    $user = User::factory()->create([
        'password' => Hash::make('CurrentSecret123!'),
        'email_verified_at' => now(),
    ]);

    // Force PreventRequestForgery to treat the test request as a real production browser request
    $csrfMiddleware = new class($this->app, app(Encrypter::class)) extends PreventRequestForgery
    {
        protected function runningUnitTests()
        {
            return false;
        }
    };
    $this->app->instance(PreventRequestForgery::class, $csrfMiddleware);

    $this->actingAs($user);

    // Mismatched / missing CSRF token on web request redirects with session expired flash warning
    $webResponse = $this->from('/account')->post('/account/password', [
        '_token' => 'invalid-token',
        'current_password' => 'CurrentSecret123!',
        'password' => 'BrandNewStrongPass123!',
        'password_confirmation' => 'BrandNewStrongPass123!',
    ]);

    $webResponse->assertRedirect('/account');
    $webResponse->assertSessionHas('flash.message', 'Your session expired due to inactivity. Please try again.');

    // JSON request with mismatched CSRF token is similarly caught by the global 419 handler and redirected with warning
    $jsonResponse = $this->from('/account')->postJson('/account/password', [
        '_token' => 'invalid-token',
        'current_password' => 'CurrentSecret123!',
        'password' => 'BrandNewStrongPass123!',
        'password_confirmation' => 'BrandNewStrongPass123!',
    ], ['X-CSRF-TOKEN' => 'invalid-token']);

    $jsonResponse->assertRedirect('/account');
    $jsonResponse->assertSessionHas('flash.message', 'Your session expired due to inactivity. Please try again.');
});

it('throttles excessive password change requests after limit is reached', function (): void {
    $user = User::factory()->create([
        'password' => Hash::make('CurrentSecret123!'),
        'email_verified_at' => now(),
    ]);

    $this->actingAs($user);

    // Endpoint is throttled at 5 requests per minute
    for ($i = 0; $i < 5; $i++) {
        $this->post('/account/password', [
            'current_password' => 'WrongPassword!',
            'password' => 'BrandNewPass123!',
            'password_confirmation' => 'BrandNewPass123!',
        ]);
    }

    // 6th request within the minute window is throttled
    $response = $this->post('/account/password', [
        'current_password' => 'WrongPassword!',
        'password' => 'BrandNewPass123!',
        'password_confirmation' => 'BrandNewPass123!',
    ]);

    $response->assertStatus(429);
});

it('rolls back completely if database transaction encounters a failure', function (): void {
    $originalHash = Hash::make('CurrentSecret123!');
    $user = User::factory()->create([
        'username' => 'rollback.user',
        'password' => $originalHash,
        'email_verified_at' => now(),
    ]);

    // Track active session
    $sessionId = 'rollback-session-test';
    DB::table('sessions')->insert([
        'id' => $sessionId,
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Browser',
        'payload' => '',
        'last_activity' => time(),
    ]);

    // Seed trusted device
    $user->trustedDevices()->create([
        'device_id' => 'device-rollback-1',
        'device_label' => 'Rollback Device',
        'device_key_hash' => hash('sha256', 'rollback-token'),
        'platform' => 'Windows',
        'expires_at' => now()->addDays(30),
    ]);

    // Seed pending OTP
    EmailOneTimeCode::query()->create([
        'user_id' => $user->id,
        'purpose' => EmailOneTimeCode::PURPOSE_LOGIN,
        'destination_email' => $user->email,
        'code_hash' => Hash::make('123456'),
        'challenge_id' => 'rollback-challenge-123',
        'expires_at' => now()->addMinutes(5),
    ]);

    $this->actingAs($user);
    session()->setId($sessionId);

    // Simulate a failure on saving user during password update
    User::saving(function (User $model): void {
        if ($model->isDirty('password') && $model->username === 'rollback.user') {
            throw new RuntimeException('Simulated database deadlock during password update.');
        }
    });

    try {
        $this->post('/account/password', [
            'current_password' => 'CurrentSecret123!',
            'password' => 'BrandNewPass123!',
            'password_confirmation' => 'BrandNewPass123!',
        ]);
    } catch (RuntimeException $e) {
        expect($e->getMessage())->toContain('Simulated database deadlock');
    }

    $user->refresh();
    // Password was NOT changed
    expect(Hash::check('CurrentSecret123!', $user->password))->toBeTrue();
    expect(Hash::check('BrandNewPass123!', $user->password))->toBeFalse();

    // Trusted device was NOT deleted
    expect($user->trustedDevices()->count())->toBe(1);

    // OTP was NOT deleted
    expect(EmailOneTimeCode::query()->where('user_id', $user->id)->count())->toBe(1);
});

it('revokes all multiple web sessions across devices while keeping current session active', function (): void {
    $user = User::factory()->create([
        'password' => Hash::make('CurrentSecret123!'),
        'email_verified_at' => now(),
    ]);

    $currentSessionId = 'current-session-001';
    DB::table('sessions')->insert([
        'id' => $currentSessionId,
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Current Chrome',
        'payload' => '',
        'last_activity' => time(),
    ]);

    $otherSessionIds = ['other-phone-002', 'other-tablet-003', 'other-work-004'];
    foreach ($otherSessionIds as $sessId) {
        DB::table('sessions')->insert([
            'id' => $sessId,
            'user_id' => $user->id,
            'ip_address' => '10.0.0.2',
            'user_agent' => 'Other Device',
            'payload' => '',
            'last_activity' => time(),
        ]);
    }

    $this->actingAs($user);
    session()->setId($currentSessionId);

    $this->post('/account/password', [
        'current_password' => 'CurrentSecret123!',
        'password' => 'BrandNewStrongPass123!',
        'password_confirmation' => 'BrandNewStrongPass123!',
    ])->assertRedirect();

    // All 3 other sessions deleted
    expect(DB::table('sessions')->whereIn('id', $otherSessionIds)->count())->toBe(0);

    // Only current session remains
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(1);
});
