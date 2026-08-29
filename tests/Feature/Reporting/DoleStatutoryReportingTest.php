<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Exports\ReportExportCatalog;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Safety\Models\SiteHazardTicket;
use App\Platform\Safety\Models\ToolboxMeeting;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('exports DOLE WAIR accident and incident records for Safety Officers', function (): void {
    $safetyOfficer = User::factory()->create(['name' => 'Engr. Morales', 'is_active' => true]);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);

    SiteHazardTicket::query()->create([
        'ticket_code' => 'HAZ-2026-901',
        'project_site' => 'Makati Skysuites Tower',
        'reporter_id' => $safetyOfficer->id,
        'category' => 'rigging_tackle',
        'severity' => 'imminent_danger',
        'description' => 'Damaged 30T wire rope sling strand parted during pre-lift inspection.',
        'location_detail' => 'Bay 4 Heavy Rigging Yard',
        'corrective_action_required' => 'Condemn and tag out defective sling immediately.',
        'status' => 'open',
        'work_stoppage_issued' => true,
    ]);

    $catalog = app(ReportExportCatalog::class);
    $dataset = $catalog->dataset(ReportExportType::DoleWair);

    expect($dataset->authorize($safetyOfficer))->toBeTrue();
    expect($dataset->headers())->toContain('Ticket Code', 'Severity Level', 'Work Stoppage Triggered');

    $rows = iterator_to_array($dataset->rows($safetyOfficer, []));
    expect($rows)->toHaveCount(1);
    expect($rows[0][0])->toBe('HAZ-2026-901');
    expect($rows[0][3])->toBe('IMMINENT DANGER');
    expect($rows[0][6])->toBe('YES (RA 11058)');
});

it('exports DOLE D.O. 13 CSHP Safe Man-Hours and Toolbox Meeting compliance audit', function (): void {
    $foreman = User::factory()->create(['name' => 'Foreman Carlo', 'is_active' => true]);
    $foreman->syncRoles([RoleName::FieldForeman->value]);

    $safetyOfficer = User::factory()->create(['name' => 'Engr. Morales', 'is_active' => true]);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);

    ToolboxMeeting::query()->create([
        'project_site' => 'BGC High Street Tower',
        'topic_id' => 'TBM-TOPIC-HEIGHTS',
        'topic_title' => 'Working at Heights & Dual Lanyard 100% Tie-Off',
        'topic_category' => 'fall_protection',
        'conductor_id' => $foreman->id,
        'conductor_role' => 'Field Foreman',
        'attendee_ids' => ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'w11', 'w12'],
        'attendee_count' => 12,
        'safety_officer_id' => $safetyOfficer->id,
        'safety_officer_signed_at' => now(),
        'audit_hash' => 'PH-DOLE-CSHP-2026-TBM-8801-VALID',
    ]);

    $catalog = app(ReportExportCatalog::class);
    $dataset = $catalog->dataset(ReportExportType::CshpSafeManHours);

    expect($dataset->authorize($foreman))->toBeTrue();
    expect($dataset->authorize($safetyOfficer))->toBeTrue();

    $rows = iterator_to_array($dataset->rows($safetyOfficer, []));
    expect($rows)->toHaveCount(1);
    expect($rows[0][0])->toBe('PH-DOLE-CSHP-2026-TBM-8801-VALID');
    expect($rows[0][3])->toBe(12);
    expect($rows[0][6])->toBe('CO-SIGNED & AUDITED');
    expect($rows[0][7])->toBe('PH-DOLE-CSHP-2026-TBM-8801-VALID');
});

it('exports Daily Accomplishment Reports (DAR) for Field Foremen and Operations Managers', function (): void {
    $manager = User::factory()->create(['name' => 'Ops Manager Dave', 'is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $foreman = User::factory()->create(['name' => 'Foreman Carlo', 'is_active' => true]);
    $foreman->syncRoles([RoleName::FieldForeman->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-DAR-001',
        'client' => 'Metro Rail Corp',
        'title' => 'Viaduct Girder Erection',
        'site' => 'MRT Line 7 Segment 4',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Dispatched,
        'version' => 1,
        'created_by' => $manager->id,
    ]);

    JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $foreman->id,
        'status' => JobReportStatus::Submitted,
        'started_at' => now()->subHours(8),
        'ended_at' => now(),
        'work_summary' => 'Positioned and secured 4 pre-cast girder sections using 50T crane with zero LTI.',
        'submitted_at' => now(),
    ]);

    $catalog = app(ReportExportCatalog::class);
    $dataset = $catalog->dataset(ReportExportType::DailyAccomplishment);

    expect($dataset->authorize($manager))->toBeTrue();
    expect($dataset->authorize($foreman))->toBeTrue();

    $rows = iterator_to_array($dataset->rows($manager, []));
    expect($rows)->toHaveCount(1);
    expect($rows[0][1])->toBe('DSP-DAR-001');
    expect($rows[0][2])->toBe('MRT Line 7 Segment 4');
    expect($rows[0][4])->toBe('8 hrs');
    expect($rows[0][5])->toContain('Positioned and secured 4 pre-cast girder sections');
});
