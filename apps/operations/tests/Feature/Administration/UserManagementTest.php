<?php

use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\EmailOneTimeCode;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\TrustedDevice;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

uses(RefreshDatabase::class);
beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('creates an Operations Manager and audits account suspension', function () {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $response = $this->actingAs($admin)->postJson('/operations/users', ['name' => 'New Operations Manager', 'username' => ' New.Manager ', 'email' => 'manager@core.test', 'role' => RoleName::OperationsManager->value])->assertCreated();
    $user = User::findOrFail($response->json('data.id'));
    expect($user->username)->toBe('new.manager')->and($user->roles)->toHaveCount(1)->and($user->hasRole(RoleName::OperationsManager->value))->toBeTrue();
    $this->assertDatabaseHas('audit_events', ['actor_id' => $admin->id, 'subject_id' => $user->id, 'action' => 'user.created']);

    $operator = User::factory()->create();
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $this->actingAs($admin)->patchJson("/operations/users/{$operator->id}", ['is_active' => false])->assertOk();
    expect($operator->refresh()->is_active)->toBeFalse()->and($operator->suspended_at)->not->toBeNull();
    $accessAudit = AuditEvent::query()->where('subject_id', $operator->id)->where('action', 'user.access_updated')->firstOrFail();
    expect($accessAudit->actor_id)->toBe($admin->id)
        ->and($accessAudit->before)->toMatchArray(['role' => RoleName::CraneOperator->value, 'is_active' => true])
        ->and($accessAudit->after)->toMatchArray(['role' => RoleName::CraneOperator->value, 'is_active' => false]);
});

it('filters the account list and returns only account management fields', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $activeManager = User::factory()->create([
        'name' => 'Alicia Lane',
        'username' => 'alicia.lane',
        'email' => 'alicia.lane@core.test',
        'email_otp_enabled' => true,
    ]);
    $activeManager->syncRoles([RoleName::OperationsManager->value]);
    $suspendedManager = User::factory()->suspended()->create([
        'name' => 'Alicia Suspended',
        'username' => 'alicia.suspended',
        'email' => 'alicia.suspended@core.test',
    ]);
    $suspendedManager->syncRoles([RoleName::OperationsManager->value]);
    $otherRole = User::factory()->create([
        'name' => 'Alicia Operator',
        'username' => 'alicia.operator',
        'email' => 'alicia.operator@core.test',
    ]);
    $otherRole->syncRoles([RoleName::CraneOperator->value]);
    $activeManager->personnelCredentials()->create([
        'kind' => 'operator_certification',
        'credential_number' => 'CERT-LIST-1',
        'credential_type' => 'Operator certification',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
    ]);

    $response = $this->actingAs($admin)
        ->getJson('/operations/users?search=ALICIA&role=operations_manager&status=active')
        ->assertOk();

    expect($response->json('data.total'))->toBe(1)
        ->and($response->json('data.data.0.id'))->toBe($activeManager->id)
        ->and($response->json('data.data.0.roles.0.name'))->toBe(RoleName::OperationsManager->value)
        ->and(array_keys($response->json('data.data.0')))->toEqualCanonicalizing([
            'id', 'name', 'username', 'email', 'phone', 'is_active', 'suspended_at', 'roles',
            'email_otp_enabled',
        ]);
    expect($response->json('data.data.0.email_otp_enabled'))->toBeTrue();
    expect($response->json('active_system_administrators'))->toBe(1);
    $response->assertJsonMissingPath('data.data.0.personnel_profile')
        ->assertJsonMissingPath('data.data.0.personnel_credentials')
        ->assertJsonMissingPath('data.data.0.password');

    $this->actingAs($admin)
        ->getJson('/operations/users?search=alicia&role=operations_manager&status=suspended')
        ->assertOk()
        ->assertJsonPath('data.total', 1)
        ->assertJsonPath('data.data.0.id', $suspendedManager->id);
});

it('rejects rigger as a role filter now that the role is gone', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $this->actingAs($admin)
        ->getJson('/operations/users?role=rigger')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['role']);
});

it('paginates user accounts and preserves list filters in pagination links', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    User::factory()->count(50)->create();

    $firstPage = $this->actingAs($admin)
        ->getJson('/operations/users?status=active')
        ->assertOk();

    expect($firstPage->json('data.total'))->toBe(51)
        ->and($firstPage->json('data.per_page'))->toBe(50)
        ->and($firstPage->json('data.current_page'))->toBe(1)
        ->and($firstPage->json('data.data'))->toHaveCount(50)
        ->and($firstPage->json('data.next_page_url'))->toContain('status=active');

    $this->actingAs($admin)
        ->getJson('/operations/users?status=active&page=2')
        ->assertOk()
        ->assertJsonPath('data.current_page', 2)
        ->assertJsonPath('data.total', 51)
        ->assertJsonCount(1, 'data.data');
});

it('allows multiple accounts to hold administrator and operations manager roles', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);
    $operator = User::factory()->create();
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $newAdministrator = $this->actingAs($admin)
        ->postJson('/operations/users', [
            'name' => 'Another Administrator',
            'username' => 'another.admin',
            'email' => 'another.admin@core.test',
            'role' => RoleName::SystemAdministrator->value,
        ])
        ->assertCreated()
        ->json('data.id');

    $newManager = $this->actingAs($admin)
        ->postJson('/operations/users', [
            'name' => 'Another Manager',
            'username' => 'another.manager',
            'email' => 'another.manager@core.test',
            'role' => RoleName::OperationsManager->value,
        ])
        ->assertCreated()
        ->json('data.id');

    $this->actingAs($admin)
        ->patchJson('/operations/users/'.$operator->id, ['role' => RoleName::OperationsManager->value])
        ->assertOk()
        ->assertJsonPath('data.roles.0.name', RoleName::OperationsManager->value);

    expect(User::findOrFail($newAdministrator)->hasRole(RoleName::SystemAdministrator->value))->toBeTrue()
        ->and(User::findOrFail($newManager)->hasRole(RoleName::OperationsManager->value))->toBeTrue()
        ->and($manager->refresh()->hasRole(RoleName::OperationsManager->value))->toBeTrue()
        ->and(User::role(RoleName::SystemAdministrator->value)->count())->toBe(2)
        ->and(User::role(RoleName::OperationsManager->value)->count())->toBe(3);
});

it('allows suspension of the only active Operations Manager account', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $this->actingAs($admin)
        ->patchJson('/operations/users/'.$manager->id, ['is_active' => false])
        ->assertOk()
        ->assertJsonPath('data.is_active', false);

    expect($manager->refresh()->hasRole(RoleName::OperationsManager->value))
        ->toBeTrue()
        ->and($manager->is_active)->toBeFalse();
});

it('validates account list filters', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $this->actingAs($admin)
        ->getJson('/operations/users?role=unknown&status=disabled&search[]=invalid')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['role', 'status', 'search']);
});

it('prevents duplicate usernames after normalization', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    User::factory()->create(['username' => 'existing-user']);

    $this->actingAs($admin)
        ->postJson('/operations/users', [
            'name' => 'Duplicate User',
            'username' => ' Existing-User ',
            'email' => 'duplicate@core.test',
            'role' => RoleName::OperationsManager->value,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['username']);
});

it('rejects rigger as an account creation or role assignment', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $operator = User::factory()->create();
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $this->actingAs($admin)
        ->postJson('/operations/users', [
            'name' => 'New Rigger',
            'username' => 'new.rigger',
            'email' => 'new.rigger@core.test',
            'role' => 'rigger',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['role']);

    $this->actingAs($admin)
        ->patchJson("/operations/users/{$operator->id}", ['role' => 'rigger'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['role']);

    expect($operator->refresh()->hasRole(RoleName::CraneOperator->value))->toBeTrue();
});

it('prevents removal of the last active system administrator', function () {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $this->actingAs($admin)->patchJson("/operations/users/{$admin->id}", ['role' => RoleName::OperationsManager->value])->assertUnprocessable();
    $this->actingAs($admin)->patchJson("/operations/users/{$admin->id}", ['is_active' => false])->assertUnprocessable();
    expect($admin->refresh()->hasRole(RoleName::SystemAdministrator->value))->toBeTrue();
});

it('revokes device tokens when an administrator suspends an account', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $user = User::factory()->create(['is_active' => true]);
    $token = $user->createToken('Mobile Phone')->plainTextToken;
    $trustedDevice = TrustedDevice::query()->create([
        'user_id' => $user->id,
        'device_id' => 'suspend-device-'.$user->id,
        'device_key_hash' => hash('sha256', 'suspend-device-key'),
        'device_label' => 'Phone',
        'platform' => 'ios',
        'expires_at' => now()->addMonth(),
    ]);
    $pushToken = $user->deviceTokens()->create([
        'installation_id' => 'suspend-installation-'.$user->id,
        'token' => 'push-token-suspend-'.$user->id,
        'platform' => 'ios',
        'provider' => 'expo',
        'is_active' => true,
        'last_registered_at' => now(),
    ]);
    $sessionId = 'suspend-session-'.$user->id;
    DB::table('sessions')->insert([
        'id' => $sessionId,
        'user_id' => $user->id,
        'payload' => '',
        'last_activity' => now()->timestamp,
    ]);

    $this->actingAs($admin)
        ->patchJson('/operations/users/'.$user->id, ['is_active' => false])
        ->assertOk();

    expect(PersonalAccessToken::query()->where('tokenable_id', $user->id)->exists())->toBeFalse();
    expect(TrustedDevice::query()->whereKey($trustedDevice->id)->exists())->toBeFalse()
        ->and($pushToken->refresh()->is_active)->toBeFalse()
        ->and($pushToken->revoked_at)->not->toBeNull()
        ->and(DB::table('sessions')->where('id', $sessionId)->exists())->toBeFalse();
    $this->app['auth']->forgetGuards();
    $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
});

it('revokes device tokens when an administrator changes an account role', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::CraneOperator->value]);
    $token = $user->createToken('Mobile Phone')->plainTextToken;
    $pushToken = $user->deviceTokens()->create([
        'installation_id' => 'role-installation-'.$user->id,
        'token' => 'push-token-role-'.$user->id,
        'platform' => 'android',
        'provider' => 'expo',
        'is_active' => true,
        'last_registered_at' => now(),
    ]);

    $this->actingAs($admin)
        ->patchJson('/operations/users/'.$user->id, ['role' => RoleName::OperationsManager->value])
        ->assertOk();

    expect($pushToken->refresh()->is_active)->toBeFalse()
        ->and($pushToken->revoked_at)->not->toBeNull();
    $this->assertDatabaseHas('audit_events', [
        'actor_id' => $admin->id,
        'subject_id' => $user->id,
        'action' => 'user.access_updated',
    ]);

    $this->app['auth']->forgetGuards();
    $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
});

it('denies user management to operations roles', function () {
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);
    $this->actingAs($manager)->getJson('/operations/users')->assertForbidden();
    $this->actingAs($manager)->postJson('/operations/users', [])->assertForbidden();
    $this->actingAs($manager)->patchJson('/operations/users/1', ['is_active' => false])->assertForbidden();
    $this->actingAs($manager)->postJson('/operations/users/1/reset-password')->assertForbidden();
});

it('returns only paginated sign-in activity for the selected account to user and audit managers', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $target = User::factory()->create(['email_otp_enabled' => true]);
    $target->syncRoles([RoleName::CraneOperator->value]);
    $other = User::factory()->create();

    foreach (range(0, 11) as $index) {
        AuditEvent::query()->create([
            'actor_id' => $target->id,
            'subject_type' => $target->getMorphClass(),
            'subject_id' => (string) $target->id,
            'action' => $index % 2 === 0 ? 'user.login' : 'user.logout',
            'after' => [
                'device' => $index === 5 ? 'Safari on iOS' : 'Chrome on Windows',
                'user_agent' => $index === 5
                    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
                    : 'RAW PRIVATE USER AGENT',
                'outcome' => 'success',
            ],
            'reason' => 'PRIVATE AUDIT REASON',
            'request_id' => (string) Str::uuid(),
            'ip_address' => $index === 5 ? '1.1.1.1' : '192.0.2.'.($index + 1),
            'occurred_at' => now()->subMinutes($index),
        ]);
    }

    AuditEvent::query()->create([
        'actor_id' => $target->id,
        'subject_type' => $target->getMorphClass(),
        'subject_id' => (string) $target->id,
        'action' => 'user.password_reset',
        'occurred_at' => now(),
    ]);
    AuditEvent::query()->create([
        'actor_id' => $other->id,
        'subject_type' => $other->getMorphClass(),
        'subject_id' => (string) $other->id,
        'action' => 'user.login',
        'occurred_at' => now(),
    ]);

    $response = $this->actingAs($admin)
        ->getJson("/operations/users/{$target->id}/sign-in-activity?per_page=5&page=2")
        ->assertOk();

    expect($response->json('total'))->toBe(12)
        ->and($response->json('current_page'))->toBe(2)
        ->and($response->json('last_page'))->toBe(3)
        ->and($response->json('per_page'))->toBe(5)
        ->and($response->json('data'))->toHaveCount(5)
        ->and($response->json('data.0.event_label'))->toBe('Signed out')
        ->and($response->json('data.0.device_label'))->toBe('Safari on iOS')
        ->and($response->json('data.0.device_type'))->toBe('mobile')
        ->and($response->json('data.0.location'))->toBe('Sydney, Australia')
        ->and($response->json('data.0.ip_address'))->toBe('1.1.1.1')
        ->and($response->json('data.1.device_type'))->toBe('unknown')
        ->and(array_keys($response->json('data.0')))->toEqualCanonicalizing([
            'id', 'event_label', 'device_label', 'device_type', 'location', 'ip_address', 'occurred_at', 'occurred_at_human',
        ]);
    $response->assertJsonMissing(['RAW PRIVATE USER AGENT', 'PRIVATE AUDIT REASON'])
        ->assertJsonMissingPath('data.0.user_agent')
        ->assertJsonMissingPath('data.0.reason');

    $this->actingAs($admin)
        ->getJson("/operations/users/{$target->id}/sign-in-activity?per_page=51")
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['per_page']);
});

it('requires both user management and audit permissions to read account sign-in activity', function (): void {
    $target = User::factory()->create();
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);
    $usersOnly = User::factory()->create();
    $usersOnly->givePermissionTo(PermissionName::UsersManage->value);
    $auditOnly = User::factory()->create();
    $auditOnly->givePermissionTo(PermissionName::AuditView->value);

    $this->actingAs($manager)->getJson("/operations/users/{$target->id}/sign-in-activity")->assertForbidden();
    $this->actingAs($usersOnly)->getJson("/operations/users/{$target->id}/sign-in-activity")->assertForbidden();
    $this->actingAs($auditOnly)->getJson("/operations/users/{$target->id}/sign-in-activity")->assertForbidden();
});

it('allows administrator to generate a temporary one-time password during user provisioning', function () {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $response = $this->actingAs($admin)->postJson('/operations/users', [
        'name' => 'Field Crane Operator',
        'username' => 'crane.op1',
        'email' => 'crane.op1@core.test',
        'role' => RoleName::CraneOperator->value,
        'generate_temp_password' => true,
    ])->assertCreated();

    expect($response->json('temporary_password'))->not->toBeEmpty();
    expect(strlen($response->json('temporary_password')))->toBe(14);

    $user = User::query()->where('email', 'crane.op1@core.test')->firstOrFail();
    expect($user->email_verified_at)->not->toBeNull();
    expect($user->hasRole(RoleName::CraneOperator->value))->toBeTrue();
});

it('allows administrator to reset a user password and invalidate tokens', function () {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $operator = User::factory()->create(['email' => 'driver1@core.test']);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Field App')->plainTextToken;
    $trustedDevice = TrustedDevice::query()->create([
        'user_id' => $operator->id,
        'device_id' => 'reset-device-'.$operator->id,
        'device_key_hash' => hash('sha256', 'reset-device-key'),
        'device_label' => 'Field phone',
        'platform' => 'android',
        'expires_at' => now()->addMonth(),
    ]);
    $pushToken = $operator->deviceTokens()->create([
        'installation_id' => 'reset-installation-'.$operator->id,
        'token' => 'push-token-reset-'.$operator->id,
        'platform' => 'android',
        'provider' => 'expo',
        'is_active' => true,
        'last_registered_at' => now(),
    ]);
    $otp = EmailOneTimeCode::query()->create([
        'user_id' => $operator->id,
        'challenge_id' => 'reset-challenge-'.$operator->id,
        'purpose' => EmailOneTimeCode::PURPOSE_LOGIN,
        'code_hash' => str_repeat('a', 64),
        'expires_at' => now()->addMinutes(5),
    ]);
    $sessionId = 'reset-session-'.$operator->id;
    DB::table('sessions')->insert([
        'id' => $sessionId,
        'user_id' => $operator->id,
        'payload' => '',
        'last_activity' => now()->timestamp,
    ]);

    $response = $this->actingAs($admin)
        ->postJson("/operations/users/{$operator->id}/reset-password")
        ->assertOk();

    expect($response->json('temporary_password'))->not->toBeEmpty();
    expect(PersonalAccessToken::query()->where('tokenable_id', $operator->id)->exists())->toBeFalse();
    expect(Hash::check($response->json('temporary_password'), $operator->refresh()->password))->toBeTrue()
        ->and(TrustedDevice::query()->whereKey($trustedDevice->id)->exists())->toBeFalse()
        ->and($pushToken->refresh()->is_active)->toBeFalse()
        ->and($pushToken->revoked_at)->not->toBeNull()
        ->and(EmailOneTimeCode::query()->whereKey($otp->id)->exists())->toBeFalse()
        ->and(DB::table('sessions')->where('id', $sessionId)->exists())->toBeFalse();
    $this->assertDatabaseHas('audit_events', [
        'actor_id' => $admin->id,
        'subject_id' => $operator->id,
        'action' => 'user.password_reset',
    ]);
});

it('allows administrator to manage and delete personnel credentials with qualification tracking', function () {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::CraneOperator->value]);

    // 1. Create Credential
    $createResponse = $this->actingAs($admin)->postJson("/operations/users/{$driver->id}/credentials", [
        'kind' => 'operator_certification',
        'credential_number' => 'TESDA-CRANE-99128',
        'credential_type' => 'TESDA Heavy Crane NC II (50T+ Hydraulic)',
        'issued_at' => '2024-01-01',
        'expires_at' => now()->addDays(15)->format('Y-m-d'),
    ])->assertCreated();

    $credId = $createResponse->json('data.id');
    expect($credId)->not->toBeNull();

    // 2. Delete Credential
    $this->actingAs($admin)
        ->deleteJson("/operations/users/{$driver->id}/credentials/{$credId}")
        ->assertOk();

    expect(PersonnelCredential::find($credId))->toBeNull();
});
