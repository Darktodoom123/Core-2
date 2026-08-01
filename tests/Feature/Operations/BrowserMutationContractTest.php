<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function browserMutationUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

it('creates a dispatch through the browser redirect and typed flash contract', function () {
    $dispatcher = browserMutationUser(RoleName::Dispatcher);

    $this->actingAs($dispatcher)
        ->from('/')
        ->post('/operations/dispatch-jobs', [
            'reference' => 'CON-4101',
            'client' => 'Arcwell',
            'title' => 'HVAC lift',
            'site' => 'Quezon City',
            'scheduled_start' => now()->addDay()->toIso8601String(),
            'scheduled_end' => now()->addDay()->addHours(4)->toIso8601String(),
            'priority' => DispatchPriority::Routine->value,
            'requirements' => [],
        ])
        ->assertRedirect('/')
        ->assertSessionHas('flash', [
            'tone' => 'success',
            'message' => 'Dispatch CON-4101 was created.',
        ]);

    $this->assertDatabaseHas('dispatch_jobs', [
        'reference' => 'CON-4101',
        'created_by' => $dispatcher->id,
        'status' => 'draft',
    ]);
});

it('returns browser validation errors without creating a dispatch', function () {
    $dispatcher = browserMutationUser(RoleName::Dispatcher);

    $this->actingAs($dispatcher)
        ->from('/')
        ->post('/operations/dispatch-jobs', [
            'reference' => '',
            'client' => '',
            'title' => '',
            'site' => '',
            'scheduled_start' => now()->addDay()->toIso8601String(),
            'scheduled_end' => now()->toIso8601String(),
            'priority' => 'unknown',
        ])
        ->assertRedirect('/')
        ->assertSessionHasErrors([
            'reference',
            'client',
            'title',
            'site',
            'scheduled_end',
            'priority',
        ]);

    expect(DispatchJob::query()->count())->toBe(0);
});

it('forbids dispatch creation when the capability is missing', function () {
    $driver = browserMutationUser(RoleName::Driver);

    $this->actingAs($driver)
        ->post('/operations/dispatch-jobs', [
            'reference' => 'CON-4102',
            'client' => 'Arcwell',
            'title' => 'HVAC lift',
            'site' => 'Quezon City',
            'scheduled_start' => now()->addDay()->toIso8601String(),
            'scheduled_end' => now()->addDay()->addHours(4)->toIso8601String(),
            'priority' => DispatchPriority::Routine->value,
        ])
        ->assertForbidden();

    expect(DispatchJob::query()->count())->toBe(0);
});
