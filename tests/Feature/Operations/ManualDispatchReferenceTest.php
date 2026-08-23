<?php

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function manualReferenceDispatcher(): User
{
    $user = User::factory()->create();
    $user->syncRoles([RoleName::Dispatcher->value]);

    return $user;
}

function manualDispatchPayload(string $title): array
{
    return [
        'client' => 'Reference Test Client',
        'title' => $title,
        'site' => 'Quezon City',
        'scheduled_start' => now()->addDay()->toIso8601String(),
        'scheduled_end' => now()->addDay()->addHours(4)->toIso8601String(),
        'priority' => 'routine',
        'requirements' => [],
    ];
}

it('generates sequential manual dispatch references when the form omits one', function (): void {
    $dispatcher = manualReferenceDispatcher();
    $year = now()->year;

    $this->actingAs($dispatcher)
        ->post('/operations/dispatch-jobs', manualDispatchPayload('First manual dispatch'))
        ->assertRedirect('/')
        ->assertSessionHas('flash.message', "Dispatch DSP-MAN-{$year}-001 was created.");

    $this->actingAs($dispatcher)
        ->post('/operations/dispatch-jobs', manualDispatchPayload('Second manual dispatch'))
        ->assertRedirect('/')
        ->assertSessionHas('flash.message', "Dispatch DSP-MAN-{$year}-002 was created.");

    expect(DispatchJob::query()->orderBy('id')->pluck('reference')->all())
        ->toBe([
            "DSP-MAN-{$year}-001",
            "DSP-MAN-{$year}-002",
        ]);
});
