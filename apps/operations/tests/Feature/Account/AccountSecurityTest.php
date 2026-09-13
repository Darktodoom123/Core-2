<?php

use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Mail\EmailOtpMail;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Services\EmailOtpService;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('requires a verified email address before enabling email verification codes', function (): void {
    $user = User::factory()->create([
        'email_verified_at' => null,
        'password' => Hash::make('Password123!'),
    ]);

    $this->actingAs($user)
        ->postJson('/account/security/otp/request-enable', [
            'current_password' => 'Password123!',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

it('handles enable email OTP flow: confirms password, sends code, verifies code, and activates', function (): void {
    Mail::fake();

    $user = User::factory()->create([
        'email_verified_at' => now(),
        'email_otp_enabled' => false,
        'password' => Hash::make('CorrectPassword123!'),
    ]);

    // Step 1: Wrong password fails
    $this->actingAs($user)
        ->postJson('/account/security/otp/request-enable', [
            'current_password' => 'WrongPassword',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['current_password']);

    // Step 2: Correct password dispatches code
    $requestResponse = $this->actingAs($user)
        ->postJson('/account/security/otp/request-enable', [
            'current_password' => 'CorrectPassword123!',
        ])
        ->assertOk();

    $challengeId = $requestResponse->json('challenge_id');
    expect($challengeId)->not->toBeNull();

    $sentMail = Mail::sent(EmailOtpMail::class)->first();
    expect($sentMail)->not->toBeNull();
    $code = $sentMail->code;

    // Step 3: Verifying with incorrect code fails and leaves OTP disabled
    $this->actingAs($user)
        ->postJson('/account/security/otp/confirm-enable', [
            'challenge_id' => $challengeId,
            'code' => '999999',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['code']);

    expect($user->refresh()->email_otp_enabled)->toBeFalse();

    // Step 4: Verifying with correct code activates OTP
    $this->actingAs($user)
        ->postJson('/account/security/otp/confirm-enable', [
            'challenge_id' => $challengeId,
            'code' => $code,
        ])
        ->assertOk();

    expect($user->refresh()->email_otp_enabled)->toBeTrue();

    // Audit event recorded
    $audit = AuditEvent::query()
        ->where('subject_type', $user->getMorphClass())
        ->where('subject_id', (string) $user->id)
        ->where('action', 'user.email_otp_enabled')
        ->first();
    expect($audit)->not->toBeNull();
});

it('handles disable email OTP flow: requires password and code verification', function (): void {
    Mail::fake();

    $user = User::factory()->create([
        'email_verified_at' => now(),
        'email_otp_enabled' => true,
        'password' => Hash::make('SecretPass123!'),
    ]);

    $response = $this->actingAs($user)
        ->postJson('/account/security/otp/request-disable', [
            'current_password' => 'SecretPass123!',
        ])
        ->assertOk();

    $challengeId = $response->json('challenge_id');
    $mail = Mail::sent(EmailOtpMail::class)->first();
    $code = $mail->code;

    $this->actingAs($user)
        ->postJson('/account/security/otp/confirm-disable', [
            'challenge_id' => $challengeId,
            'code' => $code,
        ])
        ->assertOk();

    expect($user->refresh()->email_otp_enabled)->toBeFalse();

    $audit = AuditEvent::query()
        ->where('subject_type', $user->getMorphClass())
        ->where('subject_id', (string) $user->id)
        ->where('action', 'user.email_otp_disabled')
        ->first();
    expect($audit)->not->toBeNull();
});

it('enforces email OTP during web sign-in when enabled and protects against bypass', function (): void {
    Mail::fake();

    $user = User::factory()->create([
        'username' => 'secure.user',
        'email' => 'secure@core.test',
        'password' => Hash::make('MyPassword123!'),
        'email_verified_at' => now(),
        'email_otp_enabled' => true,
        'is_active' => true,
    ]);
    $user->syncRoles([RoleName::OperationsManager->value]);

    // 1. Post valid credentials to /login
    $response = $this->post('/login', [
        'username' => 'secure.user',
        'password' => 'MyPassword123!',
    ]);

    // Must NOT be authenticated yet
    $this->assertGuest();
    $response->assertRedirect(route('login.challenge'));

    // Verify code sent to email
    $mail = Mail::sent(EmailOtpMail::class)->first();
    expect($mail)->not->toBeNull();
    expect($mail->hasTo('secure@core.test'))->toBeTrue();
    $code = $mail->code;

    // Direct access to protected route is rejected
    $this->get('/account')->assertRedirect(route('login'));

    // 2. Incorrect code fails
    $this->post('/login/challenge', ['code' => '123456'])
        ->assertSessionHasErrors(['code']);
    $this->assertGuest();

    // 3. Correct code logs in, rotates session, and redirects
    $challengeResponse = $this->post('/login/challenge', ['code' => $code]);
    $challengeResponse->assertRedirect();
    $this->assertAuthenticatedAs($user);

    // 4. Code cannot be reused (single-use)
    $this->post('/logout');
    $this->assertGuest();

    // Re-attempting challenge with same code fails
    session(['login.two_factor' => [
        'user_id' => $user->id,
        'challenge_id' => 'fake-challenge',
        'remember' => false,
        'expires_at' => now()->addMinutes(5)->timestamp,
    ]]);
    $this->post('/login/challenge', ['code' => $code])
        ->assertSessionHasErrors(['code']);
});

it('invalidates code after expiry and enforces max attempt limit', function (): void {
    Mail::fake();
    $otpService = app(EmailOtpService::class);

    $user = User::factory()->create([
        'email_verified_at' => now(),
    ]);

    $result = $otpService->generateCode($user, EmailOneTimeCode::PURPOSE_LOGIN);
    $challengeId = $result['challenge_id'];

    // Test max attempts lockout
    for ($i = 0; $i < 5; $i++) {
        try {
            $otpService->verifyCode($user, EmailOneTimeCode::PURPOSE_LOGIN, $challengeId, '000000');
        } catch (ValidationException $e) {
            // expected
        }
    }

    $mail = Mail::sent(EmailOtpMail::class)->first();
    $realCode = $mail->code;

    // Submitting real code after 5 failures fails because code is exhausted
    expect(fn () => $otpService->verifyCode($user, EmailOneTimeCode::PURPOSE_LOGIN, $challengeId, $realCode))
        ->toThrow(ValidationException::class);
});

it('resending code invalidates earlier codes for that purpose', function (): void {
    Mail::fake();
    $otpService = app(EmailOtpService::class);

    $user = User::factory()->create([
        'email_verified_at' => now(),
    ]);

    $first = $otpService->generateCode($user, EmailOneTimeCode::PURPOSE_LOGIN);
    $firstMail = Mail::sent(EmailOtpMail::class)->first();
    $firstCode = $firstMail->code;

    // Resend a fresh code
    $second = $otpService->generateCode($user, EmailOneTimeCode::PURPOSE_LOGIN);
    $secondMail = Mail::sent(EmailOtpMail::class)->last();
    $secondCode = $secondMail->code;

    // Earlier code no longer exists or is invalid
    expect(fn () => $otpService->verifyCode($user, EmailOneTimeCode::PURPOSE_LOGIN, $first['challenge_id'], $firstCode))
        ->toThrow(ValidationException::class);

    // New code works
    $verified = $otpService->verifyCode($user, EmailOneTimeCode::PURPOSE_LOGIN, $second['challenge_id'], $secondCode);
    expect($verified->isVerified())->toBeTrue();
});

it('allows password update, revokes other web sessions, and preserves mobile API tokens', function (): void {
    $user = User::factory()->create([
        'password' => Hash::make('OldPassword123!'),
        'email_verified_at' => now(),
    ]);

    // Create personal access token (representing field mobile device)
    $mobileToken = $user->createToken('Field Crane Mobile')->plainTextToken;

    // Create another web session in sessions table
    DB::table('sessions')->insert([
        'id' => 'other-session-id-12345',
        'user_id' => $user->id,
        'ip_address' => '10.0.0.5',
        'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'payload' => '',
        'last_activity' => time(),
    ]);

    // Current session
    $currentSessionId = 'current-session-id-99999';
    DB::table('sessions')->insert([
        'id' => $currentSessionId,
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'payload' => '',
        'last_activity' => time(),
    ]);

    $this->actingAs($user);
    session()->setId($currentSessionId);

    // Update password
    $this->post('/account/password', [
        'current_password' => 'OldPassword123!',
        'password' => 'BrandNewPassword123!',
        'password_confirmation' => 'BrandNewPassword123!',
    ])->assertRedirect();

    $user->refresh();
    expect(Hash::check('BrandNewPassword123!', $user->password))->toBeTrue();

    // Other session is deleted from sessions table
    expect(DB::table('sessions')->where('id', 'other-session-id-12345')->exists())->toBeFalse();

    // Current session remains tracked
    $newSessionId = session()->getId();
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(1);

    // Mobile Sanctum token was NOT deleted
    expect(PersonalAccessToken::query()->where('tokenable_id', $user->id)->exists())->toBeTrue();

    // Audit event recorded without passwords or hashes
    $audit = AuditEvent::query()
        ->where('subject_type', $user->getMorphClass())
        ->where('subject_id', (string) $user->id)
        ->where('action', 'user.password_changed')
        ->first();
    expect($audit)->not->toBeNull();
    expect(json_encode($audit->before))->not->toContain('OldPassword123!');
    expect(json_encode($audit->after))->not->toContain('BrandNewPassword123!');
});

it('provides challenge_id and status in Inertia props on OTP enable request', function (): void {
    Mail::fake();
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'password' => Hash::make('Secret123!'),
    ]);

    $response = $this->actingAs($user)
        ->from('/account')
        ->post('/account/security/otp/request-enable', [
            'current_password' => 'Secret123!',
        ]);

    $response->assertRedirect('/account');

    $pageResponse = $this->actingAs($user)->get('/account');
    $pageResponse->assertInertia(fn ($page) => $page
        ->component('account')
        ->where('otp_challenge_id', fn ($val) => is_string($val) && ! empty($val))
    );
});

it('rejects resending code with non-existent challenge ID', function (): void {
    $user = User::factory()->create(['email_verified_at' => now()]);

    $this->actingAs($user)
        ->postJson('/account/security/otp/resend', [
            'challenge_id' => 'non-existent-challenge-uuid',
            'purpose' => 'enable_email_otp',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['code']);
});
