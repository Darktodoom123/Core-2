<?php

use App\Enums\AssetStatus;
use App\Enums\DispatchPriority;
use App\Enums\DispatchStatus;
use App\Enums\RoleName;
use App\Models\ApprovalRequest;
use App\Models\DispatchJob;
use App\Models\GptRecommendation;
use App\Models\OperationalAsset;
use App\Models\PersonnelCredential;
use App\Models\PersonnelProfile;
use App\Models\User;
use App\Services\Gpt\BoundedContextBuilder;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function setupEligibleDriver(string $licenseNo = 'D-12345'): User
{
    $driver = User::factory()->create(['name' => 'John Driver', 'is_active' => true]);
    $driver->syncRoles([RoleName::Driver->value]);
    PersonnelProfile::query()->create([
        'user_id' => $driver->id,
        'availability_status' => 'available',
    ]);
    PersonnelCredential::query()->create([
        'user_id' => $driver->id,
        'kind' => 'driver_license',
        'credential_number' => $licenseNo,
        'credential_type' => 'Professional License',
        'status' => 'active',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
    ]);

    return $driver;
}

function setupEligibleTruck(string $code = 'TRK-101'): OperationalAsset
{
    $technician = User::factory()->create(['is_active' => true]);
    $truck = OperationalAsset::query()->create([
        'code' => $code,
        'name' => 'Heavy Duty Truck',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);

    $truck->inspections()->create([
        'technician_id' => $technician->id,
        'type' => 'daily_safety',
        'result' => 'passed',
        'checklist' => ['brakes' => 'ok', 'tires' => 'ok'],
        'completed_at' => now()->subDay(),
    ]);

    return $truck;
}

test('authorized dispatcher can accept valid pending gpt recommendation', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    $driver = setupEligibleDriver();
    $truck = setupEligibleTruck();

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-ACC-001',
        'client' => 'Test Client',
        'title' => 'Freight Transport',
        'site' => 'Main Yard',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => DispatchJob::class,
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Assign Driver John and Heavy Duty Truck',
            'proposed_personnel' => [
                ['user_id' => $driver->id, 'assignment_type' => 'driver'],
            ],
            'proposed_assets' => [
                ['operational_asset_id' => $truck->id, 'assignment_type' => 'truck'],
            ],
            'reasons' => ['Driver holds valid license.'],
            'assumptions' => ['Clear weather.'],
            'conflicts' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/gpt-recommendations/{$recommendation->id}/accept");

    $response->assertRedirect();
    $response->assertSessionHas('flash.success');

    $recommendation->refresh();
    expect($recommendation->status)->toBe('accepted')
        ->and($recommendation->decided_by)->toBe($dispatcher->id)
        ->and($recommendation->decided_at)->not->toBeNull();

    $this->assertDatabaseHas('dispatch_personnel_assignments', [
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
    ]);

    $this->assertDatabaseHas('dispatch_asset_assignments', [
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $truck->id,
        'assignment_type' => 'truck',
    ]);

    $this->assertDatabaseHas('audit_events', [
        'action' => 'gpt.recommendation_accepted',
        'actor_id' => $dispatcher->id,
    ]);

    $this->assertDatabaseHas('audit_events', [
        'action' => 'dispatch.resources_assigned',
        'actor_id' => $dispatcher->id,
    ]);
});

test('accepting an expired recommendation fails closed and marks status expired', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    $driver = setupEligibleDriver();
    $truck = setupEligibleTruck();

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-EXP-001',
        'client' => 'Test Client',
        'title' => 'Expired test',
        'site' => 'Yard',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => DispatchJob::class,
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Expired plan',
            'proposed_personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
            'proposed_assets' => [['operational_asset_id' => $truck->id, 'assignment_type' => 'truck']],
            'reasons' => [],
            'assumptions' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->subMinute(), // Expired 1 minute ago
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/gpt-recommendations/{$recommendation->id}/accept");

    $response->assertSessionHasErrors(['gpt']);

    $recommendation->refresh();
    expect($recommendation->status)->toBe('expired');
});

test('accepting a recommendation with stale context hash fails closed and marks status stale', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    $driver = setupEligibleDriver();
    $truck = setupEligibleTruck();

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-STL-001',
        'client' => 'Test Client',
        'title' => 'Stale test',
        'site' => 'Yard A',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => DispatchJob::class,
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'old-hash-value',
        'input_references' => ['user_ids' => [$driver->id], 'asset_ids' => [$truck->id]],
        'recommendation' => [
            'summary' => 'Stale plan',
            'proposed_personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
            'proposed_assets' => [['operational_asset_id' => $truck->id, 'assignment_type' => 'truck']],
            'reasons' => [],
            'assumptions' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/gpt-recommendations/{$recommendation->id}/accept");

    $response->assertSessionHasErrors(['gpt']);

    $recommendation->refresh();
    expect($recommendation->status)->toBe('stale');
});

test('gpt recommendation cannot bypass priority approval requirement for emergency jobs', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::Dispatcher->value]);

    $driver = setupEligibleDriver();
    $truck = setupEligibleTruck();

    $emergencyJob = DispatchJob::query()->create([
        'reference' => 'JOB-EMG-001',
        'client' => 'Emergency Corp',
        'title' => 'Emergency Response',
        'site' => 'Port Area',
        'scheduled_start' => now()->addDays(1)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(1)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Emergency, // Priority work requires independent approval
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($emergencyJob);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => DispatchJob::class,
        'subject_id' => $emergencyJob->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Emergency assignment plan',
            'proposed_personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
            'proposed_assets' => [['operational_asset_id' => $truck->id, 'assignment_type' => 'truck']],
            'reasons' => ['Emergency availability confirmed.'],
            'assumptions' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/gpt-recommendations/{$recommendation->id}/accept");

    $response->assertRedirect();
    $recommendation->refresh();
    expect($recommendation->status)->toBe('accepted');

    // Confirm that exceptional work created an ApprovalRequest in pending status for manager review
    $this->assertDatabaseHas('approval_requests', [
        'subject_type' => DispatchJob::class,
        'subject_id' => $emergencyJob->id,
        'status' => 'pending',
        'kind' => 'assignment_override',
    ]);
});
