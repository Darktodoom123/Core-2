<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createSecUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

it('synchronizes dispatch job to completed upon manager report approval', function (): void {
    $manager = createSecUser(RoleName::OperationsManager);
    $driver = createSecUser(RoleName::Driver);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-SYNC-'.rand(100, 999),
        'client' => 'Sync Client',
        'title' => 'Dispatch Sync Test',
        'site' => 'Site S',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->subHours(2),
        'scheduled_end' => now()->addHours(2),
        'created_by' => $manager->id,
        'version' => 1,
    ]);

    $report = JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $driver->id,
        'started_at' => now()->subHours(2),
        'ended_at' => now(),
        'work_summary' => 'All delivery and hauling steps completed on site.',
        'status' => JobReportStatus::Submitted,
        'submitted_at' => now(),
    ]);

    // Manager approves
    $this->actingAs($manager)
        ->post("/operations/job-reports/{$report->id}/review", [
            'status' => 'approved',
        ])
        ->assertRedirect('/');

    $job->refresh();
    expect($job->status)->toBe(DispatchStatus::Completed)
        ->and($job->version)->toBe(2);

    expect(AuditEvent::query()->where('action', 'dispatch_job.completed_via_report_approval')->exists())->toBeTrue();
});

it('atomically updates assigned asset meter reading from report submission', function (): void {
    $driver = createSecUser(RoleName::Driver);
    $dispatcher = createSecUser(RoleName::Dispatcher);

    $asset = OperationalAsset::query()->create([
        'code' => 'TRK-'.rand(100, 999),
        'name' => 'Heavy Prime Mover',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
        'meter_type' => 'odometer_km',
        'meter_value' => 50000.0,
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-MTR-'.rand(100, 999),
        'client' => 'Telemetry Client',
        'title' => 'Asset Telemetry Sync Test',
        'site' => 'Highway Site',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->subHours(3),
        'scheduled_end' => now()->addHours(1),
        'created_by' => $dispatcher->id,
        'version' => 1,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHours(3),
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'assignment_type' => 'primary',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHours(3),
    ]);

    // Driver submits report with updated odometer (50125.5 km)
    $this->actingAs($driver)
        ->post('/operations/job-reports', [
            'dispatch_job_id' => $job->id,
            'started_at' => now()->subHours(3)->toIso8601String(),
            'ended_at' => now()->toIso8601String(),
            'ending_meter_value' => 50125.5,
            'meter_type' => 'odometer_km',
            'work_summary' => 'Finished inter-facility hauling trip.',
        ])
        ->assertRedirect('/');

    $asset->refresh();
    expect((float) $asset->meter_value)->toBe(50125.5);

    expect(AuditEvent::query()->where('action', 'asset.meter_updated_from_report')->exists())->toBeTrue();
});
