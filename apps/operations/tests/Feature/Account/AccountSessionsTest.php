<?php

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('lists active web sessions with current device indication', function (): void {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    $otherSessionId = 'other-session-xyz';
    DB::table('sessions')->insert([
        'id' => $otherSessionId,
        'user_id' => $user->id,
        'ip_address' => '10.0.0.99',
        'user_agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
        'payload' => '',
        'last_activity' => time() - 3600,
    ]);

    $response = $this->actingAs($user)->get('/account');
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('account')
        ->has('sessions', 2)
        ->where('sessions.0.is_current', true)
        ->where('sessions.0.location', 'Local Machine (Loopback)')
        ->where('sessions.1.id', $otherSessionId)
        ->where('sessions.1.is_current', false)
        ->where('sessions.1.location', 'Local Network / Private IP')
    );
});

it('allows revoking another web session and ensures it cannot access protected routes', function (): void {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    $currentSessionId = 'active-user-session';
    DB::table('sessions')->insert([
        'id' => $currentSessionId,
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Mozilla/5.0 Chrome/120',
        'payload' => '',
        'last_activity' => time(),
    ]);

    $targetSessionId = 'session-to-revoke-777';
    DB::table('sessions')->insert([
        'id' => $targetSessionId,
        'user_id' => $user->id,
        'ip_address' => '10.0.0.2',
        'user_agent' => 'Mozilla/5.0 Safari/604.1',
        'payload' => '',
        'last_activity' => time() - 100,
    ]);

    $this->actingAs($user);
    session()->setId($currentSessionId);

    // Revoke target session
    $this->deleteJson("/account/sessions/{$targetSessionId}")
        ->assertOk();

    // Verify row was deleted from database
    expect(DB::table('sessions')->where('id', $targetSessionId)->exists())->toBeFalse();

    // Now test that a request using the revoked session is immediately denied access
    $this->withSession(['active_session_id' => $targetSessionId])
        ->get('/account')
        ->assertRedirect(route('login'));
});

it('enforces server-side session ownership and prevents cross-user session revocation', function (): void {
    $userA = User::factory()->create(['email_verified_at' => now()]);
    $userB = User::factory()->create(['email_verified_at' => now()]);

    $sessionB = 'user-b-session-999';
    DB::table('sessions')->insert([
        'id' => $sessionB,
        'user_id' => $userB->id,
        'ip_address' => '10.0.0.9',
        'user_agent' => 'Mozilla/5.0 Chrome/120',
        'payload' => '',
        'last_activity' => time(),
    ]);

    // User A tries to delete User B's session
    $this->actingAs($userA)
        ->deleteJson("/account/sessions/{$sessionB}")
        ->assertNotFound();

    // Session B still exists
    expect(DB::table('sessions')->where('id', $sessionB)->exists())->toBeTrue();
});

it('allows signing out all other sessions after reauthentication', function (): void {
    $user = User::factory()->create([
        'password' => Hash::make('MyPassword123!'),
        'email_verified_at' => now(),
    ]);

    $currentSessionId = 'my-current-session';
    DB::table('sessions')->insert([
        'id' => $currentSessionId,
        'user_id' => $user->id,
        'ip_address' => '127.0.0.1',
        'user_agent' => 'Mozilla/5.0 Chrome/120',
        'payload' => '',
        'last_activity' => time(),
    ]);

    DB::table('sessions')->insert([
        'id' => 'session-extra-1',
        'user_id' => $user->id,
        'ip_address' => '10.0.0.1',
        'user_agent' => 'Mozilla/5.0 Chrome/120',
        'payload' => '',
        'last_activity' => time(),
    ]);

    DB::table('sessions')->insert([
        'id' => 'session-extra-2',
        'user_id' => $user->id,
        'ip_address' => '10.0.0.2',
        'user_agent' => 'Mozilla/5.0 Firefox/120',
        'payload' => '',
        'last_activity' => time(),
    ]);

    $this->actingAs($user);
    session()->setId($currentSessionId);

    // Wrong password fails
    $this->postJson('/account/sessions/revoke-others', [
        'current_password' => 'WrongPassword',
    ])->assertUnprocessable()->assertJsonValidationErrors(['current_password']);

    // Correct password revokes all other sessions
    $this->postJson('/account/sessions/revoke-others', [
        'current_password' => 'MyPassword123!',
    ])->assertOk();

    expect(DB::table('sessions')->where('id', 'session-extra-1')->exists())->toBeFalse();
    expect(DB::table('sessions')->where('id', 'session-extra-2')->exists())->toBeFalse();
    expect(DB::table('sessions')->where('user_id', $user->id)->count())->toBe(1);
});

it('displays recent security activity and isolates other users events', function (): void {
    $auditRecorder = app(RecordAuditEvent::class);

    $userA = User::factory()->create(['email_verified_at' => now()]);
    $userA->syncRoles([RoleName::OperationsManager->value]);
    $userB = User::factory()->create(['email_verified_at' => now()]);

    // Record events for User A
    $auditRecorder->handle($userA, $userA, 'user.login', null, [
        'device' => 'Chrome on Windows',
        'outcome' => 'success',
    ]);
    $auditRecorder->handle($userA, $userA, 'user.email_otp_enabled', null, [
        'device' => 'Chrome on Windows',
        'outcome' => 'success',
    ]);

    // Record event for User B
    $auditRecorder->handle($userB, $userB, 'user.login', null, [
        'device' => 'Safari on macOS',
        'outcome' => 'success',
    ]);

    $this->actingAs($userA);
    $response = $this->get('/account?tab=activity');
    $response->assertOk();

    $response->assertInertia(fn ($page) => $page
        ->component('account')
        ->has('recent_activity.data', 2)
        ->where('recent_activity.data.0.action', 'user.email_otp_enabled')
        ->where('recent_activity.data.0.location', 'Local Machine (Loopback)')
        ->where('recent_activity.data.1.action', 'user.login')
    );
});

it('ensures revoked sessions cannot continue accessing modular operations routes', function (): void {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $user->syncRoles([RoleName::OperationsManager->value]);

    $revokedSessionId = 'revoked-session-xyz';
    $this->actingAs($user);

    $this->withSession(['active_session_id' => $revokedSessionId])
        ->get('/operations/dispatch-jobs')
        ->assertRedirect(route('login'));
});

it('resolves public IP address to approximate geographic location in active sessions', function (): void {
    $user = User::factory()->create(['email_verified_at' => now()]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    $publicSessionId = 'public-ip-session';
    DB::table('sessions')->insert([
        'id' => $publicSessionId,
        'user_id' => $user->id,
        'ip_address' => '8.8.8.8',
        'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0',
        'payload' => '',
        'last_activity' => time() - 60,
    ]);

    $response = $this->actingAs($user)->get('/account');
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('account')
        ->where('sessions.1.id', $publicSessionId)
        ->where('sessions.1.ip_address', '8.8.8.8')
        ->where('sessions.1.location', 'Mountain View, United States')
    );
});
