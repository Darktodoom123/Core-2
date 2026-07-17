<?php

use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);
beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('seeds the exact canonical role and permission catalog', function () {
    expect(Role::query()->pluck('name')->sort()->values()->all())->toBe(collect(RoleName::cases())->map->value->sort()->values()->all())
        ->and(Permission::query()->pluck('name')->sort()->values()->all())->toBe(collect(PermissionName::cases())->map->value->sort()->values()->all());

    foreach (RolePermissionSeeder::rolePermissions() as $role => $expected) {
        expect(Role::findByName($role)->permissions->pluck('name')->sort()->values()->all())->toBe(collect($expected)->sort()->values()->all());
    }
});

it('can safely rerun the application seeder', function () {
    $this->seed(DatabaseSeeder::class);
    $this->seed(DatabaseSeeder::class);

    expect(User::query()->where('email', 'admin@example.com')->count())->toBe(1)
        ->and(User::query()->where('email', 'admin@example.com')->firstOrFail()->hasRole(RoleName::SystemAdministrator->value))->toBeTrue();
});

it('shares server-derived role and capabilities with inertia', function () {
    $user = User::factory()->create();
    $user->syncRoles([RoleName::Dispatcher->value]);
    $this->actingAs($user)->get('/?role=administrator')->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('workspace')->where('auth.role', RoleName::Dispatcher->value)->where('auth.prototype_role', 'dispatcher')
        ->has('auth.permissions', count(RolePermissionSeeder::rolePermissions()[RoleName::Dispatcher->value])));
});
