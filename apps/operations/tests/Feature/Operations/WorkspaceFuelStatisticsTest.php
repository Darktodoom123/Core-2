<?php

use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Workspace\Queries\WorkspaceFuelRequestsQuery;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function createFuelStatUser(RoleName $role, string $name = 'Fuel Stat User'): User
{
    $user = User::factory()->create(['name' => $name]);
    $user->syncRoles([$role->value]);

    return $user;
}

it('aggregates all fuel counts in a single query while preserving status definitions and anomaly detection', function (): void {
    $manager = createFuelStatUser(RoleName::OperationsManager);
    $driver = createFuelStatUser(RoleName::CraneOperator);

    // 1 submitted, 1 forwarded (pending = 2)
    FuelRequest::query()->create([
        'reference' => 'FUEL-1001',
        'requester_id' => $driver->id,
        'status' => 'submitted',
        'fuel_type' => 'diesel',
        'quantity_litres' => 50,
        'purpose' => 'Job 1',
    ]);
    FuelRequest::query()->create([
        'reference' => 'FUEL-1002',
        'requester_id' => $driver->id,
        'status' => 'forwarded',
        'fuel_type' => 'diesel',
        'quantity_litres' => 60,
        'purpose' => 'Job 2',
    ]);

    // 1 approved
    FuelRequest::query()->create([
        'reference' => 'FUEL-1003',
        'requester_id' => $driver->id,
        'status' => 'approved',
        'fuel_type' => 'diesel',
        'quantity_litres' => 70,
        'purpose' => 'Job 3',
    ]);

    // 1 verified
    FuelRequest::query()->create([
        'reference' => 'FUEL-1004',
        'requester_id' => $driver->id,
        'status' => 'verified',
        'fuel_type' => 'diesel',
        'quantity_litres' => 80,
        'purpose' => 'Job 4',
    ]);

    // 2 logged: one with anomaly log, one normal log
    $loggedNormal = FuelRequest::query()->create([
        'reference' => 'FUEL-1005',
        'requester_id' => $driver->id,
        'status' => 'logged',
        'fuel_type' => 'diesel',
        'quantity_litres' => 90,
        'purpose' => 'Job 5',
    ]);
    FuelLog::query()->create([
        'fuel_request_id' => $loggedNormal->id,
        'recorded_by' => $driver->id,
        'quantity_litres' => 90,
        'total_cost' => 150,
        'is_anomaly' => false,
        'recorded_at' => now(),
    ]);

    $loggedAnomaly = FuelRequest::query()->create([
        'reference' => 'FUEL-1006',
        'requester_id' => $driver->id,
        'status' => 'logged',
        'fuel_type' => 'diesel',
        'quantity_litres' => 100,
        'purpose' => 'Job 6',
    ]);
    // Two anomaly logs on the same request should count as 1 anomaly request
    FuelLog::query()->create([
        'fuel_request_id' => $loggedAnomaly->id,
        'recorded_by' => $driver->id,
        'quantity_litres' => 130,
        'total_cost' => 200,
        'is_anomaly' => true,
        'recorded_at' => now(),
    ]);
    FuelLog::query()->create([
        'fuel_request_id' => $loggedAnomaly->id,
        'recorded_by' => $driver->id,
        'quantity_litres' => 135,
        'total_cost' => 210,
        'is_anomaly' => true,
        'recorded_at' => now(),
    ]);

    // 1 rejected (counted in total, but not in pending/approved/verified/logged)
    FuelRequest::query()->create([
        'reference' => 'FUEL-1007',
        'requester_id' => $driver->id,
        'status' => 'rejected',
        'fuel_type' => 'diesel',
        'quantity_litres' => 30,
        'purpose' => 'Job 7',
    ]);

    $query = app(WorkspaceFuelRequestsQuery::class);

    // Warm up Spatie permission and gate cache
    Gate::forUser($manager)->allows('viewAny', FuelRequest::class);
    $manager->can(PermissionName::FuelViewAll->value);

    $queryCount = 0;
    $queries = [];
    DB::listen(static function ($query) use (&$queryCount, &$queries): void {
        $queryCount++;
        $queries[] = $query->sql;
    });

    $counts = $query->counts($manager);

    expect($queryCount)->toBe(1)
        ->and($counts)->toBe([
            'total' => 7,
            'pending' => 2,
            'approved' => 1,
            'verified' => 1,
            'logged' => 2,
            'anomalies' => 1,
        ]);
});

it('scopes fuel statistics to the current user when lacking FuelViewAll permission', function (): void {
    $driver1 = createFuelStatUser(RoleName::CraneOperator, 'Driver 1');
    $driver2 = createFuelStatUser(RoleName::CraneOperator, 'Driver 2');

    FuelRequest::query()->create([
        'reference' => 'FUEL-2001',
        'requester_id' => $driver1->id,
        'status' => 'submitted',
        'fuel_type' => 'diesel',
        'quantity_litres' => 40,
        'purpose' => 'Driver 1 Job',
    ]);

    FuelRequest::query()->create([
        'reference' => 'FUEL-2002',
        'requester_id' => $driver2->id,
        'status' => 'submitted',
        'fuel_type' => 'diesel',
        'quantity_litres' => 50,
        'purpose' => 'Driver 2 Job',
    ]);

    $query = app(WorkspaceFuelRequestsQuery::class);

    $driver1Counts = $query->counts($driver1);

    expect($driver1Counts)->toBe([
        'total' => 1,
        'pending' => 1,
        'approved' => 0,
        'verified' => 0,
        'logged' => 0,
        'anomalies' => 0,
    ]);
});
