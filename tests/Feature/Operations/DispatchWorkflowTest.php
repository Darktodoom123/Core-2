<?php

use App\Enums\ApprovalStatus;
use App\Enums\AssetStatus;
use App\Enums\DispatchPriority;
use App\Enums\DispatchStatus;
use App\Enums\RoleName;
use App\Models\ApprovalRequest;
use App\Models\DispatchJob;
use App\Models\OperationalAsset;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);
beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function operationsUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

it('lets a dispatcher create and assign a routine dispatch while preserving assigned-only scope', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $driver = operationsUser(RoleName::Driver);
    $other = operationsUser(RoleName::Driver);
    $asset = OperationalAsset::query()->create(['code' => 'TR-01', 'name' => 'Truck 01', 'kind' => 'truck', 'status' => AssetStatus::Available]);
    $response = $this->actingAs($dispatcher)->postJson('/operations/dispatch-jobs', ['reference' => 'CON-1001', 'client' => 'Arcwell', 'title' => 'HVAC lift', 'site' => 'Quezon City', 'scheduled_start' => now()->addDay(), 'scheduled_end' => now()->addDay()->addHours(4), 'priority' => DispatchPriority::Routine->value, 'requirements' => []])->assertCreated();
    $jobId = $response->json('data.id');
    $this->actingAs($dispatcher)->postJson("/operations/dispatch-jobs/{$jobId}/assignments", ['personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']], 'assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'truck']]])->assertOk();
    $this->actingAs($driver)->getJson("/operations/dispatch-jobs/{$jobId}")->assertOk();
    $this->actingAs($other)->getJson("/operations/dispatch-jobs/{$jobId}")->assertNotFound();
});

it('requires independent manager approval before a priority dispatch activates', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $manager = operationsUser(RoleName::OperationsManager);
    $job = DispatchJob::query()->create(['reference' => 'CON-2001', 'client' => 'Northline', 'title' => 'Priority lift', 'site' => 'Marikina', 'scheduled_start' => now()->addDay(), 'scheduled_end' => now()->addDay()->addHours(2), 'priority' => DispatchPriority::Priority, 'status' => DispatchStatus::Draft, 'created_by' => $dispatcher->id]);
    $approval = ApprovalRequest::query()->create(['subject_type' => DispatchJob::class, 'subject_id' => $job->id, 'kind' => 'dispatch_activation', 'status' => ApprovalStatus::Pending, 'requested_by' => $dispatcher->id]);
    $this->actingAs($dispatcher)->postJson("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])->assertUnprocessable();
    $this->actingAs($manager)->postJson("/operations/approval-requests/{$approval->id}/decision", ['status' => 'approved', 'reason' => 'Resources and timing verified'])->assertOk();
    $this->actingAs($dispatcher)->postJson("/operations/dispatch-jobs/{$job->id}/activate", ['version' => 1])->assertOk()->assertJsonPath('data.status', DispatchStatus::Dispatched->value);
});

it('blocks unsafe assets from assignment', function () {
    $dispatcher = operationsUser(RoleName::Dispatcher);
    $job = DispatchJob::query()->create(['reference' => 'CON-3001', 'client' => 'Apex', 'title' => 'Lift', 'site' => 'Pasig', 'scheduled_start' => now()->addDay(), 'scheduled_end' => now()->addDay()->addHours(2), 'priority' => DispatchPriority::Routine, 'status' => DispatchStatus::Draft, 'created_by' => $dispatcher->id]);
    $asset = OperationalAsset::query()->create(['code' => 'CR-01', 'name' => 'Crane 01', 'kind' => 'crane', 'status' => AssetStatus::UnderMaintenance]);
    $this->actingAs($dispatcher)->postJson("/operations/dispatch-jobs/{$job->id}/assignments", ['assets' => [['operational_asset_id' => $asset->id, 'assignment_type' => 'crane']]])->assertUnprocessable();
});
