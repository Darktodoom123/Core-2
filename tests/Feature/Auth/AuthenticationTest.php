<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('redirects guests to the internal login page', function () {
    $this->get('/')->assertRedirect(route('login'));
    $this->get(route('login'))->assertOk();
});

it('authenticates an active verified user', function () {
    $user = User::factory()->create(['email' => 'dispatcher@example.com']);
    $user->syncRoles([RoleName::Dispatcher->value]);
    $this->post('/login', ['email' => $user->email, 'password' => 'password'])->assertRedirect('/');
    $this->assertAuthenticatedAs($user);
});

it('rejects a suspended account', function () {
    $user = User::factory()->suspended()->create();
    $this->post('/login', ['email' => $user->email, 'password' => 'password'])->assertSessionHasErrors('email');
    $this->assertGuest();
});

it('logs out and invalidates the authenticated session', function () {
    $this->actingAs(User::factory()->create())->post('/logout')->assertRedirect(route('login'));
    $this->assertGuest();
});
