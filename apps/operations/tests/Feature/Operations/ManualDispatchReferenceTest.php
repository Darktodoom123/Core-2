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
    $user->syncRoles([RoleName::OperationsManager->value]);

    return $user;
}

function manualDispatchPayload(string $title, ?string $workStream = null, ?string $equipmentSubtype = null): array
{
    return array_filter([
        'client' => 'Reference Test Client',
        'title' => $title,
        'site' => 'Quezon City',
        'scheduled_start' => now()->addDay()->toIso8601String(),
        'scheduled_end' => now()->addDay()->addHours(4)->toIso8601String(),
        'priority' => 'routine',
        'work_stream' => $workStream,
        'equipment_subtype' => $equipmentSubtype,
        'requirements' => [
            'Require on-site ground bearing & soil stability check',
        ],
    ], fn ($v) => $v !== null);
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

it('generates stream-specific reference prefixes for service, rental, and sales work streams', function (): void {
    $dispatcher = manualReferenceDispatcher();
    $year = now()->year;

    $this->actingAs($dispatcher)
        ->post('/operations/dispatch-jobs', manualDispatchPayload('Tower crane service', 'service', 'tower_crane'))
        ->assertRedirect('/')
        ->assertSessionHas('flash.message', "Dispatch DSP-SRV-{$year}-001 was created.");

    $this->actingAs($dispatcher)
        ->post('/operations/dispatch-jobs', manualDispatchPayload('Rough terrain rental delivery', 'rental'))
        ->assertRedirect('/')
        ->assertSessionHas('flash.message', "Dispatch DSP-REN-{$year}-002 was created.");

    $this->actingAs($dispatcher)
        ->post('/operations/dispatch-jobs', manualDispatchPayload('Excavator sales transport', 'sale'))
        ->assertRedirect('/')
        ->assertSessionHas('flash.message', "Dispatch DSP-SAL-{$year}-003 was created.");

    $jobs = DispatchJob::query()->orderBy('id')->get();
    expect($jobs->pluck('reference')->all())
        ->toBe([
            "DSP-SRV-{$year}-001",
            "DSP-REN-{$year}-002",
            "DSP-SAL-{$year}-003",
        ]);

    // Check canonical handoff payload preserved work stream and equipment subtype
    $firstJob = $jobs->first();
    $firstHandoff = $firstJob->canonicalHandoff;
    expect($firstHandoff)->not->toBeNull();

    $handoffPayload = $firstHandoff->legacy_snapshot['canonical_source_payload'] ?? [];
    expect($handoffPayload['work_stream'])->toBe('service')
        ->and($handoffPayload['equipment_subtype'])->toBe('tower_crane');
});
