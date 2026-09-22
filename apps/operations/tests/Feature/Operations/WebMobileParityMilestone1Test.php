<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dvir\Enums\DvirInspectionType;
use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
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

test('OperationalAsset exposes DVIR and OperatorShift relationships and active states', function () {
    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-TEST-1',
        'name' => '50T Mobile Crane',
        'kind' => 'mobile_crane',
        'status' => AssetStatus::Available,
    ]);

    $user = User::factory()->create();

    // Create an older DVIR
    DvirInspection::query()->create([
        'user_id' => $user->id,
        'operational_asset_id' => $asset->id,
        'inspection_type' => DvirInspectionType::PRE_TRIP,
        'completed_at' => now()->subHours(5),
        'has_defects' => false,
        'signature_captured' => true,
    ]);

    // Create a newer DVIR
    $latestDvir = DvirInspection::query()->create([
        'user_id' => $user->id,
        'operational_asset_id' => $asset->id,
        'inspection_type' => DvirInspectionType::POST_TRIP,
        'completed_at' => now()->subHour(),
        'has_defects' => true,
        'signature_captured' => true,
    ]);

    expect($asset->dvirInspections)->toHaveCount(2)
        ->and($asset->latestDvirInspection->id)->toBe($latestDvir->id);

    // Create completed shift
    OperatorShift::query()->create([
        'user_id' => $user->id,
        'operational_asset_id' => $asset->id,
        'status' => ShiftStatus::COMPLETED,
        'started_at' => now()->subDays(1),
        'ended_at' => now()->subDays(1)->addHours(8),
    ]);

    // Create active shift
    $activeShift = OperatorShift::query()->create([
        'user_id' => $user->id,
        'operational_asset_id' => $asset->id,
        'status' => ShiftStatus::ACTIVE,
        'started_at' => now()->subHours(2),
    ]);

    expect($asset->operatorShifts)->toHaveCount(2)
        ->and($asset->activeOperatorShift->id)->toBe($activeShift->id);
});

test('CreateDvirInspectionAction locks asset and creates blocking maintenance order on critical defect', function () {
    Storage::fake('public');
    Storage::fake('r2');

    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-CRITICAL-1',
        'name' => '100T Rough Terrain Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    $payload = [
        'operational_asset_id' => $asset->id,
        'inspection_type' => 'pre_trip',
        'has_defects' => true,
        'signature_captured' => true,
        'inspector_name' => 'John Operator',
        'remarks' => 'Hydraulic hoist cylinder failure',
        'checks' => [
            [
                'id' => 'chk-hyd-01',
                'category' => 'hydraulics',
                'label' => 'Main hoist cylinder',
                'status' => 'critical',
                'status_label' => 'Critical Leak',
            ],
            [
                'id' => 'chk-brakes-01',
                'category' => 'chassis',
                'label' => 'Service brakes',
                'status' => 'good',
                'status_label' => 'Passed',
            ],
        ],
        'photos' => [],
    ];

    $response = $this->withToken($token)
        ->postJson('/api/v1/dvir/inspections', $payload);

    $response->assertCreated();
    expect($response->json('data.critical_defects_count'))->toBe(1);

    // Verify asset locked out
    $asset->refresh();
    expect($asset->status)->toBe(AssetStatus::UnderMaintenance);

    // Verify blocking maintenance work order created
    $workOrder = MaintenanceWorkOrder::query()
        ->where('operational_asset_id', $asset->id)
        ->where('dispatch_blocking', true)
        ->first();

    expect($workOrder)->not()->toBeNull()
        ->and($workOrder->status)->toBe('pending')
        ->and($workOrder->dispatch_blocking)->toBeTrue();
});

test('OperationsWorkspaceViewModel serializes active operator, HoS, latest DVIR, and lockout', function () {
    $operator = User::factory()->create(['name' => 'Dan Driver']);
    $operator->syncRoles([RoleName::CraneOperator->value]);

    $asset = OperationalAsset::query()->create([
        'code' => 'TRK-01',
        'name' => 'Heavy Lowbed Truck',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
    ]);

    // Active shift with duty log
    $shift = OperatorShift::query()->create([
        'user_id' => $operator->id,
        'operational_asset_id' => $asset->id,
        'status' => ShiftStatus::ACTIVE,
        'started_at' => now()->subHours(3),
    ]);

    OperatorDutyLog::query()->create([
        'user_id' => $operator->id,
        'operator_shift_id' => $shift->id,
        'duty_status' => DutyStatus::DRIVING,
        'started_at' => now()->subHours(3),
    ]);

    // Latest DVIR
    DvirInspection::query()->create([
        'user_id' => $operator->id,
        'operational_asset_id' => $asset->id,
        'inspection_type' => DvirInspectionType::PRE_TRIP,
        'completed_at' => now()->subHours(3),
        'has_defects' => false,
        'signature_captured' => true,
    ]);

    $loadedAsset = OperationalAsset::query()
        ->with([
            'inspections',
            'maintenanceWorkOrders',
            'activeOperatorShift.user:id,name',
            'activeOperatorShift.activeDutyLog',
            'latestDvirInspection.photos',
            'latestDvirInspection.checks',
        ])
        ->whereKey($asset->id)
        ->get();

    $serialized = OperationsWorkspaceViewModel::assets($loadedAsset);

    expect($serialized)->toHaveCount(1);
    $item = $serialized[0];

    expect($item['active_operator'])->not()->toBeNull()
        ->and($item['active_operator']['name'])->toBe('Dan Driver')
        ->and($item['active_operator']['telemetry_status'])->toBe('offline')
        ->and($item['hos']['duty_status'])->toBe('driving')
        ->and($item['hos']['dole_warning'])->toBeFalse()
        ->and($item['latest_dvir']['status'])->toBe('passed')
        ->and($item['latest_dvir']['has_defects'])->toBeFalse()
        ->and($item['lockout']['is_locked_out'])->toBeFalse();
});

test('OperationsWorkspaceViewModel serializes JobReport signer and cross-references', function () {
    $author = User::factory()->create(['name' => 'Report Author']);
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-TEST-99',
        'client' => 'Client XYZ',
        'title' => 'Erection Job',
        'site' => 'BGC Taguig',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->subHour(),
        'scheduled_end' => now()->addHours(2),
        'created_by' => $author->id,
        'version' => 1,
    ]);

    $report = JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $author->id,
        'work_summary' => 'Completed crane lift operations.',
        'status' => JobReportStatus::Submitted,
        'signer_name' => 'Maria Client Rep',
        'signer_role' => 'Site Engineer',
        'signed_at' => now(),
    ]);

    $reports = JobReport::query()
        ->with([
            'job:id,reference,title',
            'job.dvirInspections',
            'job.fuelRequests',
            'author:id,name',
            'attachments',
        ])
        ->whereKey($report->id)
        ->get();

    $serialized = OperationsWorkspaceViewModel::jobReports($reports);

    expect($serialized)->toHaveCount(1);
    $item = $serialized[0];

    expect($item['signer_name'])->toBe('Maria Client Rep')
        ->and($item['signer_role'])->toBe('Site Engineer')
        ->and($item['signed_at'])->not()->toBeNull()
        ->and($item['cross_references'])->toHaveKeys(['associated_dvirs', 'associated_fuel_requests']);
});
