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
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createResubmitUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function createResubmitJob(User $creator): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => 'DSP-RESUB-'.rand(100, 999),
        'client' => 'Resubmit Test Client',
        'title' => 'Job Report Resubmission Test',
        'site' => 'Site Alpha',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->subHours(2),
        'scheduled_end' => now()->addHours(2),
        'created_by' => $creator->id,
        'version' => 1,
    ]);
}

it('allows worker to save an in-progress job report as draft', function (): void {
    $driver = createResubmitUser(RoleName::CraneOperator);
    $job = createResubmitJob($driver);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $driver->id,
        'active_from' => now()->subHours(2),
    ]);

    $this->actingAs($driver)
        ->post('/operations/job-reports', [
            'dispatch_job_id' => $job->id,
            'is_draft' => true,
            'work_summary' => 'Draft notes: inspected vehicle and staged equipment.',
            'ending_meter_value' => 45210.5,
            'meter_type' => 'odometer_km',
        ])
        ->assertRedirect('/');

    $report = JobReport::query()->first();
    expect($report)->not()->toBeNull()
        ->and($report->status)->toBe(JobReportStatus::Draft)
        ->and($report->submitted_at)->toBeNull()
        ->and($report->ending_meter_value)->toBe(45210.5)
        ->and($report->meter_type)->toBe('odometer_km')
        ->and($report->canBeResubmitted())->toBeTrue();

    expect(AuditEvent::query()->where('action', 'job_report.draft_saved')->exists())->toBeTrue();
});

it('supports full rejection, note capture, and author resubmission cycle', function (): void {
    $manager = createResubmitUser(RoleName::OperationsManager);
    $operator = createResubmitUser(RoleName::CraneOperator);
    $job = createResubmitJob($operator);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $operator->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $operator->id,
        'active_from' => now()->subHours(2),
    ]);

    // 1. Initial submission
    $this->actingAs($operator)
        ->post('/operations/job-reports', [
            'dispatch_job_id' => $job->id,
            'started_at' => now()->subHours(2)->toIso8601String(),
            'ended_at' => now()->toIso8601String(),
            'work_summary' => 'Field hydraulic pump inspection concluded.',
            'ending_meter_value' => 1240.0,
            'meter_type' => 'engine_hours',
            'latitude' => 14.5995,
            'longitude' => 120.9842,
        ])
        ->assertRedirect('/');

    $report = JobReport::query()->sole();
    expect($report->status)->toBe(JobReportStatus::Submitted)
        ->and($report->resubmitted_count)->toBe(0)
        ->and($report->ending_meter_value)->toBe(1240.0)
        ->and($report->latitude)->toBe(14.5995);

    // 2. Manager rejects report with reason
    $this->actingAs($manager)
        ->post("/operations/job-reports/{$report->id}/review", [
            'status' => 'rejected',
            'reason' => 'Please provide pressure gauge measurement readings in summary.',
        ])
        ->assertRedirect('/');

    $report->refresh();
    expect($report->status)->toBe(JobReportStatus::Rejected)
        ->and($report->rejection_reason)->toBe('Please provide pressure gauge measurement readings in summary.')
        ->and($report->canBeResubmitted())->toBeTrue();

    // 3. Unauthorized other driver cannot resubmit
    $otherDriver = createResubmitUser(RoleName::CraneOperator);
    $this->actingAs($otherDriver)
        ->post("/operations/job-reports/{$report->id}/resubmit", [
            'work_summary' => 'Attempted hijack of resubmission',
        ])
        ->assertStatus(403);

    // 4. Author resubmits with amended details
    $this->actingAs($operator)
        ->post("/operations/job-reports/{$report->id}/resubmit", [
            'work_summary' => 'Field hydraulic pump inspection concluded. Operating pressure verified at 3,200 PSI nominal.',
            'remarks' => 'Added pressure gauge reading per manager note.',
            'ending_meter_value' => 1241.5,
            'meter_type' => 'engine_hours',
        ])
        ->assertRedirect('/');

    $report->refresh();
    expect($report->status)->toBe(JobReportStatus::Submitted)
        ->and($report->resubmitted_count)->toBe(1)
        ->and($report->work_summary)->toContain('Operating pressure verified at 3,200 PSI nominal.')
        ->and($report->ending_meter_value)->toBe(1241.5);

    expect(AuditEvent::query()->where('action', 'job_report.resubmitted')->exists())->toBeTrue();

    // 5. Manager now approves the resubmitted report
    $this->actingAs($manager)
        ->post("/operations/job-reports/{$report->id}/review", [
            'status' => 'approved',
        ])
        ->assertRedirect('/');

    $report->refresh();
    expect($report->status)->toBe(JobReportStatus::Approved)
        ->and($report->canBeResubmitted())->toBeFalse();

    // 6. Attempting to resubmit an approved report fails validation
    $this->actingAs($operator)
        ->post("/operations/job-reports/{$report->id}/resubmit", [
            'work_summary' => 'Cannot amend after approval',
        ])
        ->assertSessionHasErrors(['status']);
});
