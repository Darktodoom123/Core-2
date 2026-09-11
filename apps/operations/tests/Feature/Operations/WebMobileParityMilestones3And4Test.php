<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dvir\Enums\DvirInspectionType;
use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Enums\StandbyReason;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('private');
});

test('fuel request passes through 5-stage lifecycle with monotonic meter enforcement', function () {
    $operator = User::factory()->create();
    $operator->assignRole(RoleName::CraneOperator->value);

    $lead = User::factory()->create();
    $lead->assignRole(RoleName::OperationsManager->value);

    $dispatcher = User::factory()->create();
    $dispatcher->assignRole(RoleName::OperationsManager->value);

    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-50-001',
        'name' => '50T Hydraulic Crane',
        'kind' => 'mobile_crane',
        'status' => AssetStatus::Available,
        'meter_type' => 'hour_meter',
        'meter_value' => 1500.0,
        'baseline_burn_rate' => 20.0,
        'burn_rate_unit' => 'L/hr',
    ]);

    $shift = OperatorShift::query()->create([
        'user_id' => $operator->id,
        'operational_asset_id' => $asset->id,
        'status' => ShiftStatus::ACTIVE,
        'started_at' => now()->subHours(4),
    ]);

    // 1. Submit Fuel Request
    $response = $this->actingAs($operator)->post('/operations/fuel-requests', [
        'operational_asset_id' => $asset->id,
        'operator_shift_id' => $shift->id,
        'quantity_litres' => 100,
        'fuel_type' => 'diesel',
        'purpose' => 'Site foundation lift shift refill',
    ]);

    $response->assertRedirect();
    $fuel = FuelRequest::query()->where('operational_asset_id', $asset->id)->firstOrFail();
    expect($fuel->status)->toBe(FuelRequestStatus::Submitted)
        ->and($fuel->operator_shift_id)->toBe($shift->id);

    // 2. Forward Request (Lead/Supervisor)
    $response = $this->actingAs($lead)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'forwarded',
        'reason' => 'Shift allocation verified',
    ]);
    $response->assertRedirect();
    $fuel->refresh();
    expect($fuel->status)->toBe(FuelRequestStatus::Forwarded);

    // 3. Approve Request (Dispatcher/Manager)
    $response = $this->actingAs($dispatcher)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'approved',
        'reason' => 'Approved for Shell Subic refueling',
    ]);
    $response->assertRedirect();
    $fuel->refresh();
    expect($fuel->status)->toBe(FuelRequestStatus::Approved);

    // 4. Verify Request
    $response = $this->actingAs($dispatcher)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'verified',
    ]);
    $response->assertRedirect();
    $fuel->refresh();
    expect($fuel->status)->toBe(FuelRequestStatus::Verified);

    // 5. Attempt Log with Monotonic Violation (entered meter < asset meter: 1400 < 1500)
    $response = $this->actingAs($operator)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'logged',
        'quantity_litres' => 100,
        'hour_meter' => 1400.0, // Less than current 1500.0
        'fuel_station' => 'Shell Subic',
    ]);
    $response->assertSessionHasErrors('hour_meter');

    // 6. Successful Log with Monotonic Meter Reading and Receipt
    $receipt = UploadedFile::fake()->image('fuel_receipt.jpg');
    $response = $this->actingAs($operator)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'logged',
        'quantity_litres' => 100,
        'hour_meter' => 1505.0, // Progressed by 5 hours
        'price_per_litre' => 60.00,
        'total_cost' => 6000.00,
        'fuel_station' => 'Shell Subic',
        'remarks' => 'Full tank top-off',
        'receipt' => $receipt,
    ]);

    $response->assertRedirect();
    $fuel->refresh();
    $asset->refresh();

    expect($fuel->status)->toBe(FuelRequestStatus::Logged)
        ->and((float) $asset->meter_value)->toBe(1505.0)
        ->and($fuel->logs)->toHaveCount(1);

    $log = $fuel->logs->first();
    expect($log->fuel_station)->toBe('Shell Subic')
        ->and((float) $log->price_per_litre)->toBe(60.0)
        ->and((float) $log->total_cost)->toBe(6000.0)
        ->and($log->receipt_path)->not->toBeNull();
});

test('fuel logging calculates consumption variance and flags anomalies', function () {
    $operator = User::factory()->create();
    $operator->assignRole(RoleName::CraneOperator->value);

    // Baseline: 10 L/hr. Asset was at 100 hrs.
    $asset = OperationalAsset::query()->create([
        'code' => 'GEN-100',
        'name' => 'Generator 100kVA',
        'kind' => 'generator',
        'status' => AssetStatus::Available,
        'meter_type' => 'hour_meter',
        'meter_value' => 100.0,
        'baseline_burn_rate' => 10.0,
        'burn_rate_unit' => 'L/hr',
    ]);

    // Fuel request verified
    $fuel = FuelRequest::query()->create([
        'reference' => 'FUEL-ANOMALY-001',
        'requester_id' => $operator->id,
        'operational_asset_id' => $asset->id,
        'quantity_litres' => 20,
        'fuel_type' => 'diesel',
        'purpose' => 'Site continuous power',
        'status' => FuelRequestStatus::Verified,
    ]);

    // Log: asset operated 2 hours (100 -> 102 hrs), expected consumption = 2 hrs * 10 L/hr = 20 L.
    // Actual dispensed = 50 L. Variance = (50 - 20) / 20 = +150% (>= 15% threshold!).
    $response = $this->actingAs($operator)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'logged',
        'quantity_litres' => 50,
        'hour_meter' => 102.0,
        'fuel_station' => 'Petron Depot',
    ]);

    $response->assertRedirect();
    $fuel->refresh();
    $log = $fuel->logs->first();

    expect($log->is_anomaly)->toBeTrue()
        ->and((float) $log->variance_litres)->toBe(30.0)
        ->and((float) $log->variance_percentage)->toBe(150.0)
        ->and($log->anomaly_reason)->toContain('exceeds baseline');
});

test('OperationsWorkspaceViewModel serializes Job Reports with signatures, delay logs, and cross-references', function () {
    $author = User::factory()->create(['name' => 'Edgar Operator']);

    $asset = OperationalAsset::query()->create([
        'code' => 'EXC-002',
        'name' => 'Hydraulic Excavator',
        'kind' => 'excavator',
        'status' => AssetStatus::Available,
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-JOB-777',
        'title' => 'Harbor Deep Dredging Phase 1',
        'client' => 'Manila International Port Authority',
        'site' => 'Pier 3 Pierhead Terminal',
        'created_by' => $author->id,
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
    ]);

    $shift = OperatorShift::query()->create([
        'user_id' => $author->id,
        'operational_asset_id' => $asset->id,
        'dispatch_job_id' => $job->id,
        'status' => ShiftStatus::ACTIVE,
        'started_at' => now()->subHours(6),
    ]);

    // Create standby duty log for the shift
    OperatorDutyLog::query()->create([
        'user_id' => $author->id,
        'operator_shift_id' => $shift->id,
        'duty_status' => DutyStatus::STANDBY,
        'standby_reason' => StandbyReason::WAITING_ON_CLIENT->value,
        'is_demurrage_billable' => true,
        'started_at' => now()->subHours(4),
        'ended_at' => now()->subHours(2),
        'duration_minutes' => 120,
    ]);

    // Create associated DVIR
    $dvir = DvirInspection::query()->create([
        'user_id' => $author->id,
        'operational_asset_id' => $asset->id,
        'dispatch_job_id' => $job->id,
        'inspection_type' => DvirInspectionType::PRE_TRIP,
        'completed_at' => now()->subHours(5),
        'has_defects' => false,
        'signature_captured' => true,
    ]);

    // Create associated Fuel Request
    $fuel = FuelRequest::query()->create([
        'reference' => 'FUEL-JOB-777-1',
        'requester_id' => $author->id,
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $asset->id,
        'quantity_litres' => 85,
        'fuel_type' => 'diesel',
        'purpose' => 'Excavator shift fill',
        'status' => FuelRequestStatus::Logged,
    ]);

    // Create Job Report with client digital signature
    $report = JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $author->id,
        'status' => JobReportStatus::Submitted,
        'work_summary' => 'Completed excavation on Pier 3 foundation according to civil engineering drawings.',
        'ending_meter_value' => 450.5,
        'meter_type' => 'engine_hours',
        'started_at' => now()->subHours(6),
        'ended_at' => now()->subHours(1),
        'submitted_at' => now(),
        'signer_name' => 'Engr. Roberto Cruz',
        'signer_role' => 'Principal Resident Engineer',
        'signed_at' => now()->subMinutes(30),
        'latitude' => 14.5995,
        'longitude' => 120.9842,
    ]);

    $reports = JobReport::query()->with(['job', 'author', 'attachments'])->where('id', $report->id)->get();
    $serialized = OperationsWorkspaceViewModel::jobReports($reports);

    expect($serialized)->toHaveCount(1);
    $item = $serialized[0];

    // Verify digital sign-off props
    expect($item['signer_name'])->toBe('Engr. Roberto Cruz')
        ->and($item['signer_role'])->toBe('Principal Resident Engineer')
        ->and($item['signed_at'])->not->toBeNull();

    // Verify delay logs
    expect($item['delay_logs'])->toHaveCount(1)
        ->and($item['delay_logs'][0]['standby_reason'])->toBe(StandbyReason::WAITING_ON_CLIENT->value)
        ->and($item['delay_logs'][0]['is_demurrage_billable'])->toBeTrue()
        ->and($item['delay_logs'][0]['duration_minutes'])->toBe(120);

    // Verify cross-references
    expect($item['cross_references']['associated_dvirs'])->toHaveCount(1)
        ->and($item['cross_references']['associated_dvirs'][0]['id'])->toBe($dvir->id)
        ->and($item['cross_references']['associated_fuel_requests'])->toHaveCount(1)
        ->and($item['cross_references']['associated_fuel_requests'][0]['reference'])->toBe('FUEL-JOB-777-1');
});
