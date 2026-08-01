<?php

use App\Platform\Identity\Enums\RoleName;
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
    $response = $this->actingAs($admin)->postJson('/operations/users', ['name' => 'New Dispatcher', 'email' => 'dispatcher@core.test', 'role' => RoleName::Dispatcher->value])->assertCreated();
    $user = User::findOrFail($response->json('data.id'));
    expect($user->roles)->toHaveCount(1)->and($user->hasRole(RoleName::Dispatcher->value))->toBeTrue();
    $this->actingAs($admin)->patchJson("/operations/users/{$user->id}", ['is_active' => false])->assertOk();
    expect($user->refresh()->is_active)->toBeFalse()->and($user->suspended_at)->not->toBeNull();
});

it('prevents removal of the last active system administrator', function () {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);
    $this->actingAs($admin)->patchJson("/operations/users/{$admin->id}", ['role' => RoleName::Dispatcher->value])->assertUnprocessable();
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
    $user->syncRoles([RoleName::Driver->value]);
    $token = $user->createToken('Mobile Phone')->plainTextToken;

    $this->actingAs($admin)
        ->patchJson('/operations/users/'.$user->id, ['role' => RoleName::FieldTechnician->value])
        ->assertOk();

    $this->app['auth']->forgetGuards();
    $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
});

it('denies user management to operations roles', function () {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);
    $this->actingAs($dispatcher)->getJson('/operations/users')->assertForbidden();
});
