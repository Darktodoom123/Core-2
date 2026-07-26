<?php

use App\Enums\AssignmentResponse;
use App\Enums\DispatchPriority;
use App\Enums\DispatchStatus;
use App\Enums\RoleName;
use App\Models\DispatchJob;
use App\Models\DispatchPersonnelAssignment;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createResponseUser(RoleName $role, string $name): User
{
    $user = User::factory()->create(['name' => $name]);
    $user->syncRoles([$role->value]);

    return $user;
}

function createResponseJob(
    User $dispatcher,
    string $reference = 'RESP-1001',
    DispatchStatus $status = DispatchStatus::Dispatched,
    int $version = 1,
): DispatchJob {
    return DispatchJob::query()->create([
        'reference' => $reference,
        'client' => 'Highland Infra',
        'title' => 'Bridge Inspection Support',
        'site' => 'Quezon City',
        'site_notes' => 'Site clearance required.',
        'scheduled_start' => now()->addDay()->startOfHour(),
        'scheduled_end' => now()->addDay()->startOfHour()->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => $status,
        'requirements' => ['Safety boots'],
        'created_by' => $dispatcher->id,
        'version' => $version,
    ]);
}

function assignWorkerToJob(
    DispatchJob $job,
    User $worker,
    User $dispatcher,
    AssignmentResponse $responseStatus = AssignmentResponse::Pending,
    ?string $activeUntil = null,
): DispatchPersonnelAssignment {
    return $job->personnelAssignments()->create([
        'user_id' => $worker->id,
        'assignment_type' => $worker->hasRole(RoleName::CraneOperator->value) ? 'crane_operator' : 'driver',
        'response_status' => $responseStatus,
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
        'active_until' => $activeUntil,
    ]);
}

it('allows an assigned field worker to accept their pending assignment', function () {
    $dispatcher = createResponseUser(RoleName::Dispatcher, 'Dispatcher Lead');
    $driver = createResponseUser(RoleName::Driver, 'Assigned Driver');
    $job = createResponseJob($dispatcher, 'RESP-1001');
    $assignment = assignWorkerToJob($job, $driver, $dispatcher);

    $response = $this->actingAs($driver)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'accepted',
            'version' => 1,
        ]);

    $response->assertRedirect("/operations/dispatch-jobs/{$job->id}");
    $response->assertSessionHas('flash', fn (array $flash) => $flash['tone'] === 'success' && str_contains($flash['message'], 'accepted'));

    $assignment->refresh();
    expect($assignment->response_status)->toBe(AssignmentResponse::Accepted);
    expect($assignment->responded_at)->not->toBeNull();
    expect($assignment->response_reason)->toBeNull();
    expect($assignment->active_until)->toBeNull();

    $job->refresh();
    expect($job->version)->toBe(2);

    $this->assertDatabaseHas('audit_events', [
        'actor_id' => $driver->id,
        'subject_type' => DispatchPersonnelAssignment::class,
        'subject_id' => $assignment->id,
        'action' => 'dispatch.assignment_accepted',
    ]);
});

it('allows an assigned field worker to reject their pending assignment with a reason', function () {
    $dispatcher = createResponseUser(RoleName::Dispatcher, 'Dispatcher Lead');
    $driver = createResponseUser(RoleName::Driver, 'Assigned Driver');
    $job = createResponseJob($dispatcher, 'RESP-1002');
    $assignment = assignWorkerToJob($job, $driver, $dispatcher);

    $response = $this->actingAs($driver)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'rejected',
            'reason' => 'Schedule conflict with family emergency.',
            'version' => 1,
        ]);

    $response->assertRedirect(route('home', absolute: false));
    $response->assertSessionHas('flash', fn (array $flash) => $flash['tone'] === 'success' && str_contains($flash['message'], 'rejected'));

    $assignment->refresh();
    expect($assignment->response_status)->toBe(AssignmentResponse::Rejected);
    expect($assignment->responded_at)->not->toBeNull();
    expect($assignment->response_reason)->toBe('Schedule conflict with family emergency.');
    expect($assignment->active_until)->not->toBeNull();

    $job->refresh();
    expect($job->status)->toBe(DispatchStatus::Dispatched); // Job is NOT cancelled!
    expect($job->version)->toBe(2);

    // Rejected assignment closes active interval so job is no longer visible in active worker scope
    $visibleJobs = DispatchJob::query()->visibleTo($driver)->get();
    expect($visibleJobs)->toHaveCount(0);

    $this->assertDatabaseHas('audit_events', [
        'actor_id' => $driver->id,
        'subject_type' => DispatchPersonnelAssignment::class,
        'subject_id' => $assignment->id,
        'action' => 'dispatch.assignment_rejected',
        'reason' => 'Schedule conflict with family emergency.',
    ]);
});

it('requires a reason when rejecting an assignment', function () {
    $dispatcher = createResponseUser(RoleName::Dispatcher, 'Dispatcher Lead');
    $driver = createResponseUser(RoleName::Driver, 'Assigned Driver');
    $job = createResponseJob($dispatcher, 'RESP-1003');
    $assignment = assignWorkerToJob($job, $driver, $dispatcher);

    $response = $this->actingAs($driver)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'rejected',
            'reason' => '  ',
            'version' => 1,
        ]);

    $response->assertSessionHasErrors(['reason']);

    $assignment->refresh();
    expect($assignment->response_status)->toBe(AssignmentResponse::Pending);
    expect($assignment->active_until)->toBeNull();
});

it('prevents a worker from responding to another workers assignment', function () {
    $dispatcher = createResponseUser(RoleName::Dispatcher, 'Dispatcher Lead');
    $driverA = createResponseUser(RoleName::Driver, 'Driver A');
    $driverB = createResponseUser(RoleName::Driver, 'Driver B');
    $job = createResponseJob($dispatcher, 'RESP-1004');
    $assignmentA = assignWorkerToJob($job, $driverA, $dispatcher);

    $response = $this->actingAs($driverB)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments/{$assignmentA->id}/response", [
            'response' => 'accepted',
            'version' => 1,
        ]);

    $response->assertForbidden();

    $assignmentA->refresh();
    expect($assignmentA->response_status)->toBe(AssignmentResponse::Pending);
});

it('prevents responding to an assignment that is already responded to', function () {
    $dispatcher = createResponseUser(RoleName::Dispatcher, 'Dispatcher Lead');
    $driver = createResponseUser(RoleName::Driver, 'Assigned Driver');
    $job = createResponseJob($dispatcher, 'RESP-1005');
    $assignment = assignWorkerToJob($job, $driver, $dispatcher, AssignmentResponse::Accepted);

    $response = $this->actingAs($driver)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'rejected',
            'reason' => 'Changed my mind.',
            'version' => 1,
        ]);

    $response->assertForbidden();

    $assignment->refresh();
    expect($assignment->response_status)->toBe(AssignmentResponse::Accepted);
});

it('rejects stale optimistic version when responding', function () {
    $dispatcher = createResponseUser(RoleName::Dispatcher, 'Dispatcher Lead');
    $driver = createResponseUser(RoleName::Driver, 'Assigned Driver');
    $job = createResponseJob($dispatcher, 'RESP-1006', DispatchStatus::Dispatched, 2);
    $assignment = assignWorkerToJob($job, $driver, $dispatcher);

    $response = $this->actingAs($driver)
        ->post("/operations/dispatch-jobs/{$job->id}/assignments/{$assignment->id}/response", [
            'response' => 'accepted',
            'version' => 1, // Stale version!
        ]);

    $response->assertSessionHasErrors(['version']);

    $assignment->refresh();
    expect($assignment->response_status)->toBe(AssignmentResponse::Pending);
});
