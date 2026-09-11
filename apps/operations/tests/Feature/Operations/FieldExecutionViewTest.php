<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LocationSampleDto;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function executionViewUser(RoleName $role, string $name): User
{
    $user = User::factory()->create(['name' => $name]);
    $user->syncRoles([$role->value]);

    return $user;
}

function executionViewJob(User $creator, DispatchStatus $status = DispatchStatus::Working): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => 'EXEC-'.strtoupper(substr($status->value, 0, 3)),
        'client' => 'Northline Construction',
        'title' => 'Recorded field execution',
        'site' => 'Pasig City',
        'site_notes' => 'Check in with the site supervisor.',
        'site_latitude' => 14.5764,
        'site_longitude' => 121.0851,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(5),
        'priority' => DispatchPriority::Routine,
        'status' => $status,
        'requirements' => ['Hard hat'],
        'created_by' => $creator->id,
        'version' => 2,
    ]);
}

it('routes active office users to recorded execution evidence without preparation props', function (): void {
    $manager = executionViewUser(RoleName::OperationsManager, 'Execution Manager');
    $job = executionViewJob($manager);
    $operator = executionViewUser(RoleName::CraneOperator, 'Assigned Operator');
    $job->personnelAssignments()->create([
        'user_id' => $operator->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $manager->id,
        'active_from' => now()->subHour(),
    ]);
    $futureOperator = executionViewUser(RoleName::CraneOperator, 'Future Operator');
    $job->personnelAssignments()->create([
        'user_id' => $futureOperator->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $manager->id,
        'active_from' => now()->subHour(),
    ]);
    $futureOperator->personnelCredentials()->create([
        'kind' => 'operator_certification',
        'credential_number' => 'OP-FUTURE-1',
        'credential_type' => 'crane_operator',
        'issued_at' => now()->addDay(),
        'expires_at' => now()->addYear(),
        'status' => 'active',
    ]);
    $capturedAt = now()->subMinutes(2);
    $receivedAt = now()->subMinute();

    AuditEvent::query()->create([
        'actor_id' => $manager->id,
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'action' => 'dispatch.status_updated',
        'after' => ['status' => DispatchStatus::Working->value, 'version' => 2],
        'occurred_at' => now()->subMinutes(5),
    ]);
    app(TrackingClientInterface::class)->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $manager->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.58,
        'longitude' => 121.08,
        'accuracy_metres' => 12,
        'source' => 'mobile',
        'sharing_enabled' => true,
        'captured_at' => $capturedAt,
        'received_at' => $receivedAt,
    ]));

    $this->actingAs($manager)
        ->get("/operations/dispatch-jobs/{$job->id}#field-execution")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dispatch-detail')
            ->where('job.status.value', DispatchStatus::Working->value)
            ->where('progression', null)
            ->where('job.personnel_assignments.0.credential.status', 'Missing')
            ->where('job.personnel_assignments.1.credential.status', 'Not yet valid')
            ->where('execution.status.value', DispatchStatus::Working->value)
            ->has('execution.milestones', 1)
            ->where('execution.site.latest_location.latitude', 14.58)
            ->where('execution.site.latest_location.user.name', 'Execution Manager')
            ->where('execution.site.latest_location.captured_at', $capturedAt->toIso8601String())
            ->where('execution.site.latest_location.received_at', $receivedAt->toIso8601String())
            ->has('execution.activity', 2)
        );
});

it('does not treat a non-shared location as current execution evidence', function (): void {
    $manager = executionViewUser(RoleName::OperationsManager, 'Privacy Manager');
    $job = executionViewJob($manager, DispatchStatus::EnRoute);

    app(TrackingClientInterface::class)->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $manager->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.58,
        'longitude' => 121.08,
        'source' => 'mobile',
        'sharing_enabled' => false,
        'captured_at' => now()->subMinute(),
        'received_at' => now(),
    ]));

    $this->actingAs($manager)
        ->get("/operations/dispatch-jobs/{$job->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('execution.status.value', DispatchStatus::EnRoute->value)
            ->where('execution.site.latest_location', null)
        );
});

it('keeps the operator status progression branch for the same active statuses', function (): void {
    $manager = executionViewUser(RoleName::OperationsManager, 'Dispatch Manager');
    $operator = executionViewUser(RoleName::CraneOperator, 'Field Operator');
    $job = executionViewJob($manager, DispatchStatus::Arrived);
    $job->personnelAssignments()->create([
        'user_id' => $operator->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $manager->id,
        'active_from' => now()->subHour(),
    ]);

    $this->actingAs($operator)
        ->get("/operations/dispatch-jobs/{$job->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('progression.current.value', DispatchStatus::Arrived->value)
            ->where('progression.next.status.value', DispatchStatus::Working->value)
            ->where('execution', null)
        );
});
