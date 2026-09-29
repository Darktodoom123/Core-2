<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Mail\NewDeviceSignInMail;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\TrustedDevice;
use App\Platform\Identity\Models\User;
use App\Platform\Identity\Services\DeviceTrustService;
use App\Platform\Identity\Support\IpLocationResolver;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

const WINDOWS_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    RateLimiter::clear('otp-verify|127.0.0.1');
    Mail::fake();
});

function signInAlertUser(RoleName $role = RoleName::OperationsManager): User
{
    $user = User::factory()->create([
        'username' => 'alert.user',
        'email' => 'alert.user@example.com',
        'email_otp_enabled' => true,
        'email_verified_at' => now(),
        'is_active' => true,
    ]);
    $user->syncRoles([$role->value]);

    return $user;
}

function signInAlertChallenge(User $user, string $challengeId, string $code): void
{
    EmailOneTimeCode::create([
        'user_id' => $user->id,
        'purpose' => EmailOneTimeCode::PURPOSE_LOGIN,
        'code_hash' => hash_hmac('sha256', $code, (string) config('app.key')),
        'challenge_id' => $challengeId,
        'expires_at' => now()->addMinutes(5),
        'attempts' => 0,
        'max_attempts' => 5,
        'resend_count' => 0,
    ]);
}

function webChallengeSession(User $user, string $challengeId): array
{
    return [
        'login.two_factor' => [
            'user_id' => $user->id,
            'challenge_id' => $challengeId,
            'expires_at' => now()->addMinutes(5)->timestamp,
        ],
    ];
}

it('queues a new device alert after a web sign-in passes the email code challenge', function (): void {
    $user = signInAlertUser();
    signInAlertChallenge($user, 'ch-alert-web', '123456');

    $this->withSession(webChallengeSession($user, 'ch-alert-web'))
        ->withHeader('User-Agent', WINDOWS_CHROME_UA)
        ->post('/login/challenge', ['code' => '123456'])
        ->assertRedirect('/');

    Mail::assertQueued(NewDeviceSignInMail::class, function (NewDeviceSignInMail $mail) use ($user): bool {
        return $mail->hasTo($user->email)
            && $mail->deviceLabel === 'Chrome on Windows'
            && $mail->ipAddress === '127.0.0.1';
    });
});

it('queues a new device alert after a mobile sign-in passes the email code challenge', function (): void {
    $user = signInAlertUser();
    signInAlertChallenge($user, 'ch-alert-api', '654321');

    $this->postJson('/api/v1/auth/challenge/verify', [
        'challenge_id' => 'ch-alert-api',
        'code' => '654321',
        'device_name' => 'Pixel 9',
    ])->assertOk();

    Mail::assertQueued(NewDeviceSignInMail::class, function (NewDeviceSignInMail $mail) use ($user): bool {
        return $mail->hasTo($user->email) && $mail->deviceLabel === 'Pixel 9';
    });
});

it('does not queue an alert when the email code is wrong', function (): void {
    $user = signInAlertUser();
    signInAlertChallenge($user, 'ch-alert-wrong', '111111');

    $this->withSession(webChallengeSession($user, 'ch-alert-wrong'))
        ->post('/login/challenge', ['code' => '999999']);

    $this->assertGuest();
    Mail::assertNotQueued(NewDeviceSignInMail::class);
});

it('does not queue an alert when signing in from an already trusted device', function (): void {
    $user = signInAlertUser();
    $plainToken = 'alert-plain-trust-token-1234567890abcdef';
    TrustedDevice::create([
        'user_id' => $user->id,
        'device_id' => (string) Str::uuid(),
        'device_key_hash' => hash('sha256', $plainToken),
        'device_label' => 'Chrome on Windows',
        'platform' => 'web',
        'ip_address' => '127.0.0.1',
        'last_used_at' => now(),
        'expires_at' => now()->addDays(30),
    ]);

    $this->withCookie(DeviceTrustService::COOKIE_NAME, $plainToken)
        ->post('/login', ['username' => 'alert.user', 'password' => 'password'])
        ->assertRedirect('/');

    $this->assertAuthenticatedAs($user);
    Mail::assertNotQueued(NewDeviceSignInMail::class);
});

it('does not queue an alert for system administrators, who verify on every sign-in', function (): void {
    $user = signInAlertUser(RoleName::SystemAdministrator);
    signInAlertChallenge($user, 'ch-alert-admin', '222222');

    $this->withSession(webChallengeSession($user, 'ch-alert-admin'))
        ->post('/login/challenge', ['code' => '222222'])
        ->assertRedirect('/');

    Mail::assertNotQueued(NewDeviceSignInMail::class);
});

it('still signs the user in when the alert cannot be queued', function (): void {
    $user = signInAlertUser();
    signInAlertChallenge($user, 'ch-alert-fail', '333333');
    Mail::shouldReceive('to')->andThrow(new RuntimeException('Queue unavailable'));

    $this->withSession(webChallengeSession($user, 'ch-alert-fail'))
        ->post('/login/challenge', ['code' => '333333'])
        ->assertRedirect('/');

    $this->assertAuthenticatedAs($user);
});

it('renders the alert with the device, location, address, and what to do if it was not the user', function (): void {
    IpLocationResolver::setOverride('203.0.113.7', 'Quezon City, Philippines');

    try {
        $html = (new NewDeviceSignInMail('Chrome on Windows', '203.0.113.7', now()))->render();
    } finally {
        IpLocationResolver::clearOverrides();
    }

    expect($html)
        ->toContain('Chrome on Windows')
        ->toContain('Quezon City, Philippines')
        ->toContain('203.0.113.7')
        ->toContain('Change your password');
});

it('leaves out the location row when the address cannot be located', function (): void {
    $html = (new NewDeviceSignInMail('Chrome on Windows', '203.0.113.7', now()))->render();

    expect($html)
        ->not->toContain('Location')
        ->toContain('203.0.113.7');
});
