<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\PersonnelProfile;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function setupEligibleDriver(string $licenseNo = 'D-12345'): User
{
    $driver = User::factory()->create(['name' => 'John Driver', 'is_active' => true]);
    $driver->syncRoles([RoleName::CraneOperator->value]);
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
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

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
    $rebuiltContext = $contextBuilder->buildForDispatchJob($job->fresh());

    expect($rebuiltContext['context'])->toEqual($contextData['context']);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
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
    expect($recommendation->status->value)->toBe('accepted')
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
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

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
        'subject_type' => (new DispatchJob)->getMorphClass(),
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
    expect($recommendation->status->value)->toBe('expired');
});

test('accepting a recommendation with stale context hash fails closed and marks status stale', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

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
        'subject_type' => (new DispatchJob)->getMorphClass(),
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
    expect($recommendation->status->value)->toBe('stale');
});

test('gpt recommendation cannot bypass priority approval requirement for emergency jobs', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

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
        'subject_type' => (new DispatchJob)->getMorphClass(),
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
    expect($recommendation->status->value)->toBe('accepted');

    // Confirm that exceptional work created an ApprovalRequest in pending status for manager review
    $this->assertDatabaseHas('approval_requests', [
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $emergencyJob->id,
        'status' => 'pending',
        'kind' => 'assignment_override',
    ]);
});

it('accepts a recommendation when proposed_assets uses asset_id key', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = setupEligibleDriver();
    $truck = setupEligibleTruck();

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-REC-NORM-01',
        'client' => 'Norm Corp',
        'title' => 'Standard Haul',
        'site' => 'Yard 1',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
        'version' => 1,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Standard assignment plan with asset_id key',
            'proposed_personnel' => [['user_id' => $driver->id, 'assignment_type' => 'driver']],
            'proposed_assets' => [['asset_id' => $truck->id, 'assignment_type' => 'truck']],
            'reasons' => ['Asset ready.'],
            'assumptions' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->actingAs($dispatcher)->post("/operations/gpt-recommendations/{$recommendation->id}/accept");

    $response->assertRedirect();
    $recommendation->refresh();
    expect($recommendation->status->value)->toBe('accepted');

    $this->assertDatabaseHas('dispatch_asset_assignments', [
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $truck->id,
    ]);
});

test('authorized dispatcher can accept granular subset of proposed personnel and assets', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver1 = setupEligibleDriver('D-11111');
    $driver2 = setupEligibleDriver('D-22222');
    $truck1 = setupEligibleTruck('TRK-201');
    $truck2 = setupEligibleTruck('TRK-202');

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-MODULAR-01',
        'client' => 'Modular Client',
        'title' => 'Modular Dispatch',
        'site' => 'Site Alpha',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Assign 2 drivers and 2 trucks',
            'proposed_personnel' => [
                ['user_id' => $driver1->id, 'assignment_type' => 'driver'],
                ['user_id' => $driver2->id, 'assignment_type' => 'driver'],
            ],
            'proposed_assets' => [
                ['operational_asset_id' => $truck1->id, 'assignment_type' => 'truck'],
                ['operational_asset_id' => $truck2->id, 'assignment_type' => 'truck'],
            ],
            'reasons' => ['Qualified crew and fleet available.'],
            'assumptions' => [],
            'conflicts' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    // Dispatcher selects only driver1 and truck2
    $response = $this->actingAs($dispatcher)->post(
        "/operations/gpt-recommendations/{$recommendation->id}/accept",
        [
            'selected_personnel_ids' => [$driver1->id],
            'selected_asset_ids' => [$truck2->id],
        ]
    );

    $response->assertRedirect();
    $response->assertSessionHas('flash.success');

    $recommendation->refresh();
    expect($recommendation->status->value)->toBe('accepted')
        ->and($recommendation->decided_by)->toBe($dispatcher->id);

    // Selected driver1 and truck2 ARE assigned
    $this->assertDatabaseHas('dispatch_personnel_assignments', [
        'dispatch_job_id' => $job->id,
        'user_id' => $driver1->id,
    ]);
    $this->assertDatabaseHas('dispatch_asset_assignments', [
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $truck2->id,
    ]);

    // Unselected driver2 and truck1 are NOT assigned
    $this->assertDatabaseMissing('dispatch_personnel_assignments', [
        'dispatch_job_id' => $job->id,
        'user_id' => $driver2->id,
    ]);
    $this->assertDatabaseMissing('dispatch_asset_assignments', [
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $truck1->id,
    ]);

    $this->assertDatabaseHas('audit_events', [
        'action' => 'gpt.recommendation_accepted',
        'actor_id' => $dispatcher->id,
    ]);

    $audit = AuditEvent::query()
        ->where('action', 'gpt.recommendation_accepted')
        ->where('actor_id', $dispatcher->id)
        ->latest('id')
        ->first();

    expect($audit)->not->toBeNull()
        ->and($audit->after['personnel_count'])->toBe(1)
        ->and($audit->after['assets_count'])->toBe(1);
});

test('accepting with subset can select personnel only and deselect all assets', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = setupEligibleDriver('D-33333');
    $truck = setupEligibleTruck('TRK-301');

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-MODULAR-02',
        'client' => 'Client Bravo',
        'title' => 'Crew Only Dispatch',
        'site' => 'Site Bravo',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Assign driver and truck',
            'proposed_personnel' => [
                ['user_id' => $driver->id, 'assignment_type' => 'driver'],
            ],
            'proposed_assets' => [
                ['operational_asset_id' => $truck->id, 'assignment_type' => 'truck'],
            ],
            'reasons' => [],
            'assumptions' => [],
            'conflicts' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->actingAs($dispatcher)->post(
        "/operations/gpt-recommendations/{$recommendation->id}/accept",
        [
            'selected_personnel_ids' => [$driver->id],
            'selected_asset_ids' => [],
        ]
    );

    $response->assertRedirect();
    $recommendation->refresh();
    expect($recommendation->status->value)->toBe('accepted');

    $this->assertDatabaseHas('dispatch_personnel_assignments', [
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
    ]);
    $this->assertDatabaseMissing('dispatch_asset_assignments', [
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $truck->id,
    ]);
});

test('accepting with unproposed resource id fails validation', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = setupEligibleDriver('D-44444');
    $truck = setupEligibleTruck('TRK-401');

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-MODULAR-03',
        'client' => 'Client Charlie',
        'title' => 'Invalid ID Test',
        'site' => 'Site Charlie',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Plan',
            'proposed_personnel' => [
                ['user_id' => $driver->id, 'assignment_type' => 'driver'],
            ],
            'proposed_assets' => [
                ['operational_asset_id' => $truck->id, 'assignment_type' => 'truck'],
            ],
            'reasons' => [],
            'assumptions' => [],
            'conflicts' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    // Attempt to inject an unproposed personnel ID 99999
    $response = $this->actingAs($dispatcher)->post(
        "/operations/gpt-recommendations/{$recommendation->id}/accept",
        [
            'selected_personnel_ids' => [99999],
            'selected_asset_ids' => [$truck->id],
        ]
    );

    $response->assertSessionHasErrors(['selected_personnel_ids']);

    $recommendation->refresh();
    expect($recommendation->status->value)->toBe('pending_review');
    $this->assertDatabaseMissing('dispatch_personnel_assignments', ['dispatch_job_id' => $job->id]);
    $this->assertDatabaseMissing('dispatch_asset_assignments', ['dispatch_job_id' => $job->id]);
});

test('submitting empty selections when proposal had resources fails validation', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = setupEligibleDriver('D-55555');
    $truck = setupEligibleTruck('TRK-501');

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-MODULAR-04',
        'client' => 'Client Delta',
        'title' => 'Empty Selection Test',
        'site' => 'Site Delta',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Plan',
            'proposed_personnel' => [
                ['user_id' => $driver->id, 'assignment_type' => 'driver'],
            ],
            'proposed_assets' => [
                ['operational_asset_id' => $truck->id, 'assignment_type' => 'truck'],
            ],
            'reasons' => [],
            'assumptions' => [],
            'conflicts' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->actingAs($dispatcher)->post(
        "/operations/gpt-recommendations/{$recommendation->id}/accept",
        [
            'selected_personnel_ids' => [],
            'selected_asset_ids' => [],
        ]
    );

    $response->assertSessionHasErrors(['resources']);
    $recommendation->refresh();
    expect($recommendation->status->value)->toBe('pending_review');
});

test('submitting empty personnel selection when only personnel was proposed fails validation with resources error', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = setupEligibleDriver('D-66666');

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-MODULAR-05',
        'client' => 'Client Echo',
        'title' => 'Crew Only Empty Test',
        'site' => 'Site Echo',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Assign driver only',
            'proposed_personnel' => [
                ['user_id' => $driver->id, 'assignment_type' => 'driver'],
            ],
            'proposed_assets' => [],
            'reasons' => [],
            'assumptions' => [],
            'conflicts' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->actingAs($dispatcher)->post(
        "/operations/gpt-recommendations/{$recommendation->id}/accept",
        [
            'selected_personnel_ids' => [],
        ]
    );

    $response->assertSessionHasErrors(['resources']);
    $recommendation->refresh();
    expect($recommendation->status->value)->toBe('pending_review');
});

test('accepting with alternative personnel and assets payload arrays of objects assigns selected resources', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver1 = setupEligibleDriver('D-77771');
    $driver2 = setupEligibleDriver('D-77772');
    $truck = setupEligibleTruck('TRK-701');

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-MODULAR-06',
        'client' => 'Client Foxtrot',
        'title' => 'Alternative Payload Test',
        'site' => 'Site Foxtrot',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Assign two drivers and one truck',
            'proposed_personnel' => [
                ['user_id' => $driver1->id, 'assignment_type' => 'driver'],
                ['user_id' => $driver2->id, 'assignment_type' => 'driver'],
            ],
            'proposed_assets' => [
                ['operational_asset_id' => $truck->id, 'assignment_type' => 'truck'],
            ],
            'reasons' => [],
            'assumptions' => [],
            'conflicts' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    // Submit alternative object array structure selecting only driver2 and truck
    $response = $this->actingAs($dispatcher)->post(
        "/operations/gpt-recommendations/{$recommendation->id}/accept",
        [
            'personnel' => [
                ['user_id' => $driver2->id],
            ],
            'assets' => [
                ['operational_asset_id' => $truck->id],
            ],
        ]
    );

    $response->assertSessionHasNoErrors();
    $response->assertRedirect();
    $recommendation->refresh();
    expect($recommendation->status->value)->toBe('accepted');

    $this->assertDatabaseHas('dispatch_personnel_assignments', [
        'dispatch_job_id' => $job->id,
        'user_id' => $driver2->id,
    ]);
    $this->assertDatabaseMissing('dispatch_personnel_assignments', [
        'dispatch_job_id' => $job->id,
        'user_id' => $driver1->id,
    ]);
    $this->assertDatabaseHas('dispatch_asset_assignments', [
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $truck->id,
    ]);
});

test('submitting unproposed ID via alternative personnel key fails validation under personnel error key', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = setupEligibleDriver('D-88888');

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-MODULAR-07',
        'client' => 'Client Golf',
        'title' => 'Alternative Error Key Test',
        'site' => 'Site Golf',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Plan',
            'proposed_personnel' => [
                ['user_id' => $driver->id, 'assignment_type' => 'driver'],
            ],
            'proposed_assets' => [],
            'reasons' => [],
            'assumptions' => [],
            'conflicts' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->actingAs($dispatcher)->post(
        "/operations/gpt-recommendations/{$recommendation->id}/accept",
        [
            'personnel' => [
                ['user_id' => 99999],
            ],
        ]
    );

    $response->assertSessionHasErrors(['personnel']);
});

test('omitting asset selection parameter when both crew and assets were proposed defaults to all proposed assets', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver1 = setupEligibleDriver('D-99991');
    $driver2 = setupEligibleDriver('D-99992');
    $truck = setupEligibleTruck('TRK-901');

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-MODULAR-08',
        'client' => 'Client Hotel',
        'title' => 'Default Assets Test',
        'site' => 'Site Hotel',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Assign two drivers and one truck',
            'proposed_personnel' => [
                ['user_id' => $driver1->id, 'assignment_type' => 'driver'],
                ['user_id' => $driver2->id, 'assignment_type' => 'driver'],
            ],
            'proposed_assets' => [
                ['operational_asset_id' => $truck->id, 'assignment_type' => 'truck'],
            ],
            'reasons' => [],
            'assumptions' => [],
            'conflicts' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    // Only provide selected_personnel_ids; selected_asset_ids omitted -> defaults to proposed truck
    $response = $this->actingAs($dispatcher)->post(
        "/operations/gpt-recommendations/{$recommendation->id}/accept",
        [
            'selected_personnel_ids' => [$driver1->id],
        ]
    );

    $response->assertRedirect();
    $recommendation->refresh();
    expect($recommendation->status->value)->toBe('accepted');

    $this->assertDatabaseHas('dispatch_personnel_assignments', [
        'dispatch_job_id' => $job->id,
        'user_id' => $driver1->id,
    ]);
    $this->assertDatabaseMissing('dispatch_personnel_assignments', [
        'dispatch_job_id' => $job->id,
        'user_id' => $driver2->id,
    ]);
    $this->assertDatabaseHas('dispatch_asset_assignments', [
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $truck->id,
    ]);
});

test('submitting non-positive resource id in selected_personnel_ids fails validation', function (): void {
    $dispatcher = User::factory()->create(['is_active' => true]);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = setupEligibleDriver('D-00001');

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-MODULAR-09',
        'client' => 'Client India',
        'title' => 'Non-Positive ID Test',
        'site' => 'Site India',
        'scheduled_start' => now()->addDays(2)->setHour(8)->setMinute(0),
        'scheduled_end' => now()->addDays(2)->setHour(16)->setMinute(0),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);

    $contextBuilder = app(BoundedContextBuilder::class);
    $contextData = $contextBuilder->buildForDispatchJob($job);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => (new DispatchJob)->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => $contextData['context_hash'],
        'input_references' => $contextData['input_references'],
        'recommendation' => [
            'summary' => 'Plan',
            'proposed_personnel' => [
                ['user_id' => $driver->id, 'assignment_type' => 'driver'],
            ],
            'proposed_assets' => [],
            'reasons' => [],
            'assumptions' => [],
            'conflicts' => [],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(10),
    ]);

    $response = $this->actingAs($dispatcher)->post(
        "/operations/gpt-recommendations/{$recommendation->id}/accept",
        [
            'selected_personnel_ids' => [0],
        ]
    );

    $response->assertSessionHasErrors(['selected_personnel_ids.0']);
});
