<?php

declare(strict_types=1);

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

test('operations manager can update planned crane slots for a dispatch job', function (): void {
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-TEST-SLOTS-001',
        'client' => 'Parklinks Ayala Land',
        'title' => 'Erection Lift Package',
        'site' => 'Parklinks Pasig Complex',
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDays(2),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $manager->id,
        'site_latitude' => null,
        'site_longitude' => null,
        'planned_crane_slots' => null,
        'version' => 1,
    ]);

    $response = $this->actingAs($manager)->patch("/operations/dispatch-jobs/{$job->id}/crane-slots", [
        'planned_crane_slots' => [
            [
                'slot_key' => 'TC-1',
                'name' => 'North Core Tower Crane',
                'required_type' => 'tower_crane',
                'jib_radius_meters' => 75,
                'site_latitude' => 14.57682,
                'site_longitude' => 121.08520,
            ],
            [
                'slot_key' => 'TC-2',
                'name' => 'South Podium Tower Crane',
                'required_type' => 'tower_crane',
                'jib_radius_meters' => 60,
                'site_latitude' => 14.57615,
                'site_longitude' => 121.08490,
            ],
        ],
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('success');

    $job->refresh();

    expect($job->planned_crane_slots)->toHaveCount(2)
        ->and($job->planned_crane_slots[0]['slot_key'])->toBe('TC-1')
        ->and($job->planned_crane_slots[0]['jib_radius_meters'])->toBe(75)
        ->and($job->planned_crane_slots[1]['slot_key'])->toBe('TC-2')
        ->and($job->planned_crane_slots[1]['jib_radius_meters'])->toBe(60)
        ->and((float) $job->site_latitude)->toEqualWithDelta(14.57682, 0.0001)
        ->and((float) $job->site_longitude)->toEqualWithDelta(121.08520, 0.0001);
});

test('validates planned crane slots input', function (): void {
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-TEST-SLOTS-002',
        'client' => 'Parklinks Ayala Land',
        'title' => 'Erection Lift Package',
        'site' => 'Parklinks Pasig Complex',
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDays(2),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $manager->id,
        'version' => 1,
    ]);

    $response = $this->actingAs($manager)->patch("/operations/dispatch-jobs/{$job->id}/crane-slots", [
        'planned_crane_slots' => [
            [
                'slot_key' => '',
                'name' => '',
                'jib_radius_meters' => 5, // below min 10
                'site_latitude' => 999, // invalid latitude
                'site_longitude' => 999, // invalid longitude
            ],
        ],
    ]);

    $response->assertSessionHasErrors([
        'planned_crane_slots.0.slot_key',
        'planned_crane_slots.0.name',
        'planned_crane_slots.0.jib_radius_meters',
        'planned_crane_slots.0.site_latitude',
        'planned_crane_slots.0.site_longitude',
    ]);
});
