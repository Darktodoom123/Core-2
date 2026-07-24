<?php

use App\Enums\DispatchPriority;
use App\Enums\DispatchStatus;
use App\Enums\JobReportStatus;
use App\Enums\RoleName;
use App\Models\AuditEvent;
use App\Models\DispatchJob;
use App\Models\DispatchPersonnelAssignment;
use App\Models\JobReport;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

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
    $driver = createReportUser(RoleName::Driver);
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
    $driver = createReportUser(RoleName::Driver);
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
    $driver = createReportUser(RoleName::Driver);
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
