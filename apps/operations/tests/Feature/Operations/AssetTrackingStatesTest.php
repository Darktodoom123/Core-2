<?php

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

/*
|--------------------------------------------------------------------------
| 1. Freshness Label Separation
|--------------------------------------------------------------------------
*/

it('computes human-readable freshness label without using "Delayed"', function (): void {
    // Has GPS report = false -> No GPS report
    expect(LatestLocationDto::computeFreshnessLabel('fresh', false))->toBe('No GPS report');
    expect(LatestLocationDto::computeFreshnessLabel('offline', false))->toBe('No GPS report');

    // Has GPS report = true, sharing paused
    expect(LatestLocationDto::computeFreshnessLabel('fresh', true, sharingEnabled: false))->toBe('Sharing paused');

    // Standard status mappings with hasGpsReport = true
    expect(LatestLocationDto::computeFreshnessLabel('fresh', true))->toBe('Fresh');
    expect(LatestLocationDto::computeFreshnessLabel('delayed', true))->toBe('Location not current');
    expect(LatestLocationDto::computeFreshnessLabel('stale', true))->toBe('Location not current');
    expect(LatestLocationDto::computeFreshnessLabel('offline', true))->toBe('Location not current');

    // Freshness computed from timestamp thresholds
    $freshStatus = LatestLocationDto::computeFreshness(now()->subSeconds(60), true);
    expect(LatestLocationDto::computeFreshnessLabel($freshStatus, true))->toBe('Fresh');

    // > 180s (3m) degraded to delayed -> Location not current (never "Delayed"!)
    $delayedStatus = LatestLocationDto::computeFreshness(now()->subMinutes(5), true);
    expect(LatestLocationDto::computeFreshnessLabel($delayedStatus, true))->toBe('Location not current');

    $staleStatus = LatestLocationDto::computeFreshness(now()->subMinutes(20), true);
    expect(LatestLocationDto::computeFreshnessLabel($staleStatus, true))->toBe('Location not current');
});

/*
|--------------------------------------------------------------------------
| 2. Unassigned Assets in Tracking Workspace
|--------------------------------------------------------------------------
*/

it('includes unassigned assets in tracking list with domain status and recorded yard location without coordinates', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-UNASSIGNED-1',
        'name' => 'Mobile Crane Unassigned',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
        'location' => 'Depot Yard Sector 4',
    ]);

    $response = $this->actingAs($dispatcher)->get('/operations');

    $response->assertOk();
    $response->assertInertia(function (Assert $page) use ($crane): void {
        $page->component('workspace')
            ->loadDeferredProps('workspace-overview', function (Assert $section) use ($crane): void {
                $section->has('locations', 1)
                    ->where('locations.0.operational_asset_id', $crane->id)
                    ->where('locations.0.is_assigned', false)
                    ->where('locations.0.assignment_status', 'unassigned')
                    ->where('locations.0.recorded_location', 'Depot Yard Sector 4')
                    ->where('locations.0.has_gps_report', false)
                    ->where('locations.0.freshness_label', 'No GPS report')
                    ->where('locations.0.latitude', null)
                    ->where('locations.0.longitude', null)
                    ->where('locations.0.asset.status', AssetStatus::Available->value)
                    ->where('locations.0.asset.status_label', AssetStatus::Available->label());
            });
    });
});

/*
|--------------------------------------------------------------------------
| 3. Separation of Assignment, Availability, and Freshness
|--------------------------------------------------------------------------
*/

it('strictly preserves asset operational status and assignment when location updates are interrupted', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = User::factory()->create(['name' => 'Active Driver']);
    $driver->syncRoles([RoleName::CraneOperator->value]);

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-BUSY-1',
        'name' => 'Operating Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Working,
        'location' => 'Harbor Port',
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-JOB-BUSY-1',
        'client' => 'Harbor Logistics',
        'title' => 'Cargo Lift',
        'site' => 'Harbor Pier 3',
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Priority,
        'created_by' => $dispatcher->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHours(2),
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $crane->id,
        'assignment_type' => 'primary',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHours(2),
    ]);

    // Telemetry was reported 15 minutes ago (interrupted / stale)
    $staleTime = now()->subMinutes(15);
    $client = app(TrackingClientInterface::class);
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driver->id,
        'operational_asset_id' => $crane->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5800,
        'longitude' => 120.9700,
        'sharing_enabled' => true,
        'source' => 'mobile',
        'captured_at' => $staleTime->toIso8601String(),
        'received_at' => $staleTime->toIso8601String(),
    ]));

    $response = $this->actingAs($dispatcher)->get('/operations');

    $response->assertOk();
    $response->assertInertia(function (Assert $page) use ($crane, $job): void {
        $page->component('workspace')
            ->loadDeferredProps('workspace-overview', function (Assert $section) use ($crane, $job): void {
                $section->has('locations', 1)
                    ->where('locations.0.operational_asset_id', $crane->id)
                    ->where('locations.0.is_assigned', true)
                    ->where('locations.0.assignment_status', 'assigned')
                    ->where('locations.0.freshness_label', 'Location not current')
                    ->where('locations.0.latitude', 14.58)
                    ->where('locations.0.longitude', 120.97)
                    ->where('locations.0.has_gps_report', true)
                    ->where('locations.0.reported_via_phone', true)
                    // Availability status remains Working (not offline or unassigned!)
                    ->where('locations.0.asset.status', AssetStatus::Working->value)
                    ->where('locations.0.job.reference', $job->reference);
            });
    });
});

/*
|--------------------------------------------------------------------------
| 4. Last Valid Position Retention on Assignment End
|--------------------------------------------------------------------------
*/

it('retains last valid GPS position and timestamp when assignment ends and marks as unassigned', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = User::factory()->create(['name' => 'Former Driver']);
    $driver->syncRoles([RoleName::CraneOperator->value]);

    $craneA = OperationalAsset::query()->create([
        'code' => 'CRN-RETAIN-A',
        'name' => 'Crane Alpha',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    $craneB = OperationalAsset::query()->create([
        'code' => 'CRN-RETAIN-B',
        'name' => 'Crane Beta',
        'kind' => 'crane',
        'status' => AssetStatus::Working,
    ]);

    $jobA = DispatchJob::query()->create([
        'reference' => 'DISP-JOB-OLD',
        'client' => 'Old Client',
        'title' => 'Completed Job',
        'site' => 'Site Alpha',
        'status' => DispatchStatus::Completed,
        'priority' => DispatchPriority::Routine,
        'created_by' => $dispatcher->id,
    ]);

    // Crane A assignment has ended
    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $jobA->id,
        'operational_asset_id' => $craneA->id,
        'assignment_type' => 'primary',
        'assigned_by' => $dispatcher->id,
        'active_from' => now()->subHours(5),
        'active_until' => now()->subHour(),
    ]);

    $client = app(TrackingClientInterface::class);

    // Crane A reported at 14.5500, 120.9500 2 hours ago
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driver->id,
        'operational_asset_id' => $craneA->id,
        'dispatch_job_id' => $jobA->id,
        'latitude' => 14.5500,
        'longitude' => 120.9500,
        'sharing_enabled' => true,
        'source' => 'mobile',
        'captured_at' => now()->subHours(2)->toIso8601String(),
    ]));

    // Later, Driver is assigned to Crane B at a completely different location
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driver->id,
        'operational_asset_id' => $craneB->id,
        'latitude' => 14.7777,
        'longitude' => 121.1111,
        'sharing_enabled' => true,
        'source' => 'mobile',
        'captured_at' => now()->subMinutes(5)->toIso8601String(),
    ]));

    $response = $this->actingAs($dispatcher)->get('/operations');

    $response->assertOk();
    $response->assertInertia(function (Assert $page) use ($craneA, $craneB): void {
        $page->component('workspace')
            ->loadDeferredProps('workspace-overview', function (Assert $section) use ($craneA, $craneB): void {
                $section->has('locations', 2)
                    ->where('locations', function ($locations) use ($craneA, $craneB): bool {
                        $collection = collect($locations);
                        $locationA = $collection->firstWhere('operational_asset_id', $craneA->id);
                        $locationB = $collection->firstWhere('operational_asset_id', $craneB->id);

                        // Crane A: Retained last valid coordinates, marked unassigned
                        expect($locationA)->not->toBeNull()
                            ->and($locationA['latitude'])->toBe(14.55)
                            ->and($locationA['longitude'])->toBe(120.95)
                            ->and($locationA['is_assigned'])->toBeFalse()
                            ->and($locationA['assignment_status'])->toBe('unassigned')
                            ->and($locationA['has_gps_report'])->toBeTrue();

                        // Crane B: Active location, not overwriting Crane A
                        expect($locationB)->not->toBeNull()
                            ->and($locationB['latitude'])->toBe(14.7777)
                            ->and($locationB['longitude'])->toBe(121.1111);

                        return true;
                    });
            });
    });
});

/*
|--------------------------------------------------------------------------
| 5. Offline Queued Location Samples Assignment Window Validation
|--------------------------------------------------------------------------
*/

it('accepts offline queued location samples when assignment was active at captured_at', function (): void {
    /** @var User $driver */
    $driver = User::factory()->create(['is_active' => true]);
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $token = $driver->createToken('Mobile Token')->plainTextToken;

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-QUEUE-1',
        'name' => 'Offline Queue Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Working,
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-JOB-OFFLINE',
        'client' => 'Offline Client',
        'title' => 'Offline Shift',
        'site' => 'Remote Site',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Working,
        'created_by' => $driver->id,
    ]);

    // Driver and Crane were assigned between 3 hours ago and 1 hour ago
    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $driver->id,
        'active_from' => now()->subHours(3),
        'active_until' => now()->subHour(),
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $crane->id,
        'assignment_type' => 'primary',
        'assigned_by' => $driver->id,
        'active_from' => now()->subHours(3),
        'active_until' => now()->subHour(),
    ]);

    // Sample captured 2 hours ago (within assignment window)
    $sampleCapturedAt = now()->subHours(2)->toIso8601String();

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'operational_asset_id' => $crane->id,
            'latitude' => 14.6500,
            'longitude' => 121.0500,
            'sharing_enabled' => true,
            'source' => 'mobile',
            'captured_at' => $sampleCapturedAt,
        ]);

    $response->assertStatus(201)
        ->assertJsonPath('data.latitude', 14.65)
        ->assertJsonPath('data.operational_asset_id', $crane->id)
        ->assertJsonPath('data.reported_via_phone', true);
});

it('rejects offline queued location samples when assignment was not active at captured_at', function (): void {
    /** @var User $driver */
    $driver = User::factory()->create(['is_active' => true]);
    $driver->syncRoles([RoleName::CraneOperator->value]);
    $token = $driver->createToken('Mobile Token')->plainTextToken;

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-QUEUE-2',
        'name' => 'Offline Queue Crane 2',
        'kind' => 'crane',
        'status' => AssetStatus::Working,
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-JOB-OFFLINE-2',
        'client' => 'Offline Client 2',
        'title' => 'Offline Shift 2',
        'site' => 'Remote Site 2',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Working,
        'created_by' => $driver->id,
    ]);

    // Assignment started only 30 minutes ago (active_from = 30m ago)
    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $driver->id,
        'active_from' => now()->subMinutes(30),
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $crane->id,
        'assignment_type' => 'primary',
        'assigned_by' => $driver->id,
        'active_from' => now()->subMinutes(30),
    ]);

    // Attempt to submit sample captured 2 hours ago (before assignment started!)
    $sampleCapturedAt = now()->subHours(2)->toIso8601String();

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson('/api/v1/locations', [
            'dispatch_job_id' => $job->id,
            'operational_asset_id' => $crane->id,
            'latitude' => 14.6500,
            'longitude' => 121.0500,
            'sharing_enabled' => true,
            'source' => 'mobile',
            'captured_at' => $sampleCapturedAt,
        ]);

    $response->assertStatus(422)
        ->assertJsonValidationErrors(['dispatch_job_id']);
});
