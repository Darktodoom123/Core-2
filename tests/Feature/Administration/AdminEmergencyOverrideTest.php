<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
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

it('allows system administrator to emergency force-abort a dispatch and release all resources', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $driver = User::factory()->create();
    $driver->syncRoles([RoleName::Driver->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRANE-01',
        'name' => '50T Tadano Hydraulic Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Working,
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-EMERG-001',
        'title' => 'Structural Lift at Port Area',
        'client' => 'Harbor Corp',
        'site' => 'Manila South Harbor Berth 4',
        'priority' => DispatchPriority::Emergency,
        'status' => DispatchStatus::Working,
        'created_by' => $admin->id,
        'version' => 1,
    ]);

    // Active personnel assignment
    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $admin->id,
        'active_from' => now()->subHours(2),
    ]);

    // Active asset assignment
    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'primary_crane',
        'assigned_by' => $admin->id,
        'active_from' => now()->subHours(2),
    ]);

    // Perform emergency abort
    $response = $this->actingAs($admin)
        ->postJson("/operations/admin/dispatch-jobs/{$job->id}/emergency-abort", [
            'reason' => 'Severe thunderstorm and gale force wind warning issued by PAGASA.',
        ])
        ->assertOk();

    // Verify job status
    $refreshedJob = $job->refresh();
    expect($refreshedJob->status)->toBe(DispatchStatus::Cancelled);
    expect($refreshedJob->cancellation_reason)->toContain('EMERGENCY ADMIN OVERRIDE');
    expect($refreshedJob->cancelled_by)->toBe($admin->id);

    // Verify personnel assignment released
    $personnelAssignment = DispatchPersonnelAssignment::query()->where('dispatch_job_id', $job->id)->first();
    expect($personnelAssignment->active_until)->not->toBeNull();

    // Verify asset assignment released and asset marked Available
    $assetAssignment = DispatchAssetAssignment::query()->where('dispatch_job_id', $job->id)->first();
    expect($assetAssignment->active_until)->not->toBeNull();
    expect($asset->refresh()->status)->toBe(AssetStatus::Available);
});

it('allows system administrator to enforce safety recall lockdown on an operational asset', function (): void {
    $admin = User::factory()->create();
    $admin->syncRoles([RoleName::SystemAdministrator->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'TRUCK-99',
        'name' => 'Isuzu Heavy Articulated Prime Mover',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);

    $response = $this->actingAs($admin)
        ->postJson("/operations/admin/assets/{$asset->id}/safety-lockdown", [
            'reason' => 'Hydraulic brake line pressure loss detected during routine inspection.',
        ])
        ->assertOk();

    expect($asset->refresh()->status)->toBe(AssetStatus::Unavailable);
});

it('denies emergency overrides to unauthorized roles', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRANE-02',
        'name' => 'Liebherr 100T',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    $this->actingAs($dispatcher)
        ->postJson("/operations/admin/assets/{$asset->id}/safety-lockdown", [
            'reason' => 'Unauthorized attempt',
        ])
        ->assertForbidden();
});
