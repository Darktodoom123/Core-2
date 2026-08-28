<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function progressionUser(RoleName $role, string $name): User
{
    $user = User::factory()->create(['name' => $name]);
    $user->syncRoles([$role->value]);

    return $user;
}

function progressionJob(
    User $dispatcher,
    string $reference,
    DispatchStatus $status = DispatchStatus::Dispatched,
    int $version = 1,
): DispatchJob {
    return DispatchJob::query()->create([
        'reference' => $reference,
        'client' => 'Northline Construction',
        'title' => 'Assigned field lift',
        'site' => 'Pasig City',
        'site_notes' => 'Check in with the site supervisor at Gate 2.',
        'scheduled_start' => now()->addDay()->startOfHour(),
        'scheduled_end' => now()->addDay()->startOfHour()->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => $status,
        'requirements' => ['Hard hat', 'Site induction'],
        'created_by' => $dispatcher->id,
        'version' => $version,
    ]);
}

function assignProgressionWorker(DispatchJob $job, User $worker, User $dispatcher, ?string $activeUntil = null): void
{
    $job->personnelAssignments()->create([
        'user_id' => $worker->id,
        'assignment_type' => $worker->hasRole(RoleName::CraneOperator->value) ? 'crane_operator' : 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
        'active_until' => $activeUntil,
    ]);
}

it('shows field users only their active assignments with the next valid action', function () {
    $dispatcher = progressionUser(RoleName::OperationsManager, 'Dispatch Lead');
    $driver = progressionUser(RoleName::CraneOperator, 'Assigned Driver');
    $otherDriver = progressionUser(RoleName::CraneOperator, 'Other Driver');
    $operator = progressionUser(RoleName::CraneOperator, 'Former Operator');

    $assignedJob = progressionJob($dispatcher, 'FIELD-1001');
    $otherJob = progressionJob($dispatcher, 'FIELD-1002');
    $endedJob = progressionJob($dispatcher, 'FIELD-1003');

    assignProgressionWorker($assignedJob, $driver, $dispatcher);
    assignProgressionWorker($assignedJob, $operator, $dispatcher);
    assignProgressionWorker($otherJob, $otherDriver, $dispatcher);
    assignProgressionWorker($endedJob, $driver, $dispatcher, now()->subMinute()->toIso8601String());

    $this->actingAs($driver)
        ->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('workspace')
            ->where('navigation.1.label', "Today's work")
            ->where('capabilities.update_assigned_dispatch_status', true)
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('jobs', 1)
                ->where('jobs.0.reference', 'FIELD-1001')
                ->where('jobs.0.requirements', ['Hard hat', 'Site induction'])
                ->has('jobs.0.personnel_assignments', 1)
                ->where('jobs.0.personnel_assignments.0.name', 'Assigned Driver'))
        );

    $this->actingAs($driver)
        ->get("/operations/dispatch-jobs/{$assignedJob->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dispatch-detail')
            ->where('capabilities.update_own_status', true)
            ->where('progression.current.value', DispatchStatus::Dispatched->value)
            ->where('progression.next.status.value', DispatchStatus::Accepted->value)
            ->where('progression.next.action_label', 'Accept job')
            ->has('personnel_candidates', 0)
            ->has('asset_candidates', 0)
        );

    $this->actingAs($driver)
        ->getJson('/operations/dispatch-jobs')
        ->assertOk()
        ->assertJsonCount(1, 'data.data')
        ->assertJsonPath('data.data.0.reference', 'FIELD-1001');

    $this->actingAs($driver)
        ->get("/operations/dispatch-jobs/{$otherJob->id}")
        ->assertNotFound();

    $this->actingAs($driver)
        ->get("/operations/dispatch-jobs/{$endedJob->id}")
        ->assertNotFound();
});

it('allows each adjacent field progression and records one attributable audit event', function (
    DispatchStatus $current,
    DispatchStatus $next,
    string $label,
) {
    $dispatcher = progressionUser(RoleName::OperationsManager, 'Dispatch Lead');
    $driver = progressionUser(RoleName::CraneOperator, 'Assigned Driver');
    $job = progressionJob($dispatcher, "FIELD-{$current->value}", $current, 7);
    assignProgressionWorker($job, $driver, $dispatcher);

    $this->actingAs($driver)
        ->withHeader('X-Request-ID', 'not-a-trusted-request-id')
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/status", [
            'status' => $next->value,
            'version' => 7,
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}")
        ->assertSessionHas('flash', [
            'tone' => 'success',
            'message' => "{$job->reference} is now {$label}.",
        ]);

    expect($job->refresh()->status)->toBe($next)
        ->and($job->version)->toBe(8);

    $event = AuditEvent::query()
        ->where('subject_type', (new DispatchJob)->getMorphClass())
        ->where('subject_id', $job->id)
        ->where('action', 'dispatch.status_updated')
        ->sole();

    expect($event->actor_id)->toBe($driver->id)
        ->and(Str::isUuid($event->request_id))->toBeTrue()
        ->and($event->before)->toMatchArray(['status' => $current->value, 'version' => 7])
        ->and($event->after)->toMatchArray(['status' => $next->value, 'version' => 8]);
})->with([
    'accept dispatched job' => [DispatchStatus::Dispatched, DispatchStatus::Accepted, 'Accepted'],
    'start route' => [DispatchStatus::Accepted, DispatchStatus::EnRoute, 'En route'],
    'arrive on site' => [DispatchStatus::EnRoute, DispatchStatus::Arrived, 'Arrived'],
    'start work' => [DispatchStatus::Arrived, DispatchStatus::Working, 'Working'],
    'complete work' => [DispatchStatus::Working, DispatchStatus::Completed, 'Completed'],
]);

it('rejects skipped, reversed, and terminal field transitions without an audit event', function (
    DispatchStatus $current,
    DispatchStatus $attempted,
) {
    $dispatcher = progressionUser(RoleName::OperationsManager, 'Dispatch Lead');
    $driver = progressionUser(RoleName::CraneOperator, 'Assigned Driver');
    $job = progressionJob($dispatcher, "FIELD-SKIP-{$current->value}", $current, 3);
    assignProgressionWorker($job, $driver, $dispatcher);

    $this->actingAs($driver)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/status", [
            'status' => $attempted->value,
            'version' => 3,
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}")
        ->assertSessionHasErrors('status');

    expect($job->refresh()->status)->toBe($current)
        ->and($job->version)->toBe(3)
        ->and(AuditEvent::query()->where('action', 'dispatch.status_updated')->count())->toBe(0);
})->with([
    'skip acceptance' => [DispatchStatus::Dispatched, DispatchStatus::EnRoute],
    'skip arrival' => [DispatchStatus::EnRoute, DispatchStatus::Working],
    'reverse progress' => [DispatchStatus::Working, DispatchStatus::Arrived],
    'leave terminal state' => [DispatchStatus::Completed, DispatchStatus::Working],
]);

it('prevents another or formerly assigned worker from changing the job', function () {
    $dispatcher = progressionUser(RoleName::OperationsManager, 'Dispatch Lead');
    $assignedDriver = progressionUser(RoleName::CraneOperator, 'Assigned Driver');
    $otherDriver = progressionUser(RoleName::CraneOperator, 'Other Driver');
    $formerOperator = progressionUser(RoleName::CraneOperator, 'Former Operator');
    $job = progressionJob($dispatcher, 'FIELD-UNAUTHORIZED');

    assignProgressionWorker($job, $assignedDriver, $dispatcher);
    assignProgressionWorker($job, $formerOperator, $dispatcher, now()->subMinute()->toIso8601String());

    foreach ([$otherDriver, $formerOperator] as $unauthorizedUser) {
        $this->actingAs($unauthorizedUser)
            ->post("/operations/dispatch-jobs/{$job->id}/status", [
                'status' => DispatchStatus::Accepted->value,
                'version' => 1,
            ])
            ->assertNotFound();
    }

    $this->actingAs($dispatcher)
        ->post("/operations/dispatch-jobs/{$job->id}/status", [
            'status' => DispatchStatus::Accepted->value,
            'version' => 1,
        ])
        ->assertForbidden();

    expect($job->refresh()->status)->toBe(DispatchStatus::Dispatched)
        ->and($job->version)->toBe(1)
        ->and(AuditEvent::query()->where('action', 'dispatch.status_updated')->count())->toBe(0);
});

it('rolls back the status and version when its audit event cannot be recorded', function () {
    $dispatcher = progressionUser(RoleName::OperationsManager, 'Dispatch Lead');
    $driver = progressionUser(RoleName::CraneOperator, 'Assigned Driver');
    $job = progressionJob($dispatcher, 'FIELD-AUDIT-ROLLBACK', DispatchStatus::Dispatched, 2);
    assignProgressionWorker($job, $driver, $dispatcher);

    DB::unprepared(<<<'SQL'
        CREATE TRIGGER fail_status_audit
        BEFORE INSERT ON audit_events
        WHEN NEW.action = 'dispatch.status_updated'
        BEGIN
            SELECT RAISE(ABORT, 'forced status audit failure');
        END
        SQL);

    $this->withoutExceptionHandling();

    expect(fn () => $this->actingAs($driver)
        ->post("/operations/dispatch-jobs/{$job->id}/status", [
            'status' => DispatchStatus::Accepted->value,
            'version' => 2,
        ]))->toThrow(QueryException::class);

    expect($job->refresh()->status)->toBe(DispatchStatus::Dispatched)
        ->and($job->version)->toBe(2)
        ->and(AuditEvent::query()->where('action', 'dispatch.status_updated')->count())->toBe(0);
});

it('rejects a stale optimistic version with a refreshable conflict and no audit event', function () {
    $dispatcher = progressionUser(RoleName::OperationsManager, 'Dispatch Lead');
    $driver = progressionUser(RoleName::CraneOperator, 'Assigned Driver');
    $job = progressionJob($dispatcher, 'FIELD-STALE', DispatchStatus::Dispatched, 4);
    assignProgressionWorker($job, $driver, $dispatcher);

    DispatchJob::query()->whereKey($job->id)->update(['version' => 5]);

    $this->actingAs($driver)
        ->from("/operations/dispatch-jobs/{$job->id}")
        ->post("/operations/dispatch-jobs/{$job->id}/status", [
            'status' => DispatchStatus::Accepted->value,
            'version' => 4,
        ])
        ->assertRedirect("/operations/dispatch-jobs/{$job->id}")
        ->assertSessionHasErrors('version');

    expect(session('errors')->first('version'))->toContain('changed')
        ->and($job->refresh()->status)->toBe(DispatchStatus::Dispatched)
        ->and($job->version)->toBe(5)
        ->and(AuditEvent::query()->where('action', 'dispatch.status_updated')->count())->toBe(0);
});
