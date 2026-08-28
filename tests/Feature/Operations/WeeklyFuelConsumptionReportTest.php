<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Enums\FuelBurnRateUnit;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Actions\GenerateWeeklyFuelConsumptionSummary;
use App\Platform\Reporting\Enums\ReportExportType;
use App\Platform\Reporting\Exports\WeeklyFuelConsumptionExportDataset;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('private');
});

function createWeeklyReportUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

it('generates weekly fuel consumption summary with aggregated metrics, breakdowns, and anomalies', function () {
    $manager = createWeeklyReportUser(RoleName::OperationsManager);
    $driver = createWeeklyReportUser(RoleName::CraneOperator);

    $truck = OperationalAsset::query()->create([
        'code' => 'TRK-WEEKLY-01',
        'name' => 'Weekly Haul Truck',
        'kind' => 'truck',
        'subtype' => 'flatbed',
        'status' => AssetStatus::ReadyForService,
        'meter_type' => 'odometer',
        'meter_value' => 10000,
        'baseline_burn_rate' => 0.35,
        'burn_rate_unit' => FuelBurnRateUnit::LitresPerKm->value,
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-WEEKLY-01',
        'client' => 'Metro Logistics',
        'title' => 'Weekly Route Delivery',
        'site' => 'Depot 1',
        'status' => DispatchStatus::Dispatched,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now(),
        'scheduled_end' => now()->addHours(6),
        'created_by' => $manager->id,
    ]);

    $now = Carbon::parse('2026-08-27 10:00:00');
    Carbon::setTestNow($now);

    // Fuel Log 1: Normal log (100L requested, 105L consumed, delta = 300 km -> 0.35 L/km burn rate)
    $request1 = FuelRequest::query()->create([
        'reference' => 'FUEL-W1',
        'requester_id' => $driver->id,
        'operational_asset_id' => $truck->id,
        'dispatch_job_id' => $job->id,
        'quantity_litres' => 100.00,
        'fuel_type' => 'diesel',
        'purpose' => 'Route A',
        'status' => FuelRequestStatus::Logged,
    ]);
    FuelLog::query()->create([
        'fuel_request_id' => $request1->id,
        'recorded_by' => $driver->id,
        'quantity_litres' => 105.00,
        'odometer_km' => 10300,
        'price_per_litre' => 1.50,
        'total_cost' => 157.50,
        'fuel_station' => 'Caltex 1',
        'variance_litres' => 5.00,
        'variance_percentage' => 5.00,
        'effective_burn_rate' => 0.35,
        'burn_rate_unit' => FuelBurnRateUnit::LitresPerKm->value,
        'is_anomaly' => false,
        'recorded_at' => $now,
    ]);

    // Fuel Log 2: Anomaly log (100L requested, 130L consumed -> +30.0% variance)
    $request2 = FuelRequest::query()->create([
        'reference' => 'FUEL-W2',
        'requester_id' => $driver->id,
        'operational_asset_id' => $truck->id,
        'dispatch_job_id' => $job->id,
        'quantity_litres' => 100.00,
        'fuel_type' => 'diesel',
        'purpose' => 'Route B',
        'status' => FuelRequestStatus::Logged,
    ]);
    FuelLog::query()->create([
        'fuel_request_id' => $request2->id,
        'recorded_by' => $driver->id,
        'quantity_litres' => 130.00,
        'odometer_km' => 10550,
        'price_per_litre' => 1.50,
        'total_cost' => 195.00,
        'fuel_station' => 'Shell Expressway',
        'variance_litres' => 30.00,
        'variance_percentage' => 30.00,
        'effective_burn_rate' => 0.52,
        'burn_rate_unit' => FuelBurnRateUnit::LitresPerKm->value,
        'is_anomaly' => true,
        'anomaly_reason' => 'Quantity variance (+30.0%) exceeds 15% threshold',
        'recorded_at' => $now->copy()->addDay(),
    ]);

    $action = app(GenerateWeeklyFuelConsumptionSummary::class);
    $report = $action->execute($manager, $now);

    expect($report['summary']['total_litres_requested'])->toBe(200.00)
        ->and($report['summary']['total_litres_consumed'])->toBe(235.00)
        ->and($report['summary']['net_variance_litres'])->toBe(35.00)
        ->and($report['summary']['net_variance_percentage'])->toBe(17.50)
        ->and($report['summary']['total_spend'])->toBe(352.50)
        ->and($report['summary']['logs_count'])->toBe(2)
        ->and($report['summary']['anomalies_count'])->toBe(1);

    expect($report['anomalies'])->toHaveCount(1)
        ->and($report['anomalies'][0]['reference'])->toBe('FUEL-W2')
        ->and($report['anomalies'][0]['anomaly_reason'])->toContain('Quantity variance (+30.0%)');

    expect($report['by_asset'])->toHaveCount(1)
        ->and($report['by_asset'][0]['asset_code'])->toBe('TRK-WEEKLY-01')
        ->and($report['by_asset'][0]['total_litres'])->toBe(235.00)
        ->and($report['by_asset'][0]['anomaly_count'])->toBe(1);

    expect($report['by_job'])->toHaveCount(1)
        ->and($report['by_job'][0]['reference'])->toBe('DSP-WEEKLY-01')
        ->and($report['by_job'][0]['total_litres'])->toBe(235.00);

    Carbon::setTestNow();
});

it('streams formatted rows and headers in WeeklyFuelConsumptionExportDataset', function () {
    $manager = createWeeklyReportUser(RoleName::OperationsManager);
    $driver = createWeeklyReportUser(RoleName::CraneOperator);

    $truck = OperationalAsset::query()->create([
        'code' => 'TRK-EXP-01',
        'name' => 'Export Truck',
        'kind' => 'truck',
        'status' => AssetStatus::ReadyForService,
        'baseline_burn_rate' => 0.35,
        'burn_rate_unit' => FuelBurnRateUnit::LitresPerKm->value,
    ]);

    $request = FuelRequest::query()->create([
        'reference' => 'FUEL-EXP-01',
        'requester_id' => $driver->id,
        'operational_asset_id' => $truck->id,
        'quantity_litres' => 150.00,
        'fuel_type' => 'diesel',
        'purpose' => 'Export Test',
        'status' => FuelRequestStatus::Logged,
    ]);

    FuelLog::query()->create([
        'fuel_request_id' => $request->id,
        'recorded_by' => $driver->id,
        'quantity_litres' => 150.00,
        'odometer_km' => 12000,
        'price_per_litre' => 1.60,
        'total_cost' => 240.00,
        'fuel_station' => 'Petron Coastal',
        'variance_litres' => 0.00,
        'variance_percentage' => 0.00,
        'effective_burn_rate' => 0.35,
        'burn_rate_unit' => FuelBurnRateUnit::LitresPerKm->value,
        'is_anomaly' => false,
        'recorded_at' => now(),
    ]);

    /** @var WeeklyFuelConsumptionExportDataset $dataset */
    $dataset = app(WeeklyFuelConsumptionExportDataset::class);

    expect($dataset->type())->toBe(ReportExportType::WeeklyFuelConsumption)
        ->and($dataset->authorize($manager))->toBeTrue()
        ->and($dataset->headers())->toContain('Log ID', 'Week Range', 'Asset Code', 'Variance (L)', 'Is Anomaly');

    $rows = iterator_to_array($dataset->rows($manager, []));
    expect($rows)->toHaveCount(1)
        ->and($rows[0][2])->toBe('TRK-EXP-01')
        ->and($rows[0][14])->toBe('NO');
});

it('enforces RBAC authorization for weekly fuel consumption export requests', function () {
    $manager = createWeeklyReportUser(RoleName::OperationsManager);
    $driver = createWeeklyReportUser(RoleName::CraneOperator);

    // Manager with fuel.view_all can request export
    $this->actingAs($manager)->post('/operations/reports/exports', [
        'export_type' => 'weekly_fuel_consumption',
        'format' => 'csv',
    ])->assertRedirect();

    // Driver without fuel.view_all or fuel.report is rejected
    $this->actingAs($driver)->post('/operations/reports/exports', [
        'export_type' => 'weekly_fuel_consumption',
        'format' => 'csv',
    ])->assertForbidden();
});
