<?php

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Carbon::setTestNow('2026-09-27 08:00:00');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

function historyOperator(): User
{
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    return $user;
}

/**
 * @param  array<string, mixed>  $attributes
 */
function historyJob(User $worker, DispatchStatus $status, array $attributes = [], array $assignment = []): DispatchJob
{
    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-H-'.Str::upper(Str::random(6)),
        'client' => 'Acme Corp',
        'title' => 'Girder lift',
        'site' => 'Pier 4',
        'priority' => DispatchPriority::Routine,
        'status' => $status,
        'version' => 1,
        'created_by' => $worker->id,
        ...$attributes,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'operator',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        ...$assignment,
    ]);

    return $job->refresh();
}

it('keeps finished jobs out of the default live list', function (): void {
    $worker = historyOperator();
    $live = historyJob($worker, DispatchStatus::Accepted);
    historyJob($worker, DispatchStatus::Completed);
    historyJob($worker, DispatchStatus::Cancelled);

    $this->withToken($worker->createToken('m')->plainTextToken)
        ->getJson('/api/v1/dispatch-jobs')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $live->id);

    $this->withToken($worker->createToken('m')->plainTextToken)
        ->getJson('/api/v1/dispatch-jobs?scope=active')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

it('does not let finished jobs push an older live job off the first page', function (): void {
    $worker = historyOperator();
    $older = historyJob($worker, DispatchStatus::Working, ['scheduled_start' => now()->subDays(3)]);

    foreach (range(1, 26) as $day) {
        historyJob($worker, DispatchStatus::Completed, ['scheduled_start' => now()->addDays($day)]);
    }

    $this->withToken($worker->createToken('m')->plainTextToken)
        ->getJson('/api/v1/dispatch-jobs')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $older->id);
});

it('lists the operator\'s finished jobs newest first with real finish times', function (): void {
    $worker = historyOperator();
    historyJob($worker, DispatchStatus::Accepted);
    $completed = historyJob($worker, DispatchStatus::Completed);
    Carbon::setTestNow(now()->addHour());
    $cancelled = historyJob($worker, DispatchStatus::Cancelled);

    $this->withToken($worker->createToken('m')->plainTextToken)
        ->getJson('/api/v1/dispatch-jobs?scope=history')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.id', $cancelled->id)
        ->assertJsonPath('data.0.cancelled_at', $cancelled->cancelled_at->toIso8601String())
        ->assertJsonPath('data.0.completed_at', null)
        ->assertJsonPath('data.1.id', $completed->id)
        ->assertJsonPath('data.1.completed_at', $completed->completed_at->toIso8601String())
        ->assertJsonPath('meta.current_page', 1);
});

it('never shows another operator\'s finished jobs', function (): void {
    $worker = historyOperator();
    $other = historyOperator();
    historyJob($other, DispatchStatus::Completed);

    $this->withToken($worker->createToken('m')->plainTextToken)
        ->getJson('/api/v1/dispatch-jobs?scope=history')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

it('leaves out jobs the operator declined or was reassigned off before they finished', function (): void {
    $worker = historyOperator();
    $kept = historyJob($worker, DispatchStatus::Completed);
    historyJob($worker, DispatchStatus::Completed, [], [
        'response_status' => AssignmentResponse::Rejected,
        'active_until' => now()->subDay(),
    ]);
    historyJob($worker, DispatchStatus::Completed, [], [
        'active_until' => now()->subHours(3),
    ]);

    $this->withToken($worker->createToken('m')->plainTextToken)
        ->getJson('/api/v1/dispatch-jobs?scope=history')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $kept->id);
});

it('keeps a cancelled job in history even though cancelling closed the assignment', function (): void {
    $worker = historyOperator();
    $job = historyJob($worker, DispatchStatus::Accepted);

    DispatchPersonnelAssignment::query()
        ->where('dispatch_job_id', $job->id)
        ->update(['active_until' => now()]);
    $job->update(['status' => DispatchStatus::Cancelled]);

    $this->withToken($worker->createToken('m')->plainTextToken)
        ->getJson('/api/v1/dispatch-jobs?scope=history')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $job->id);
});

it('bounds history to a window of days, 30 by default and 90 at most', function (): void {
    $worker = historyOperator();
    Carbon::setTestNow(now()->subDays(40));
    $old = historyJob($worker, DispatchStatus::Completed);
    Carbon::setTestNow(now()->addDays(40));
    $recent = historyJob($worker, DispatchStatus::Completed);
    $token = $worker->createToken('m')->plainTextToken;

    $this->withToken($token)
        ->getJson('/api/v1/dispatch-jobs?scope=history')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.id', $recent->id);

    $this->withToken($token)
        ->getJson('/api/v1/dispatch-jobs?scope=history&days=60')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.1.id', $old->id);

    $this->withToken($token)
        ->getJson('/api/v1/dispatch-jobs?scope=history&days=91')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['days']);

    $this->withToken($token)
        ->getJson('/api/v1/dispatch-jobs?scope=everything')
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['scope']);
});

it('stamps when a job finishes and clears it if the job is reopened', function (): void {
    $worker = historyOperator();
    $job = historyJob($worker, DispatchStatus::Working);

    expect($job->completed_at)->toBeNull()->and($job->cancelled_at)->toBeNull();

    $job->update(['status' => DispatchStatus::Completed]);
    expect($job->refresh()->completed_at?->equalTo(now()))->toBeTrue();

    $other = historyJob($worker, DispatchStatus::Accepted);
    $other->update(['status' => DispatchStatus::Cancelled]);
    expect($other->refresh()->cancelled_at?->equalTo(now()))->toBeTrue();

    $other->update(['status' => DispatchStatus::Scheduled]);
    expect($other->refresh()->cancelled_at)->toBeNull();
});

it('records the finish time when the operator completes the job from the phone', function (): void {
    $worker = historyOperator();
    $job = historyJob($worker, DispatchStatus::Working, ['version' => 5]);

    $this->withToken($worker->createToken('m')->plainTextToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/status", [
            'status' => 'completed',
            'version' => 5,
        ])
        ->assertOk()
        ->assertJsonPath('data.status.value', 'completed')
        ->assertJsonPath('data.completed_at', now()->toIso8601String());
});
