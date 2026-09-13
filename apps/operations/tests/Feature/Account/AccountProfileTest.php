<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Mail\EmailOtpMail;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('redirects unauthenticated users to login', function (): void {
    $this->get('/account')->assertRedirect(route('login'));
});

it('renders the account settings page with user profile data', function (): void {
    $user = User::factory()->create([
        'name' => 'Alice Operator',
        'username' => 'alice.op',
        'email' => 'alice@core.test',
        'phone' => '+15551234567',
        'email_verified_at' => now(),
    ]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    $response = $this->actingAs($user)->get('/account');
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('account')
        ->where('profile.name', 'Alice Operator')
        ->where('profile.username', 'alice.op')
        ->where('profile.email', 'alice@core.test')
        ->where('profile.phone', '+15551234567')
        ->where('profile.role', RoleName::CraneOperator->value)
        ->where('profile.account_status', 'active')
        ->where('security.email_otp_enabled', false)
    );
});

it('allows updating self-service phone number', function (): void {
    $user = User::factory()->create([
        'phone' => '+15551112222',
        'email_verified_at' => now(),
    ]);

    $this->actingAs($user)
        ->patch('/account/profile', [
            'phone' => '+15559998888',
        ])
        ->assertRedirect();

    expect($user->refresh()->phone)->toBe('+15559998888');
});

it('does not allow updating HR-managed fields through profile endpoint', function (): void {
    $user = User::factory()->create([
        'name' => 'Original Name',
        'username' => 'original.user',
        'is_active' => true,
        'email_verified_at' => now(),
    ]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    $this->actingAs($user)
        ->patch('/account/profile', [
            'name' => 'Hacked Name',
            'username' => 'hacked.user',
            'role' => RoleName::SystemAdministrator->value,
            'is_active' => false,
            'phone' => '+15550001111',
        ])
        ->assertRedirect();

    $user->refresh();
    expect($user->name)->toBe('Original Name')
        ->and($user->username)->toBe('original.user')
        ->and($user->hasRole(RoleName::CraneOperator->value))->toBeTrue()
        ->and($user->is_active)->toBeTrue()
        ->and($user->phone)->toBe('+15550001111');
});

it('supports email change flow requiring password reauthentication and new email code verification', function (): void {
    Mail::fake();

    $user = User::factory()->create([
        'email' => 'old.email@core.test',
        'password' => Hash::make('CurrentPassword123!'),
        'email_verified_at' => now(),
    ]);

    // 1. Attempt with invalid current password fails
    $this->actingAs($user)
        ->postJson('/account/email/request', [
            'current_password' => 'WrongPassword',
            'email' => 'new.email@core.test',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['current_password']);

    // 2. Valid request sends code to new email address
    $requestResponse = $this->actingAs($user)
        ->postJson('/account/email/request', [
            'current_password' => 'CurrentPassword123!',
            'email' => 'new.email@core.test',
        ])
        ->assertOk();

    $challengeId = $requestResponse->json('challenge_id');
    expect($challengeId)->not->toBeNull();

    Mail::assertSent(EmailOtpMail::class, function (EmailOtpMail $mail) {
        return $mail->hasTo('new.email@core.test')
            && $mail->purpose === EmailOneTimeCode::PURPOSE_EMAIL_CHANGE;
    });

    // 3. Verifying with incorrect code fails
    $this->actingAs($user)
        ->postJson('/account/email/verify', [
            'challenge_id' => $challengeId,
            'code' => '000000',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['code']);

    // 4. Retrieve code and verify
    $codeRecord = EmailOneTimeCode::query()
        ->where('user_id', $user->id)
        ->where('purpose', EmailOneTimeCode::PURPOSE_EMAIL_CHANGE)
        ->firstOrFail();

    // Verify atomic verification with correct code
    $mail = Mail::sent(EmailOtpMail::class)->first();
    $sentCode = $mail->code;

    $this->actingAs($user)
        ->postJson('/account/email/verify', [
            'challenge_id' => $challengeId,
            'code' => $sentCode,
        ])
        ->assertOk();

    $user->refresh();
    expect($user->email)->toBe('new.email@core.test')
        ->and($user->email_verified_at)->not->toBeNull();
});

it('rejects duplicate email in email change request', function (): void {
    User::factory()->create(['email' => 'existing@core.test']);
    $user = User::factory()->create([
        'email' => 'user@core.test',
        'password' => Hash::make('CurrentPassword123!'),
        'email_verified_at' => now(),
    ]);

    $this->actingAs($user)
        ->postJson('/account/email/request', [
            'current_password' => 'CurrentPassword123!',
            'email' => 'existing@core.test',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['email']);
});

it('provides challenge_id and status in Inertia props on email change request', function (): void {
    Mail::fake();
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'password' => Hash::make('CurrentPassword123!'),
    ]);

    $response = $this->actingAs($user)
        ->from('/account')
        ->post('/account/email/request', [
            'current_password' => 'CurrentPassword123!',
            'email' => 'brand.new@core.test',
        ]);

    $response->assertRedirect('/account');

    $pageResponse = $this->actingAs($user)->get('/account');
    $pageResponse->assertInertia(fn ($page) => $page
        ->component('account')
        ->where('challenge_id', fn ($val) => is_string($val) && ! empty($val))
    );
});
