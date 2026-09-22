<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dvir\Enums\DvirCheckStatus;
use App\Modules\Dvir\Enums\DvirInspectionType;
use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\Dvir\Models\DvirInspectionCheck;
use App\Modules\Dvir\Models\DvirInspectionPhoto;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\Fuel\ViewModels\FuelWorkspaceViewModel;
use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Enums\StandbyReason;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Workspace\Queries\WorkspaceAssetsQuery;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('serializes authoritative fleet detail totals and the latest recorded status update', function (): void {
    $manager = User::factory()->create(['name' => 'Fleet Operations Manager']);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-COUNTS-01',
        'name' => 'Counted Fleet Asset',
        'kind' => 'mobile_crane',
        'status' => AssetStatus::Available,
    ]);

    for ($index = 1; $index <= 12; $index++) {
        $asset->inspections()->create([
            'technician_id' => $manager->id,
            'type' => 'safety',
            'result' => 'passed',
            'checklist' => ['brakes' => true],
            'completed_at' => now()->subMinutes($index),
        ]);
    }

    for ($index = 1; $index <= 16; $index++) {
        DvirInspection::query()->create([
            'user_id' => $manager->id,
            'operational_asset_id' => $asset->id,
            'inspection_type' => DvirInspectionType::PRE_TRIP,
            'completed_at' => now()->subMinutes($index),
            'has_defects' => false,
            'critical_defects_count' => 0,
            'signature_captured' => true,
        ]);
    }

    MaintenanceWorkOrder::query()->create([
        'operational_asset_id' => $asset->id,
        'status' => 'pending',
        'priority' => 'routine',
        'dispatch_blocking' => false,
        'defect' => 'Routine maintenance follow-up',
        'reported_at' => now()->subHour(),
    ]);

    AuditEvent::query()->create([
        'actor_id' => $manager->id,
        'subject_type' => $asset->getMorphClass(),
        'subject_id' => $asset->id,
        'action' => 'asset.status_updated',
        'before' => ['status' => AssetStatus::UnderInspection->value],
        'after' => ['status' => AssetStatus::Available->value],
        'reason' => 'Passing safety inspection recorded',
        'occurred_at' => now()->subMinute(),
    ]);

    $page = app(WorkspaceAssetsQuery::class)->paginate($manager, [
        'per_page' => 50,
    ]);
    $serialized = OperationsWorkspaceViewModel::assets($page->getCollection());
    $item = collect($serialized)->firstWhere('id', $asset->id);

    expect($item)->not()->toBeNull()
        ->and($item['inspections_count'])->toBe(12)
        ->and($item['dvir_inspections_count'])->toBe(16)
        ->and($item['maintenance_work_orders_count'])->toBe(1)
        ->and(count($item['inspections']))->toBeLessThanOrEqual(10)
        ->and(count($item['dvir_inspections']))->toBeLessThanOrEqual(15)
        ->and($item['latest_status_change']['to_status'])->toBe(AssetStatus::Available->value)
        ->and($item['latest_status_change']['reason'])->toBe('Passing safety inspection recorded')
        ->and($item['latest_status_change']['actor']['name'])->toBe('Fleet Operations Manager');
});

it('maps asset active operator with canonical DOLE clocks without inferring telemetry', function (): void {
    $operator = User::factory()->create(['name' => 'Maria Lead Operator']);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-HOS-01',
        'name' => '120T All-Terrain Crane',
        'kind' => 'mobile_crane',
        'status' => AssetStatus::Available,
    ]);

    $shift = OperatorShift::query()->create([
        'user_id' => $operator->id,
        'operational_asset_id' => $asset->id,
        'status' => ShiftStatus::ACTIVE,
        'started_at' => now()->subMinutes(570), // 9.5 hours
        'break_minutes' => 90,
    ]);

    OperatorDutyLog::query()->create([
        'user_id' => $operator->id,
        'operator_shift_id' => $shift->id,
        'duty_status' => DutyStatus::OPERATING,
        'started_at' => now()->subMinutes(570),
        'updated_at' => now()->subMinutes(2), // 2 mins ago => fresh
    ]);

    $loaded = OperationalAsset::query()
        ->with([
            'inspections',
            'maintenanceWorkOrders',
            'activeOperatorShift.user:id,name',
            'activeOperatorShift.activeDutyLog',
        ])
        ->whereKey($asset->id)
        ->get();

    $serialized = OperationsWorkspaceViewModel::assets($loaded);

    expect($serialized)->toHaveCount(1);
    $item = $serialized[0];

    expect($item['active_operator'])->not()->toBeNull()
        ->and($item['active_operator']['name'])->toBe('Maria Lead Operator')
        ->and($item['active_operator']['telemetry_status'])->toBe('offline')
        ->and($item['active_operator']['hours_elapsed'])->toBeGreaterThanOrEqual(9.5)
        ->and($item['hos']['duty_status'])->toBe('operating')
        ->and($item['hos']['duty_status_label'])->toBe('Operating')
        ->and($item['hos']['dole_warning'])->toBeTrue()
        ->and($item['hos']['fatigue_status'])->toBe('warning');
});

it('does not derive telemetry status from duty-log activity age', function (): void {
    $testCases = [
        ['minutesAgo' => 5, 'expected' => 'offline'],
        ['minutesAgo' => 20, 'expected' => 'offline'],
        ['minutesAgo' => 45, 'expected' => 'offline'],
    ];

    foreach ($testCases as $index => $case) {
        $operator = User::factory()->create(['name' => "Telemetry Operator {$index}"]);

        $asset = OperationalAsset::query()->create([
            'code' => "CRN-TEL-{$index}",
            'name' => "Crane {$index}",
            'kind' => 'mobile_crane',
            'status' => AssetStatus::Available,
        ]);

        $shift = OperatorShift::query()->create([
            'user_id' => $operator->id,
            'operational_asset_id' => $asset->id,
            'status' => ShiftStatus::ACTIVE,
            'started_at' => now()->subHours(2),
        ]);

        OperatorDutyLog::query()->create([
            'user_id' => $operator->id,
            'operator_shift_id' => $shift->id,
            'duty_status' => DutyStatus::OPERATING,
            'started_at' => now()->subHours(2),
            'updated_at' => now()->subMinutes($case['minutesAgo']),
        ]);

        $loaded = OperationalAsset::query()
            ->with([
                'activeOperatorShift.user:id,name',
                'activeOperatorShift.activeDutyLog',
            ])
            ->whereKey($asset->id)
            ->get();

        $serialized = OperationsWorkspaceViewModel::assets($loaded);
        expect($serialized[0]['active_operator']['telemetry_status'])->toBe($case['expected']);
    }
});

it('maps asset lockout status, defect reasons, and DVIR photos', function (): void {
    Storage::fake('public');

    $operator = User::factory()->create(['name' => 'Inspector Bob']);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-LCK-01',
        'name' => '80T Crawler Crane',
        'kind' => 'crawler_crane',
        'status' => AssetStatus::UnderMaintenance,
    ]);

    $dvir = DvirInspection::query()->create([
        'user_id' => $operator->id,
        'operational_asset_id' => $asset->id,
        'inspection_type' => DvirInspectionType::PRE_TRIP,
        'completed_at' => now()->subMinutes(15),
        'has_defects' => true,
        'critical_defects_count' => 2,
        'signature_captured' => true,
        'inspector_name' => 'Inspector Bob',
    ]);

    DvirInspectionPhoto::query()->create([
        'dvir_inspection_id' => $dvir->id,
        'angle' => 'boom_cylinder',
        'storage_disk' => 'public',
        'file_path' => 'dvir_photos/1/boom_cylinder.jpg',
        'file_name' => 'boom_cylinder.jpg',
        'file_size_bytes' => 102400,
        'mime_type' => 'image/jpeg',
    ]);

    $workOrder = MaintenanceWorkOrder::query()->create([
        'operational_asset_id' => $asset->id,
        'status' => 'pending',
        'priority' => 'critical',
        'dispatch_blocking' => true,
        'defect' => 'Hydraulic hoist cylinder failure detected during pre-trip inspection',
        'reported_at' => now()->subMinutes(15),
    ]);

    $loaded = OperationalAsset::query()
        ->with([
            'inspections',
            'activeBlockingWorkOrder',
            'latestDvirInspection.photos',
        ])
        ->whereKey($asset->id)
        ->get();

    $serialized = OperationsWorkspaceViewModel::assets($loaded);
    $item = $serialized[0];

    expect($item['is_dispatchable'])->toBeFalse()
        ->and($item['latest_dvir'])->not()->toBeNull()
        ->and($item['latest_dvir']['status'])->toBe('critical_defect')
        ->and($item['latest_dvir']['critical_defects_count'])->toBe(2)
        ->and($item['latest_dvir']['photos'])->toHaveCount(1)
        ->and($item['latest_dvir']['photos'][0]['file_name'])->toBe('boom_cylinder.jpg')
        ->and($item['latest_dvir']['photos'][0]['url'])->not()->toBeEmpty()
        ->and($item['lockout']['is_locked_out'])->toBeTrue()
        ->and($item['lockout']['lockout_reason'])->toBe('Hydraulic hoist cylinder failure detected during pre-trip inspection')
        ->and($item['lockout']['critical_defects_count'])->toBe(2)
        ->and($item['lockout']['can_override'])->toBeTrue();
});

it('maps job report delay logs with standby demurrage details and fallback cross-references', function (): void {
    $author = User::factory()->create(['name' => 'Lead Engineer']);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-JOB-888',
        'client' => 'Metro Construction Inc',
        'title' => 'Bridge Girder Placement',
        'site' => 'C5 Flyover',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->subHours(4),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $author->id,
        'version' => 1,
    ]);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-GIRDER',
        'name' => 'Girder Crane',
        'kind' => 'mobile_crane',
        'status' => AssetStatus::Working,
    ]);

    $shift = OperatorShift::query()->create([
        'user_id' => $author->id,
        'operational_asset_id' => $asset->id,
        'dispatch_job_id' => $job->id,
        'status' => ShiftStatus::ACTIVE,
        'started_at' => now()->subHours(4),
    ]);

    OperatorDutyLog::query()->create([
        'user_id' => $author->id,
        'operator_shift_id' => $shift->id,
        'duty_status' => DutyStatus::STANDBY,
        'standby_reason' => StandbyReason::WAITING_ON_CLIENT,
        'is_demurrage_billable' => true,
        'duration_minutes' => 60,
        'started_at' => now()->subHours(3),
        'ended_at' => now()->subHours(2),
    ]);

    $dvir = DvirInspection::query()->create([
        'user_id' => $author->id,
        'operational_asset_id' => $asset->id,
        'dispatch_job_id' => $job->id,
        'inspection_type' => DvirInspectionType::PRE_TRIP,
        'completed_at' => now()->subHours(4),
        'has_defects' => false,
        'critical_defects_count' => 0,
        'signature_captured' => true,
    ]);

    $fuel = FuelRequest::query()->create([
        'dispatch_job_id' => $job->id,
        'operator_shift_id' => $shift->id,
        'requester_id' => $author->id,
        'reference' => 'FUEL-888-01',
        'quantity_litres' => 125.50,
        'fuel_type' => 'diesel',
        'purpose' => 'Crane operations',
        'status' => FuelRequestStatus::Submitted,
    ]);

    $report = JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $author->id,
        'work_summary' => 'Positioned first two spans of concrete girders.',
        'status' => JobReportStatus::Submitted,
        'signer_name' => 'Engr. Roberto Santos',
        'signer_role' => 'Project Quality Inspector',
        'signed_at' => now(),
    ]);

    // Test with un-eager loaded job relations to exercise the fallback query branch
    $reports = JobReport::query()
        ->with([
            'job:id,reference,title',
            'author:id,name',
        ])
        ->whereKey($report->id)
        ->get();

    $serialized = OperationsWorkspaceViewModel::jobReports($reports);

    expect($serialized)->toHaveCount(1);
    $item = $serialized[0];

    expect($item['signer_name'])->toBe('Engr. Roberto Santos')
        ->and($item['signer_role'])->toBe('Project Quality Inspector')
        ->and($item['signed_at'])->not()->toBeNull()
        ->and($item['delay_logs'])->toHaveCount(1)
        ->and($item['delay_logs'][0]['duty_status'])->toBe('standby')
        ->and($item['delay_logs'][0]['standby_reason'])->toBe('waiting_on_client')
        ->and($item['delay_logs'][0]['is_demurrage_billable'])->toBeTrue()
        ->and($item['delay_logs'][0]['duration_minutes'])->toBe(60)
        ->and($item['cross_references']['associated_dvirs'])->toHaveCount(1)
        ->and($item['cross_references']['associated_dvirs'][0]['id'])->toBe($dvir->id)
        ->and($item['cross_references']['associated_fuel_requests'])->toHaveCount(1)
        ->and($item['cross_references']['associated_fuel_requests'][0]['reference'])->toBe('FUEL-888-01');
});

it('serializes fuel request created_at and submitted_at timestamps accurately', function (): void {
    $requester = User::factory()->create();
    $fuelRequest = FuelRequest::query()->create([
        'requester_id' => $requester->id,
        'reference' => 'FUEL-TEST-001',
        'quantity_litres' => 50.0,
        'fuel_type' => 'diesel',
        'purpose' => 'Refueling test',
        'status' => FuelRequestStatus::Submitted,
    ]);

    $serialized = FuelWorkspaceViewModel::single($fuelRequest);

    expect($serialized['created_at'])->not()->toBeNull()
        ->and($serialized['created_at'])->toBe($fuelRequest->created_at->toIso8601String())
        ->and($serialized['submitted_at'])->not()->toBeNull()
        ->and($serialized['submitted_at'])->toBe($fuelRequest->created_at->toIso8601String());
});

it('faithfully preserves null location, meter, and capacity unit in operational assets', function (): void {
    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-NULL-01',
        'name' => 'Bare Crane',
        'kind' => 'mobile_crane',
        'status' => AssetStatus::Available,
        'capacity_unit' => null,
    ]);

    $loaded = OperationalAsset::query()
        ->with([
            'activeOperatorShift.user:id,name',
            'activeOperatorShift.activeDutyLog',
        ])
        ->whereKey($asset->id)
        ->get();

    $serialized = OperationsWorkspaceViewModel::assets($loaded);
    $item = $serialized[0];

    expect($item['capacity_unit'])->toBeNull()
        ->and($item['location'])->toBeNull()
        ->and($item['meter_value'])->toBeNull()
        ->and($item['meter_type'])->toBeNull();
});

it('faithfully preserves null coordinates in job reports for honest UI fallback', function (): void {
    $author = User::factory()->create();
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-JOB-NULL-COORDS',
        'client' => 'Client Inc',
        'title' => 'Coord Test Job',
        'site' => 'Site A',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->subHour(),
        'scheduled_end' => now()->addHour(),
        'created_by' => $author->id,
        'version' => 1,
    ]);

    $report = JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $author->id,
        'work_summary' => 'Report with unrecorded location coordinates',
        'status' => JobReportStatus::Submitted,
        'latitude' => null,
        'longitude' => null,
        'started_at' => null,
        'ended_at' => null,
    ]);

    $reports = JobReport::query()
        ->with(['job:id,reference,title', 'author:id,name'])
        ->whereKey($report->id)
        ->get();

    $serialized = OperationsWorkspaceViewModel::jobReports($reports);
    $item = $serialized[0];

    expect($item['latitude'])->toBeNull()
        ->and($item['longitude'])->toBeNull()
        ->and($item['started_at'])->toBeNull()
        ->and($item['ended_at'])->toBeNull();
});

it('serializes pre-trip and post-trip dvir_inspections log with meters, checks, and photos', function (): void {
    Storage::fake('public');

    $operator = User::factory()->create(['name' => 'Carlos Operator']);

    $asset = OperationalAsset::query()->create([
        'code' => 'TRK-DVIR-01',
        'name' => 'Prime Mover 01',
        'kind' => 'prime_mover',
        'status' => AssetStatus::Available,
    ]);

    $preTrip = DvirInspection::query()->create([
        'user_id' => $operator->id,
        'operational_asset_id' => $asset->id,
        'inspection_type' => DvirInspectionType::PRE_TRIP,
        'starting_odometer_km' => 45100.5,
        'engine_hours' => 1200.0,
        'completed_at' => now()->subHours(8),
        'has_defects' => false,
        'critical_defects_count' => 0,
        'signature_captured' => true,
        'inspector_name' => 'Carlos Operator',
        'remarks' => 'Pre-trip all green',
    ]);

    $postTrip = DvirInspection::query()->create([
        'user_id' => $operator->id,
        'operational_asset_id' => $asset->id,
        'inspection_type' => DvirInspectionType::POST_TRIP,
        'starting_odometer_km' => 45100.5,
        'ending_odometer_km' => 45350.0,
        'engine_hours' => 1208.5,
        'completed_at' => now()->subMinutes(30),
        'has_defects' => true,
        'critical_defects_count' => 1,
        'signature_captured' => true,
        'inspector_name' => 'Carlos Operator',
        'remarks' => 'Air brake line hiss noticed upon parking',
    ]);

    DvirInspectionPhoto::query()->create([
        'dvir_inspection_id' => $postTrip->id,
        'angle' => 'defect_brake_line',
        'storage_disk' => 'public',
        'file_path' => 'dvir_photos/2/brake.jpg',
        'file_name' => 'brake.jpg',
        'file_size_bytes' => 84000,
        'mime_type' => 'image/jpeg',
    ]);

    DvirInspectionCheck::query()->create([
        'dvir_inspection_id' => $postTrip->id,
        'category' => 'Brakes',
        'label' => 'Service Brakes & Air Lines',
        'status' => DvirCheckStatus::CRITICAL,
        'notes' => 'Audible air leak near rear axle reservoir',
        'sort_order' => 1,
    ]);

    $loaded = OperationalAsset::query()
        ->with([
            'inspections',
            'latestDvirInspection.photos',
            'latestDvirInspection.checks',
            'dvirInspections' => fn ($q) => $q->latest('completed_at'),
            'dvirInspections.photos',
            'dvirInspections.checks',
        ])
        ->whereKey($asset->id)
        ->get();

    $serialized = OperationsWorkspaceViewModel::assets($loaded);
    $item = $serialized[0];

    expect($item['dvir_inspections'])->toHaveCount(2)
        ->and($item['dvir_inspections'][0]['type'])->toBe('post_trip')
        ->and($item['dvir_inspections'][0]['status'])->toBe('critical_defect')
        ->and($item['dvir_inspections'][0]['starting_odometer_km'])->toBe(45100.5)
        ->and($item['dvir_inspections'][0]['ending_odometer_km'])->toBe(45350.0)
        ->and($item['dvir_inspections'][0]['engine_hours'])->toBe(1208.5)
        ->and($item['dvir_inspections'][0]['remarks'])->toBe('Air brake line hiss noticed upon parking')
        ->and($item['dvir_inspections'][0]['photos'])->toHaveCount(1)
        ->and($item['dvir_inspections'][0]['defects'])->toHaveCount(1)
        ->and($item['dvir_inspections'][0]['defects'][0]['category'])->toBe('Brakes')
        ->and($item['dvir_inspections'][0]['defects'][0]['status'])->toBe('critical')
        ->and($item['dvir_inspections'][1]['type'])->toBe('pre_trip')
        ->and($item['dvir_inspections'][1]['status'])->toBe('passed')
        ->and($item['dvir_inspections'][1]['has_defects'])->toBeFalse();
});

it('OperationsWorkspaceViewModel hydrates real personnel names and equipment details in gptRecommendations', function (): void {
    $dispatcher = User::factory()->create(['name' => 'Dispatch Manager']);
    $driver = User::factory()->create(['name' => 'Sarah Operator']);
    $driver->syncRoles([RoleName::CraneOperator->value]);

    $crane = OperationalAsset::query()->create([
        'code' => 'CR-101',
        'name' => 'Liebherr LTM 1050',
        'kind' => 'mobile_crane',
        'rated_capacity' => 50,
        'capacity_unit' => 't',
        'status' => AssetStatus::Available,
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-REC-HYDRATE',
        'client' => 'Acme Corp',
        'title' => 'Structural Lift',
        'site' => 'BGC Taguig',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
        'version' => 1,
    ]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'hash-123',
        'input_references' => ['user_ids' => [$driver->id], 'asset_ids' => [$crane->id]],
        'recommendation' => [
            'summary' => 'Recommend assigning eligible resources.',
            'proposed_personnel' => [
                ['user_id' => $driver->id, 'assignment_type' => 'operator'],
            ],
            'proposed_assets' => [
                ['operational_asset_id' => $crane->id, 'assignment_type' => 'crane'],
            ],
        ],
        'conflicts' => [],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(15),
    ])->load(['requestedBy', 'decidedBy']);

    $serialized = OperationsWorkspaceViewModel::gptRecommendations(collect([$recommendation]));
    $item = $serialized[0];

    expect($item['proposed_personnel'])->toHaveCount(1)
        ->and($item['proposed_personnel'][0]['user_id'])->toBe($driver->id)
        ->and($item['proposed_personnel'][0]['name'])->toBe('Sarah Operator')
        ->and($item['proposed_personnel'][0]['role'])->toBe('crane_operator')
        ->and($item['proposed_personnel'][0]['assignment_type'])->toBe('operator')
        ->and($item['proposed_assets'])->toHaveCount(1)
        ->and($item['proposed_assets'][0]['operational_asset_id'])->toBe($crane->id)
        ->and($item['proposed_assets'][0]['asset_code'])->toBe('CR-101')
        ->and($item['proposed_assets'][0]['name'])->toBe('Liebherr LTM 1050')
        ->and($item['proposed_assets'][0]['capacity'])->toBe('50 t')
        ->and($item['proposed_assets'][0]['kind'])->toBe('mobile_crane')
        ->and($item['recommendation']['proposed_personnel'][0]['name'])->toBe('Sarah Operator')
        ->and($item['recommendation']['proposed_assets'][0]['asset_code'])->toBe('CR-101');
});

it('OperationsWorkspaceViewModel hydrates soft-deleted assets in gptRecommendations', function (): void {
    $dispatcher = User::factory()->create(['name' => 'Dispatch Manager']);
    $crane = OperationalAsset::query()->create([
        'code' => 'CR-RET-01',
        'name' => 'Retired Demag AC50',
        'kind' => 'crane',
        'rated_capacity' => 60,
        'capacity_unit' => 't',
        'status' => AssetStatus::UnderMaintenance,
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-REC-SOFTDEL',
        'client' => 'Acme Corp',
        'title' => 'Bridge Lift',
        'site' => 'Makati City',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
        'version' => 1,
    ]);

    $craneId = $crane->id;
    $crane->delete(); // soft delete

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'hash-softdel',
        'input_references' => ['user_ids' => [], 'asset_ids' => [$craneId]],
        'recommendation' => [
            'summary' => 'Historical recommendation with soft-deleted asset.',
            'proposed_assets' => [
                ['operational_asset_id' => $craneId, 'assignment_type' => 'crane'],
            ],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(15),
    ])->load(['requestedBy', 'decidedBy']);

    $serialized = OperationsWorkspaceViewModel::gptRecommendations(collect([$recommendation]));
    $item = $serialized[0];

    expect($item['proposed_assets'])->toHaveCount(1)
        ->and($item['proposed_assets'][0]['operational_asset_id'])->toBe($craneId)
        ->and($item['proposed_assets'][0]['asset_code'])->toBe('CR-RET-01')
        ->and($item['proposed_assets'][0]['name'])->toBe('Retired Demag AC50')
        ->and($item['proposed_assets'][0]['capacity'])->toBe('60 t');
});

it('OperationsWorkspaceViewModel normalizes scalar resource IDs and filters empty entries', function (): void {
    $dispatcher = User::factory()->create(['name' => 'Dispatch Manager']);
    $driver = User::factory()->create(['name' => 'Scalar Driver']);
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $truck = OperationalAsset::query()->create([
        'code' => 'TRK-SCALAR',
        'name' => 'Volvo FH16',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'JOB-REC-SCALAR',
        'client' => 'Acme Corp',
        'title' => 'Material Transport',
        'site' => 'Ortigas',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
        'version' => 1,
    ]);

    $recommendation = GptRecommendation::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'requested_by' => $dispatcher->id,
        'purpose' => 'dispatch_assignment',
        'context_hash' => 'hash-scalar',
        'input_references' => ['user_ids' => [$driver->id], 'asset_ids' => [$truck->id]],
        'recommendation' => [
            'summary' => 'Recommendation with scalar resource IDs.',
            'proposed_personnel' => [$driver->id, null, 0, 'invalid'],
            'proposed_assets' => [$truck->id, null, -1],
        ],
        'model' => 'gpt-5-mini',
        'status' => 'pending_review',
        'expires_at' => now()->addMinutes(15),
    ])->load(['requestedBy', 'decidedBy']);

    $serialized = OperationsWorkspaceViewModel::gptRecommendations(collect([$recommendation]));
    $item = $serialized[0];

    expect($item['proposed_personnel'])->toHaveCount(1)
        ->and($item['proposed_personnel'][0]['user_id'])->toBe($driver->id)
        ->and($item['proposed_personnel'][0]['name'])->toBe('Scalar Driver')
        ->and($item['proposed_assets'])->toHaveCount(1)
        ->and($item['proposed_assets'][0]['operational_asset_id'])->toBe($truck->id)
        ->and($item['proposed_assets'][0]['asset_code'])->toBe('TRK-SCALAR')
        ->and($item['proposed_assets'][0]['name'])->toBe('Volvo FH16');
});
