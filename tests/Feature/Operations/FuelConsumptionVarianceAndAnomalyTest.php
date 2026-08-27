<?php

use App\Modules\Fuel\Enums\FuelBurnRateUnit;
use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('private');
});

function createFuelUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

function progressFuelRequestToVerified(User $requester, User $dispatcher, User $manager, array $requestData): FuelRequest
{
    test()->actingAs($requester)->post('/operations/fuel-requests', $requestData)->assertRedirect('/');
    $fuel = FuelRequest::query()->latest('id')->firstOrFail();

    test()->actingAs($dispatcher)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'forwarded'])->assertRedirect('/');
    test()->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'approved'])->assertRedirect('/');
    test()->actingAs($manager)->post("/operations/fuel-requests/{$fuel->id}/status", ['status' => 'verified'])->assertRedirect('/');

    return $fuel->fresh();
}

it('calculates quantity variance and does not flag anomaly when within 15 percent threshold', function () {
    $driver = createFuelUser(RoleName::Driver);
    $dispatcher = createFuelUser(RoleName::Dispatcher);
    $manager = createFuelUser(RoleName::OperationsManager);

    $fuel = progressFuelRequestToVerified($driver, $dispatcher, $manager, [
        'quantity_litres' => 100,
        'fuel_type' => 'diesel',
        'purpose' => 'Standard haul',
    ]);

    // Actual 110L (+10.0% variance, below 15% threshold)
    $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'logged',
        'quantity_litres' => 110,
        'price_per_litre' => 1.50,
        'total_cost' => 165.00,
        'fuel_station' => 'Petron North',
    ])->assertRedirect('/');

    $log = FuelLog::query()->where('fuel_request_id', $fuel->id)->sole();
    expect((float) $log->quantity_litres)->toBe(110.00)
        ->and((float) $log->variance_litres)->toBe(10.00)
        ->and((float) $log->variance_percentage)->toBe(10.00)
        ->and($log->is_anomaly)->toBeFalse()
        ->and($log->anomaly_reason)->toBeNull();
});

it('flags an anomaly when actual quantity exceeds requested quantity by 15 percent or more', function () {
    $driver = createFuelUser(RoleName::Driver);
    $dispatcher = createFuelUser(RoleName::Dispatcher);
    $manager = createFuelUser(RoleName::OperationsManager);

    $fuel = progressFuelRequestToVerified($driver, $dispatcher, $manager, [
        'quantity_litres' => 100,
        'fuel_type' => 'diesel',
        'purpose' => 'Heavy haul',
    ]);

    // Actual 120L (+20.0% variance, >= 15% threshold)
    $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'logged',
        'quantity_litres' => 120,
        'price_per_litre' => 1.50,
    ])->assertRedirect('/');

    $log = FuelLog::query()->where('fuel_request_id', $fuel->id)->sole();
    expect((float) $log->variance_litres)->toBe(20.00)
        ->and((float) $log->variance_percentage)->toBe(20.00)
        ->and($log->is_anomaly)->toBeTrue()
        ->and($log->anomaly_reason)->toContain('Quantity variance (+20.0%) exceeds 15% threshold');
});

it('calculates effective burn rate in L/km for trucks and updates asset meter value', function () {
    $driver = createFuelUser(RoleName::Driver);
    $dispatcher = createFuelUser(RoleName::Dispatcher);
    $manager = createFuelUser(RoleName::OperationsManager);

    $truck = OperationalAsset::query()->create([
        'code' => 'TRK-BURN-01',
        'name' => 'Prime Mover 1',
        'kind' => 'truck',
        'subtype' => 'tractor_head',
        'status' => AssetStatus::ReadyForService,
        'meter_type' => 'odometer',
        'meter_value' => 50000,
        'baseline_burn_rate' => 0.40,
        'burn_rate_unit' => FuelBurnRateUnit::LitresPerKm->value,
    ]);

    $fuel = progressFuelRequestToVerified($driver, $dispatcher, $manager, [
        'quantity_litres' => 100,
        'fuel_type' => 'diesel',
        'purpose' => 'Regional transit',
        'operational_asset_id' => $truck->id,
    ]);

    // Actual 100L, odometer progresses from 50,000 to 50,250 (delta = 250 km)
    // Effective burn rate = 100 / 250 = 0.40 L/km
    $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'logged',
        'quantity_litres' => 100,
        'odometer_km' => 50250,
    ])->assertRedirect('/');

    $log = FuelLog::query()->where('fuel_request_id', $fuel->id)->sole();
    expect((float) $log->effective_burn_rate)->toBe(0.40)
        ->and($log->burn_rate_unit)->toBe(FuelBurnRateUnit::LitresPerKm->value)
        ->and($log->is_anomaly)->toBeFalse();

    // Verify asset meter was synchronized
    $truck->refresh();
    expect((float) $truck->meter_value)->toBe(50250.00);
});

it('calculates effective burn rate in L/hr for cranes and stationary equipment', function () {
    $operator = createFuelUser(RoleName::CraneOperator);
    $dispatcher = createFuelUser(RoleName::Dispatcher);
    $manager = createFuelUser(RoleName::OperationsManager);

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-BURN-01',
        'name' => 'Rough Terrain Crane 50T',
        'kind' => 'crane',
        'subtype' => 'rough_terrain',
        'status' => AssetStatus::ReadyForService,
        'meter_type' => 'hour_meter',
        'meter_value' => 1200.0,
        'baseline_burn_rate' => 15.00,
        'burn_rate_unit' => FuelBurnRateUnit::LitresPerHour->value,
    ]);

    $fuel = progressFuelRequestToVerified($operator, $dispatcher, $manager, [
        'quantity_litres' => 150,
        'fuel_type' => 'diesel',
        'purpose' => 'Port lifting operations',
        'operational_asset_id' => $crane->id,
    ]);

    // Actual 150L, hours progress from 1,200.0 to 1,210.0 (delta = 10 hrs)
    // Effective burn rate = 150 / 10 = 15.00 L/hr
    $this->actingAs($operator)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'logged',
        'quantity_litres' => 150,
        'hour_meter' => 1210.0,
    ])->assertRedirect('/');

    $log = FuelLog::query()->where('fuel_request_id', $fuel->id)->sole();
    expect((float) $log->effective_burn_rate)->toBe(15.00)
        ->and($log->burn_rate_unit)->toBe(FuelBurnRateUnit::LitresPerHour->value)
        ->and($log->is_anomaly)->toBeFalse();

    $crane->refresh();
    expect((float) $crane->meter_value)->toBe(1210.00);
});

it('flags an anomaly when effective burn rate exceeds asset baseline by 15 percent or more', function () {
    $driver = createFuelUser(RoleName::Driver);
    $dispatcher = createFuelUser(RoleName::Dispatcher);
    $manager = createFuelUser(RoleName::OperationsManager);

    $truck = OperationalAsset::query()->create([
        'code' => 'TRK-BURN-ANOM',
        'name' => 'Highway Truck',
        'kind' => 'truck',
        'subtype' => 'flatbed',
        'status' => AssetStatus::ReadyForService,
        'meter_type' => 'odometer',
        'meter_value' => 10000,
        'baseline_burn_rate' => 0.30, // 0.30 L/km baseline
        'burn_rate_unit' => FuelBurnRateUnit::LitresPerKm->value,
    ]);

    $fuel = progressFuelRequestToVerified($driver, $dispatcher, $manager, [
        'quantity_litres' => 100,
        'fuel_type' => 'diesel',
        'purpose' => 'Heavy transport',
        'operational_asset_id' => $truck->id,
    ]);

    // Actual 100L, delta = 200 km (10,000 -> 10,200).
    // Effective burn rate = 100 / 200 = 0.50 L/km.
    // Excess = (0.50 - 0.30) / 0.30 = +66.7% (well over +15.0% threshold)
    $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'logged',
        'quantity_litres' => 100,
        'odometer_km' => 10200,
    ])->assertRedirect('/');

    $log = FuelLog::query()->where('fuel_request_id', $fuel->id)->sole();
    expect($log->is_anomaly)->toBeTrue()
        ->and($log->anomaly_reason)->toContain('Effective burn rate (0.50 L/km) exceeds baseline (0.30 L/km)');
});

it('rejects monotonic meter rollback when odometer is lower than asset current meter value', function () {
    $driver = createFuelUser(RoleName::Driver);
    $dispatcher = createFuelUser(RoleName::Dispatcher);
    $manager = createFuelUser(RoleName::OperationsManager);

    $truck = OperationalAsset::query()->create([
        'code' => 'TRK-ROLLBACK',
        'name' => 'Protected Meter Truck',
        'kind' => 'truck',
        'subtype' => 'flatbed',
        'status' => AssetStatus::ReadyForService,
        'meter_type' => 'odometer',
        'meter_value' => 75000,
    ]);

    $fuel = progressFuelRequestToVerified($driver, $dispatcher, $manager, [
        'quantity_litres' => 80,
        'fuel_type' => 'diesel',
        'purpose' => 'Meter test',
        'operational_asset_id' => $truck->id,
    ]);

    // Submitting 74,000 km (less than 75,000 km current meter)
    $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'logged',
        'quantity_litres' => 80,
        'odometer_km' => 74000,
    ])->assertSessionHasErrors('odometer_km');

    expect(FuelLog::query()->where('fuel_request_id', $fuel->id)->exists())->toBeFalse();
    expect((float) $truck->fresh()->meter_value)->toBe(75000.00);
});

it('rejects monotonic meter rollback when hour meter is lower than asset current meter value', function () {
    $operator = createFuelUser(RoleName::CraneOperator);
    $dispatcher = createFuelUser(RoleName::Dispatcher);
    $manager = createFuelUser(RoleName::OperationsManager);

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-ROLLBACK',
        'name' => 'Protected Meter Crane',
        'kind' => 'crane',
        'subtype' => 'crawler',
        'status' => AssetStatus::ReadyForService,
        'meter_type' => 'hour_meter',
        'meter_value' => 3500.5,
    ]);

    $fuel = progressFuelRequestToVerified($operator, $dispatcher, $manager, [
        'quantity_litres' => 120,
        'fuel_type' => 'diesel',
        'purpose' => 'Meter test crane',
        'operational_asset_id' => $crane->id,
    ]);

    // Submitting 3,400.0 hrs (less than 3,500.5 hrs current meter)
    $this->actingAs($operator)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'logged',
        'quantity_litres' => 120,
        'hour_meter' => 3400.0,
    ])->assertSessionHasErrors('hour_meter');

    expect(FuelLog::query()->where('fuel_request_id', $fuel->id)->exists())->toBeFalse();
});

it('allows non-metered asset to log fuel cleanly without error', function () {
    $driver = createFuelUser(RoleName::Driver);
    $dispatcher = createFuelUser(RoleName::Dispatcher);
    $manager = createFuelUser(RoleName::OperationsManager);

    $riggingGear = OperationalAsset::query()->create([
        'code' => 'RIG-001',
        'name' => 'Non-powered Spreader Bar',
        'kind' => 'rigging',
        'subtype' => 'spreader',
        'status' => AssetStatus::ReadyForService,
        'meter_type' => null,
        'meter_value' => null,
    ]);

    $fuel = progressFuelRequestToVerified($driver, $dispatcher, $manager, [
        'quantity_litres' => 50,
        'fuel_type' => 'diesel',
        'purpose' => 'Support gear cleaning',
        'operational_asset_id' => $riggingGear->id,
    ]);

    $this->actingAs($driver)->post("/operations/fuel-requests/{$fuel->id}/status", [
        'status' => 'logged',
        'quantity_litres' => 50,
    ])->assertRedirect('/');

    $log = FuelLog::query()->where('fuel_request_id', $fuel->id)->sole();
    expect($log->is_anomaly)->toBeFalse()
        ->and($log->effective_burn_rate)->toBeNull();
});
