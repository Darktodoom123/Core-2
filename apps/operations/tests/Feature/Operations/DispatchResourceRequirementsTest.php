<?php

use App\Modules\Assignment\Queries\DispatchActivationReadinessQuery;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    $this->manager = User::factory()->create();
    $this->manager->syncRoles([RoleName::OperationsManager->value]);
});

function requirementDriver(string $name): User
{
    $driver = User::factory()->create(['name' => $name]);
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $driver->personnelCredentials()->create([
        'kind' => 'driver_license',
        'credential_number' => 'DL-'.$driver->id,
        'credential_type' => 'professional',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);

    return $driver;
}

function requirementJob(TestCase $test, User $manager, ?array $requirements = null): DispatchJob
{
    $payload = [
        'client' => 'Test Client',
        'title' => 'Manual equipment move',
        'site' => 'Batangas Port',
        'scheduled_start' => now()->addDay()->toIso8601String(),
        'scheduled_end' => now()->addDay()->addHours(4)->toIso8601String(),
        'priority' => 'routine',
        'requirements' => [],
    ];
    if ($requirements !== null) {
        $payload['resource_requirements'] = $requirements;
    }
    $test->actingAs($manager)->post('/operations/dispatch-jobs', $payload)->assertRedirect();

    return DispatchJob::query()->latest('id')->firstOrFail();
}

test('a manual dispatch without typed requirements cannot activate and can be revised with a version check', function (): void {
    $job = requirementJob($this, $this->manager);
    $driver = requirementDriver('First driver');
    $truck = OperationalAsset::query()->create([
        'code' => 'REQ-TRUCK-1',
        'name' => 'Requirements truck',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);
    clearDispatchAsset($truck);
    $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $this->manager->id,
        'active_from' => $job->scheduled_start,
    ]);
    $job->assetAssignments()->create([
        'operational_asset_id' => $truck->id,
        'assignment_type' => 'truck',
        'assigned_by' => $this->manager->id,
        'active_from' => $job->scheduled_start,
    ]);

    $readiness = app(DispatchActivationReadinessQuery::class)->make($job->load('personnelAssignments.user', 'assetAssignments.asset', 'approvals'));
    expect(implode(' ', $readiness['blockers']))->toContain('Record required crew roles and equipment types');
    $this->actingAs($this->manager)->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => $job->version])
        ->assertSessionHasErrors('resource_requirements');

    $requirements = ['personnel' => ['driver' => 2], 'assets' => ['truck' => 1]];
    $this->actingAs($this->manager)->patch("/operations/dispatch-jobs/{$job->id}/resource-requirements", [
        'version' => 99,
        'resource_requirements' => $requirements,
    ])->assertSessionHasErrors('version');
    $this->actingAs($this->manager)->patch("/operations/dispatch-jobs/{$job->id}/resource-requirements", [
        'version' => $job->version,
        'resource_requirements' => $requirements,
    ])->assertSessionHasNoErrors();

    expect($job->refresh()->resource_requirements)->toBe($requirements)
        ->and($job->version)->toBe(2);
    $this->actingAs($this->manager)->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 2])
        ->assertSessionHasErrors('resource_requirements');

    $secondDriver = requirementDriver('Second driver');
    $job->personnelAssignments()->create([
        'user_id' => $secondDriver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $this->manager->id,
        'active_from' => $job->scheduled_start,
    ]);
    $reviewer = User::factory()->create();
    $reviewer->syncRoles([RoleName::OperationsManager->value]);
    ApprovalRequest::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'kind' => 'dispatch_activation',
        'status' => ApprovalStatus::Approved,
        'requested_by' => $this->manager->id,
        'decided_by' => $reviewer->id,
        'decided_at' => now(),
        'reason' => 'Reviewed required resources',
    ]);
    $this->actingAs($this->manager)->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 2])
        ->assertSessionHasNoErrors();
    expect($job->refresh()->status)->toBe(DispatchStatus::Dispatched);
});

test('manual requirement updates validate types and reject users without dispatch update permission', function (): void {
    $job = requirementJob($this, $this->manager, ['personnel' => ['driver' => 1], 'assets' => ['truck' => 1]]);
    $this->actingAs($this->manager)->patch("/operations/dispatch-jobs/{$job->id}/resource-requirements", [
        'version' => 1,
        'resource_requirements' => ['personnel' => ['pilot' => 1], 'assets' => ['truck' => 1]],
    ])->assertSessionHasErrors();
    expect($job->refresh()->version)->toBe(1);

    $fieldUser = User::factory()->create();
    $fieldUser->syncRoles([RoleName::CraneOperator->value]);
    $this->actingAs($fieldUser)->patch("/operations/dispatch-jobs/{$job->id}/resource-requirements", [
        'version' => 1,
        'resource_requirements' => ['personnel' => ['driver' => 1], 'assets' => ['truck' => 1]],
    ])->assertForbidden();
});

test('changing an approved manual resource plan requires a new independent approval', function (): void {
    $job = requirementJob($this, $this->manager, ['personnel' => ['driver' => 1], 'assets' => ['truck' => 1]]);
    $reviewer = User::factory()->create();
    $reviewer->syncRoles([RoleName::OperationsManager->value]);
    ApprovalRequest::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'kind' => 'dispatch_activation',
        'status' => ApprovalStatus::Approved,
        'requested_by' => $this->manager->id,
        'decided_by' => $reviewer->id,
        'decided_at' => now(),
    ]);

    $this->actingAs($this->manager)->patch("/operations/dispatch-jobs/{$job->id}/resource-requirements", [
        'version' => $job->version,
        'resource_requirements' => ['personnel' => ['driver' => 2], 'assets' => ['truck' => 1]],
    ])->assertSessionHasNoErrors();

    expect($job->refresh()->version)->toBe(2)
        ->and($job->approvals()->latest('id')->firstOrFail()->status)->toBe(ApprovalStatus::Pending)
        ->and($job->approvals()->latest('id')->firstOrFail()->requested_by)->toBe($this->manager->id);
});
