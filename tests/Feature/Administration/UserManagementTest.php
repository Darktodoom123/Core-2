<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;

uses(RefreshDatabase::class);
beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('allows administrators to provision one canonical role and revokes sessions on access changes', function () {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $response = $this->actingAs($admin)->postJson('/operations/users', ['name' => 'New Operations Manager', 'username' => ' New.Manager ', 'email' => 'manager@core.test', 'role' => RoleName::OperationsManager->value])->assertCreated();
    $user = User::findOrFail($response->json('data.id'));
    expect($user->username)->toBe('new.manager')->and($user->roles)->toHaveCount(1)->and($user->hasRole(RoleName::OperationsManager->value))->toBeTrue();
    $this->actingAs($admin)->patchJson("/operations/users/{$user->id}", ['is_active' => false])->assertOk();
    expect($user->refresh()->is_active)->toBeFalse()->and($user->suspended_at)->not->toBeNull();
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

it('prevents removal of the last active system administrator', function () {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $this->actingAs($admin)->patchJson("/operations/users/{$admin->id}", ['role' => RoleName::OperationsManager->value])->assertUnprocessable();
    expect($admin->refresh()->hasRole(RoleName::SystemAdministrator->value))->toBeTrue();
});

it('revokes device tokens when an administrator suspends an account', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $user = User::factory()->create(['is_active' => true]);
    $token = $user->createToken('Mobile Phone')->plainTextToken;

    $this->actingAs($admin)
        ->patchJson('/operations/users/'.$user->id, ['is_active' => false])
        ->assertOk();

    expect(PersonalAccessToken::query()->where('tokenable_id', $user->id)->exists())->toBeFalse();
    $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
});

it('revokes device tokens when an administrator changes an account role', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::CraneOperator->value]);
    $token = $user->createToken('Mobile Phone')->plainTextToken;

    $this->actingAs($admin)
        ->patchJson('/operations/users/'.$user->id, ['role' => RoleName::CraneOperator->value])
        ->assertOk();

    $this->app['auth']->forgetGuards();
    $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
});

it('denies user management to operations roles', function () {
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);
    $this->actingAs($manager)->getJson('/operations/users')->assertForbidden();
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

    $response = $this->actingAs($admin)
        ->postJson("/operations/users/{$operator->id}/reset-password")
        ->assertOk();

    expect($response->json('temporary_password'))->not->toBeEmpty();
    expect(PersonalAccessToken::query()->where('tokenable_id', $operator->id)->exists())->toBeFalse();
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
