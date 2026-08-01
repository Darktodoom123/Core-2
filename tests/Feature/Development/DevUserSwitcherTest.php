<?php

use App\Platform\Identity\Models\User;
use Database\Seeders\LocalDevelopmentSeeder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    $this->seed(LocalDevelopmentSeeder::class);
});

it('lists active local accounts with their operational role labels', function (): void {
    $response = $this->getJson('/dev/users')->assertOk();

    expect($response->json())->toHaveCount(5);
    expect(collect($response->json())->pluck('role_label')->sort()->values()->all())
        ->toEqual([
            'Crane Operator',
            'Dispatcher',
            'Driver',
            'Field Technician',
            'Operations Manager',
        ]);
});

it('quick logs in active accounts and excludes suspended accounts', function (): void {
    $user = User::query()->where('email', 'dispatcher@example.com')->firstOrFail();
    $suspendedUser = User::factory()->suspended()->create();

    $this->post('/dev/login/'.$user->id)
        ->assertRedirect(route('home'));

    $this->assertAuthenticatedAs($user);
    $this->getJson('/dev/users')->assertJsonMissing(['id' => $suspendedUser->id]);

    $this->post('/dev/login/'.$suspendedUser->id)->assertNotFound();
});
