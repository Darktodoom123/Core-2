<?php

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createReportUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function createReportJob(User $creator): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => 'DSP-REP-'.rand(100, 999),
        'client' => 'Report Test Client',
        'title' => 'Job Report Test',
        'site' => 'Site R',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->subHour(),
        'scheduled_end' => now()->addHours(2),
        'created_by' => $creator->id,
        'version' => 1,
    ]);
}

it('allows assigned worker to submit job report and records audit history', function (): void {
    $driver = createReportUser(RoleName::CraneOperator);
    $job = createReportJob($driver);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $driver->id,
        'active_from' => now()->subHour(),
    ]);

    $this->actingAs($driver)
        ->post('/operations/job-reports', [
            'dispatch_job_id' => $job->id,
            'started_at' => now()->subHour()->toIso8601String(),
            'ended_at' => now()->toIso8601String(),
            'work_summary' => 'Completed hauling transport safely.',
            'remarks' => 'All quiet on site.',
        ])
        ->assertRedirect('/');

    $report = JobReport::query()->first();
    expect($report)->not()->toBeNull()
        ->and($report->dispatch_job_id)->toBe($job->id)
        ->and($report->author_id)->toBe($driver->id)
        ->and($report->status)->toBe(JobReportStatus::Submitted)
        ->and($report->work_summary)->toBe('Completed hauling transport safely.');

    expect(AuditEvent::query()->where('action', 'job_report.submitted')->exists())->toBeTrue();
});

it('allows manager to review and approve job report but prevents author self-approval', function (): void {
    $manager = createReportUser(RoleName::OperationsManager);
    $driver = createReportUser(RoleName::CraneOperator);
    $job = createReportJob($driver);

    $report = JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $driver->id,
        'started_at' => now()->subHour(),
        'ended_at' => now(),
        'work_summary' => 'Finished work',
        'status' => JobReportStatus::Submitted,
        'submitted_at' => now(),
    ]);

    // Author cannot approve own report
    $this->actingAs($driver)
        ->post("/operations/job-reports/{$report->id}/review", [
            'status' => 'approved',
        ])
        ->assertStatus(403);

    // Manager can approve report
    $this->actingAs($manager)
        ->post("/operations/job-reports/{$report->id}/review", [
            'status' => 'approved',
        ])
        ->assertRedirect('/');

    $report->refresh();
    expect($report->status)->toBe(JobReportStatus::Approved);
    expect(AuditEvent::query()->where('action', 'job_report.reviewed')->exists())->toBeTrue();
});

it('requires a reason when rejecting a job report', function (): void {
    $manager = createReportUser(RoleName::OperationsManager);
    $driver = createReportUser(RoleName::CraneOperator);
    $job = createReportJob($driver);

    $report = JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $driver->id,
        'started_at' => now()->subHour(),
        'ended_at' => now(),
        'work_summary' => 'Partial work done',
        'status' => JobReportStatus::Submitted,
        'submitted_at' => now(),
    ]);

    // Missing reason should fail validation
    $this->actingAs($manager)
        ->post("/operations/job-reports/{$report->id}/review", [
            'status' => 'rejected',
        ])
        ->assertSessionHasErrors(['reason']);

    // Providing reason succeeds
    $this->actingAs($manager)
        ->post("/operations/job-reports/{$report->id}/review", [
            'status' => 'rejected',
            'reason' => 'Incomplete site photos.',
        ])
        ->assertRedirect('/');

    $report->refresh();
    expect($report->status)->toBe(JobReportStatus::Rejected)
        ->and($report->remarks)->toContain('Review Note: Incomplete site photos.');
});

it('allows operations manager to review and approve job reports but forbids field workers', function (): void {
    $manager = createReportUser(RoleName::OperationsManager);
    $driver = createReportUser(RoleName::CraneOperator);
    $job = createReportJob($manager);

    $report = JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $driver->id,
        'started_at' => now()->subHour(),
        'ended_at' => now(),
        'work_summary' => 'Driver field report',
        'status' => JobReportStatus::Submitted,
        'submitted_at' => now(),
    ]);

    // Operations Manager can view and review the report
    $this->actingAs($manager)
        ->getJson('/operations/job-reports')
        ->assertOk()
        ->assertJsonFragment(['work_summary' => 'Driver field report']);

    expect(Gate::forUser($manager)->allows('review', $report))->toBeTrue()
        ->and(Gate::forUser($driver)->allows('review', $report))->toBeFalse();

    // Driver is forbidden from reviewing/approving the report
    $this->actingAs($driver)
        ->post("/operations/job-reports/{$report->id}/review", [
            'status' => 'approved',
        ])
        ->assertStatus(403);

    expect(OperationsWorkspaceViewModel::capabilities($manager)['review_job_report'])->toBeTrue()
        ->and(OperationsWorkspaceViewModel::capabilities($driver)['review_job_report'])->toBeFalse();
});

it('allows crane operator to view navigation and submit job report for assigned work', function (): void {
    $operator = createReportUser(RoleName::CraneOperator);
    $job = createReportJob($operator);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $operator->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $operator->id,
        'active_from' => now()->subHour(),
    ]);

    // Navigation includes reports
    $nav = OperationsWorkspaceViewModel::navigation($operator);
    $hasReportsNav = collect($nav)->contains('id', 'reports');
    expect($hasReportsNav)->toBeTrue();

    // Crane operator submits report
    $this->actingAs($operator)
        ->post('/operations/job-reports', [
            'dispatch_job_id' => $job->id,
            'started_at' => now()->subHour()->toIso8601String(),
            'ended_at' => now()->toIso8601String(),
            'work_summary' => 'Operator field inspection and lift completed.',
            'remarks' => 'Hydraulic pressure test passed.',
        ])
        ->assertRedirect('/');

    $report = JobReport::query()->where('author_id', $operator->id)->first();
    expect($report)->not()->toBeNull()
        ->and($report->dispatch_job_id)->toBe($job->id)
        ->and($report->status)->toBe(JobReportStatus::Submitted);
});
