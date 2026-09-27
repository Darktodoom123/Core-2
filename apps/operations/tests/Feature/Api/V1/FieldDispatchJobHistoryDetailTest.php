<?php

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DelayContext;
use App\Modules\Dispatch\Enums\DelayReason;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchJobDelay;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use Carbon\CarbonInterface;
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

function detailOperator(): User
{
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    return $user;
}

/**
 * @param  array<string, mixed>  $assignment
 */
function detailJob(User $worker, DispatchStatus $status, array $assignment = []): DispatchJob
{
    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DISP-D-'.Str::upper(Str::random(6)),
        'client' => 'Acme Corp',
        'title' => 'Girder lift',
        'site' => 'Pier 4',
        'priority' => DispatchPriority::Routine,
        'status' => $status,
        'version' => 1,
        'created_by' => $worker->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $worker->id,
        'assignment_type' => 'operator',
        'assigned_by' => $worker->id,
        'response_status' => AssignmentResponse::Accepted,
        'responded_at' => now()->subHours(5),
        ...$assignment,
    ]);

    return $job->refresh();
}

function recordStep(User $actor, DispatchJob $job, string $status, CarbonInterface $at): void
{
    Carbon::setTestNow($at);
    app(RecordAuditEvent::class)->handle($actor, $job, 'dispatch.status_updated', ['status' => 'x'], ['status' => $status]);
    Carbon::setTestNow('2026-09-27 08:00:00');
}

it('shows the operator what happened on their finished job', function (): void {
    $worker = detailOperator();
    $job = detailJob($worker, DispatchStatus::Completed);

    recordStep($worker, $job, 'en_route', now()->subHours(4));
    recordStep($worker, $job, 'arrived', now()->subHours(3));
    recordStep($worker, $job, 'working', now()->subHours(3)->addMinutes(10));

    DispatchJobDelay::query()->create([
        'dispatch_job_id' => $job->id,
        'reported_by' => $worker->id,
        'context' => DelayContext::Transit,
        'reason' => DelayReason::cases()[0],
        'reason_label' => 'Escort vehicle late',
        'estimated_minutes' => 20,
        'notes' => 'Escort late',
        'reported_at' => now()->subHours(3)->subMinutes(30),
        'job_version' => 1,
    ]);

    JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $worker->id,
        'status' => JobReportStatus::Submitted,
        'work_summary' => 'Set four girders.',
        'submitted_at' => now()->subMinutes(5),
    ]);

    $response = $this->withToken($worker->createToken('m')->plainTextToken)
        ->getJson("/api/v1/dispatch-jobs/{$job->id}/history")
        ->assertOk()
        ->assertJsonPath('data.job.id', $job->id)
        ->assertJsonPath('data.job.completed_at', now()->toIso8601String())
        ->assertJsonPath('data.delays.0.estimated_minutes', 20)
        ->assertJsonPath('data.delays.0.notes', 'Escort late')
        ->assertJsonPath('data.delays.0.reason_label', 'Escort vehicle late')
        ->assertJsonPath('data.report.status', 'submitted')
        ->assertJsonPath('data.report.work_summary', 'Set four girders.');

    expect(collect($response->json('data.timeline'))->pluck('status')->all())
        ->toBe(['accepted', 'en_route', 'arrived', 'working', 'completed']);
    expect($response->json('data.timeline.1.at'))->toBe(now()->subHours(4)->toIso8601String());
    expect($response->json('data.timeline.4.at'))->toBe(now()->toIso8601String());
});

it('only shows steps the server recorded, never filling gaps', function (): void {
    $worker = detailOperator();
    $job = detailJob($worker, DispatchStatus::Completed, ['responded_at' => null]);

    $response = $this->withToken($worker->createToken('m')->plainTextToken)
        ->getJson("/api/v1/dispatch-jobs/{$job->id}/history")
        ->assertOk()
        ->assertJsonPath('data.report', null)
        ->assertJsonPath('data.delays', []);

    expect(collect($response->json('data.timeline'))->pluck('status')->all())
        ->toBe(['completed']);
});

it('does not show another author\'s report', function (): void {
    $worker = detailOperator();
    $other = detailOperator();
    $job = detailJob($worker, DispatchStatus::Completed);

    JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $other->id,
        'status' => JobReportStatus::Submitted,
        'work_summary' => 'Not yours.',
        'submitted_at' => now(),
    ]);

    $this->withToken($worker->createToken('m')->plainTextToken)
        ->getJson("/api/v1/dispatch-jobs/{$job->id}/history")
        ->assertOk()
        ->assertJsonPath('data.report', null);
});

it('hides the detail from anyone whose history the job is not in', function (): void {
    $worker = detailOperator();
    $stranger = detailOperator();
    $finished = detailJob($worker, DispatchStatus::Completed);
    $live = detailJob($worker, DispatchStatus::Working);
    $declined = detailJob($worker, DispatchStatus::Completed, [
        'response_status' => AssignmentResponse::Rejected,
        'active_until' => now()->subDay(),
    ]);

    $this->withToken($stranger->createToken('m')->plainTextToken)
        ->getJson("/api/v1/dispatch-jobs/{$finished->id}/history")
        ->assertNotFound();

    $token = $worker->createToken('m')->plainTextToken;

    $this->withToken($token)
        ->getJson("/api/v1/dispatch-jobs/{$live->id}/history")
        ->assertNotFound();

    $this->withToken($token)
        ->getJson("/api/v1/dispatch-jobs/{$declined->id}/history")
        ->assertNotFound();
});
