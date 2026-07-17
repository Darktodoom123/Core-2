<?php

use App\Enums\RoleName;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

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

it('denies user management to operations roles', function () {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);
    $this->actingAs($dispatcher)->getJson('/operations/users')->assertForbidden();
});
