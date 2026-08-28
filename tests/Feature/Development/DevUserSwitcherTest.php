<?php

use App\Platform\Identity\Models\User;
use Database\Seeders\BrowserAcceptanceSeeder;
use Database\Seeders\LocalDevelopmentSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    $this->seed(LocalDevelopmentSeeder::class);
});

it('lists only active system admin and operations manager accounts', function (): void {
    $response = $this->getJson('/dev/users')->assertOk();

    expect($response->json())->toHaveCount(2);
    expect(collect($response->json())->pluck('role_label')->sort()->values()->all())
        ->toEqual([
            'Operations Manager',
            'System Administrator',
        ]);
});

it('quick logs in allowed roles and rejects disallowed or suspended accounts', function (): void {
    $admin = User::query()->where('email', 'admin@example.com')->firstOrFail();
    $manager = User::query()->where('email', 'manager@example.com')->firstOrFail();
    $driver = User::query()->where('email', 'driver@example.com')->firstOrFail();
    $suspendedUser = User::factory()->suspended()->create();

    // Allowed accounts can quick-login
    $this->post('/dev/login/'.$admin->id)->assertRedirect(route('home'));
    $this->assertAuthenticatedAs($admin);

    $this->post('/dev/login/'.$manager->id)->assertRedirect(route('home'));
    $this->assertAuthenticatedAs($manager);

    // Non-allowed roles and suspended accounts are not in dev list
    $this->getJson('/dev/users')
        ->assertJsonMissing(['id' => $driver->id])
        ->assertJsonMissing(['id' => $suspendedUser->id]);

    // Quick login is rejected for disallowed role or suspended account
    $this->post('/dev/login/'.$driver->id)->assertNotFound();
    $this->post('/dev/login/'.$suspendedUser->id)->assertNotFound();
});

it('excludes browser test fixtures from dev quick sign-in', function (): void {
    $this->seed(BrowserAcceptanceSeeder::class);

    $response = $this->getJson('/dev/users')->assertOk();

    expect($response->json())->toHaveCount(2);
    expect(collect($response->json())->pluck('email')->sort()->values()->all())
        ->toEqual([
            'admin@example.com',
            'manager@example.com',
        ]);

    $browserManager = User::query()->where('email', 'browser.manager@example.com')->firstOrFail();
    $this->post('/dev/login/'.$browserManager->id)->assertNotFound();
});
