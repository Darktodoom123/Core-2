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

it('lists all active seeded development role accounts', function (): void {
    $response = $this->getJson('/dev/users')->assertOk();

    expect($response->json())->toHaveCount(5);
    expect(collect($response->json())->pluck('role_label')->sort()->values()->all())
        ->toEqual([
            'Field Foreman',
            'Operations Manager',
            'Operator',
            'Safety Officer',
            'System Administrator',
        ]);
});

it('quick logs in allowed roles and rejects disallowed or suspended accounts', function (): void {
    $admin = User::query()->where('email', 'admin@example.com')->firstOrFail();
    $manager = User::query()->where('email', 'manager@example.com')->firstOrFail();
    $safetyOfficer = User::query()->where('email', 'so.morales@core2.ph')->firstOrFail();
    $foreman = User::query()->where('email', 'foreman.delacruz@core2.ph')->firstOrFail();
    $operator = User::query()->where('email', 'operator@example.com')->firstOrFail();
    $suspendedUser = User::factory()->suspended()->create();

    // All seeded role accounts can quick-login
    foreach ([$admin, $manager, $safetyOfficer, $foreman, $operator] as $user) {
        $this->post('/dev/login/'.$user->id)->assertRedirect(route('home'));
        $this->assertAuthenticatedAs($user);
    }

    // Suspended accounts are not in dev list
    $this->getJson('/dev/users')
        ->assertJsonMissing(['id' => $suspendedUser->id]);

    // Quick login is rejected for suspended account
    $this->post('/dev/login/'.$suspendedUser->id)->assertNotFound();
});

it('excludes browser test fixtures from dev quick sign-in', function (): void {
    $this->seed(BrowserAcceptanceSeeder::class);

    $response = $this->getJson('/dev/users')->assertOk();

    expect($response->json())->toHaveCount(5);
    expect(collect($response->json())->pluck('email')->sort()->values()->all())
        ->toEqual([
            'admin@example.com',
            'foreman.delacruz@core2.ph',
            'manager@example.com',
            'operator@example.com',
            'so.morales@core2.ph',
        ]);

    $browserManager = User::query()->where('email', 'browser.manager@example.com')->firstOrFail();
    $this->post('/dev/login/'.$browserManager->id)->assertNotFound();
});
