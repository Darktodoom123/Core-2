<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\ViewModels\DispatchFieldProgressionViewModel;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

test('operational asset correctly identifies stationary vs moving machinery', function () {
    $mobileCrane = OperationalAsset::query()->create([
        'code' => 'CRN-55T',
        'name' => '55T Mobile Hydraulic Crane',
        'kind' => 'crane',
        'subtype' => 'All-Terrain',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $towerCrane = OperationalAsset::query()->create([
        'code' => 'TWR-385',
        'name' => 'Potain Topless Tower Crane',
        'kind' => 'equipment',
        'subtype' => 'Topless Tower Crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $constructionHoist = OperationalAsset::query()->create([
        'code' => 'HST-01',
        'name' => 'Alimak Construction Hoist',
        'kind' => 'equipment',
        'subtype' => 'Passenger Hoist',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    expect($mobileCrane->isStationary())->toBeFalse()
        ->and($mobileCrane->requiresRoadTransit())->toBeTrue()
        ->and($towerCrane->isStationary())->toBeTrue()
        ->and($towerCrane->requiresRoadTransit())->toBeFalse()
        ->and($constructionHoist->isStationary())->toBeTrue()
        ->and($constructionHoist->requiresRoadTransit())->toBeFalse();
});

test('dispatch field progression view model adapts workflow and messages for mobile vs tower crane', function () {
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $mobileCrane = OperationalAsset::query()->create([
        'code' => 'CRN-80T',
        'name' => '80T Rough-Terrain Crane',
        'kind' => 'crane',
        'subtype' => 'Rough-Terrain',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    $towerCrane = OperationalAsset::query()->create([
        'code' => 'TWR-100',
        'name' => 'Potain MCT385 Tower Crane',
        'kind' => 'crane',
        'subtype' => 'Topless Tower Crane',
        'status' => AssetStatus::ReadyForService->value,
    ]);

    // 1. Mobile Crane Job
    $mobileJob = DispatchJob::query()->create([
        'reference' => 'JOB-MOBILE-01',
        'client' => 'Acme Builders',
        'title' => 'Precast Beam Erection',
        'site' => 'BGC Taguig Site',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Accepted,
        'created_by' => $manager->id,
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $mobileJob->id,
        'operational_asset_id' => $mobileCrane->id,
        'assignment_type' => 'crane',
        'assigned_by' => $manager->id,
    ]);

    $mobilePayload = DispatchFieldProgressionViewModel::make($mobileJob);
    expect($mobilePayload['machinery_workflow'])->toBe('mobile_transit')
        ->and($mobilePayload['next']['confirmation_message'])->toContain('Heavy route corridor guidance');

    // 2. Tower Crane Job
    $towerJob = DispatchJob::query()->create([
        'reference' => 'JOB-TOWER-01',
        'client' => 'Megawide Construction',
        'title' => 'High-Rise Superstructure Lift',
        'site' => 'Ortigas Center Tower 2',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Accepted,
        'created_by' => $manager->id,
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $towerJob->id,
        'operational_asset_id' => $towerCrane->id,
        'assignment_type' => 'crane',
        'assigned_by' => $manager->id,
    ]);

    $towerPayload = DispatchFieldProgressionViewModel::make($towerJob);
    expect($towerPayload['machinery_workflow'])->toBe('tower_crane_site')
        ->and($towerPayload['next']['confirmation_message'])->toContain('Perform pre-climb inspection');
});
