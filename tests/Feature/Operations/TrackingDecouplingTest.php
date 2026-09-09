<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Exports\LocationAuditExportDataset;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Facades\TrackingClient;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Platform\Tracking\Services\DatabaseTrackingClient;
use App\Platform\Tracking\Testing\FakeTrackingClient;
use App\Platform\Weather\Services\LocationWeatherService;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('resolves FakeTrackingClient by default in testing environments', function (): void {
    $client = app(TrackingClientInterface::class);

    expect($client)->toBeInstanceOf(FakeTrackingClient::class);
});

it('allows swapping with a clean FakeTrackingClient via facade', function (): void {
    $fake = TrackingClient::fake();

    expect($fake)->toBeInstanceOf(FakeTrackingClient::class)
        ->and(app(TrackingClientInterface::class))->toBe($fake);
});

it('computes 4-stage freshness degradation for latest location DTOs accurately', function (): void {
    // Sharing disabled -> offline
    expect(LatestLocationDto::computeFreshness(now(), false))->toBe('offline');

    // <= 3 minutes -> fresh
    expect(LatestLocationDto::computeFreshness(now()->subMinutes(2), true))->toBe('fresh');

    // 4 to 14 minutes -> delayed
    expect(LatestLocationDto::computeFreshness(now()->subMinutes(5), true))->toBe('delayed');

    // 15 to 30 minutes -> stale
    expect(LatestLocationDto::computeFreshness(now()->subMinutes(20), true))->toBe('stale');

    // > 30 minutes -> offline
    expect(LatestLocationDto::computeFreshness(now()->subMinutes(35), true))->toBe('offline');
});

it('enforces role-based visibility in getLatestLocations', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver1 = User::factory()->create();
    $driver1->syncRoles([RoleName::CraneOperator->value]);

    $driver2 = User::factory()->create();
    $driver2->syncRoles([RoleName::CraneOperator->value]);

    $unprivileged = User::factory()->create();

    $client = app(TrackingClientInterface::class);

    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driver1->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'sharing_enabled' => true,
    ]));

    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driver2->id,
        'latitude' => 14.6010,
        'longitude' => 120.9850,
        'sharing_enabled' => true,
    ]));

    // Dispatcher with tracking.view_all sees all
    $dispatcherLocations = $client->getLatestLocations($dispatcher);
    expect($dispatcherLocations)->toHaveCount(2);

    // Driver 1 with tracking.share_own sees only own
    $driver1Locations = $client->getLatestLocations($driver1);
    expect($driver1Locations)->toHaveCount(1)
        ->and($driver1Locations->first()->userId)->toBe($driver1->id);

    // Unprivileged user sees none
    $unprivilegedLocations = $client->getLatestLocations($unprivileged);
    expect($unprivilegedLocations)->toBeEmpty();
});

it('hydrates users, assets, and jobs in memory in Operations live map feed', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $driver = User::factory()->create(['name' => 'John Operator']);
    $driver->syncRoles([RoleName::CraneOperator->value]);

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-500',
        'name' => 'Liebherr LTM 1500',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
        'location' => 'Yard 1',
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-LIVE-500',
        'client' => 'Arcwell',
        'title' => 'Bridge Girder Lift',
        'site' => 'C-5 Flyover',
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Priority,
        'created_by' => $dispatcher->id,
    ]);

    $client = app(TrackingClientInterface::class);
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driver->id,
        'operational_asset_id' => $crane->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5800,
        'longitude' => 121.0600,
        'accuracy_metres' => 6.5,
        'speed' => 12.5,
        'remarks' => 'Position verified on site',
        'source' => 'field-mobile',
        'sharing_enabled' => true,
        'captured_at' => now()->subMinute(),
        'received_at' => now()->subMinute(),
    ]));

    $this->actingAs($dispatcher)->get('/')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
                ->has('locations', 1)
                ->where('locations.0.user.id', $driver->id)
                ->where('locations.0.user.name', 'John Operator')
                ->where('locations.0.asset.id', $crane->id)
                ->where('locations.0.asset.code', 'CRN-500')
                ->where('locations.0.asset.name', 'Liebherr LTM 1500')
                ->where('locations.0.asset.kind', 'crane')
                ->where('locations.0.job.id', $job->id)
                ->where('locations.0.job.reference', 'DISP-LIVE-500')
                ->where('locations.0.job.title', 'Bridge Girder Lift')
                ->where('locations.0.job.site', 'C-5 Flyover')
                ->where('locations.0.latitude', 14.58)
                ->where('locations.0.longitude', 121.06)
                ->where('locations.0.freshness_status', 'fresh')
            )
        );
});

it('OperationsWorkspaceViewModel formats LatestLocationDto and LocationUpdate identically', function (): void {
    $user = User::factory()->create(['name' => 'Test Driver']);
    $user->syncRoles([RoleName::CraneOperator->value]);

    $dto = new LatestLocationDto(
        id: 42,
        userId: $user->id,
        operationalAssetId: null,
        dispatchJobId: null,
        latitude: 14.5995,
        longitude: 120.9842,
        accuracyMetres: 4.5,
        speed: 15.0,
        remarks: 'Sample remark',
        source: 'field-mobile',
        sharingEnabled: true,
        capturedAt: CarbonImmutable::parse('2026-09-09T10:00:00Z'),
        receivedAt: CarbonImmutable::parse('2026-09-09T10:00:05Z'),
        freshnessStatus: 'fresh',
        user: ['id' => $user->id, 'name' => $user->name],
        asset: null,
        job: null,
    );

    $formatted = OperationsWorkspaceViewModel::locations(collect([$dto]));

    expect($formatted)->toHaveCount(1)
        ->and($formatted[0]['id'])->toBe(42)
        ->and($formatted[0]['user']['name'])->toBe('Test Driver')
        ->and($formatted[0]['latitude'])->toBe(14.5995)
        ->and($formatted[0]['longitude'])->toBe(120.9842)
        ->and($formatted[0]['accuracy_metres'])->toBe(4.5)
        ->and($formatted[0]['freshness_status'])->toBe('fresh');
});

it('serves weather telemetry through Operations Platform/Weather endpoint with DOLE safety evaluation', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Field Mobile')->plainTextToken;

    $response = $this->withToken($token)
        ->getJson('/api/v1/telemetry/weather?latitude=14.5995&longitude=120.9842');

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                'latitude',
                'longitude',
                'location_name',
                'temperature_celsius',
                'wind_speed_kmh',
                'wind_gusts_kmh',
                'safety_level',
                'safety_message',
            ],
        ]);

    $service = new LocationWeatherService;
    expect($service->evaluateSafety(48.0, 50.0, 0.0)['level'])->toBe('critical_stop_work')
        ->and($service->evaluateSafety(38.0, 40.0, 0.0)['level'])->toBe('warning_caution')
        ->and($service->evaluateSafety(15.0, 20.0, 0.0)['level'])->toBe('safe_normal');
});

it('queries location history via TrackingClientInterface with filters', function (): void {
    $client = app(TrackingClientInterface::class);

    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => 10,
        'dispatch_job_id' => 100,
        'latitude' => 14.5,
        'longitude' => 121.0,
        'captured_at' => now()->subHours(2),
    ]));

    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => 20,
        'dispatch_job_id' => 200,
        'latitude' => 14.6,
        'longitude' => 121.1,
        'captured_at' => now()->subHour(),
    ]));

    $historyForUser10 = $client->queryLocationHistory(['user_id' => 10]);
    expect($historyForUser10)->toHaveCount(1)
        ->and($historyForUser10->first()->userId)->toBe(10);

    $historyForJob200 = $client->queryLocationHistory(['dispatch_job_id' => 200]);
    expect($historyForJob200)->toHaveCount(1)
        ->and($historyForJob200->first()->dispatchJobId)->toBe(200);
});

it('verifies DatabaseTrackingClient persists, scopes, and aggregates latest positions accurately', function (): void {
    $dbClient = new DatabaseTrackingClient;

    $driver = User::factory()->create(['name' => 'DB Driver']);
    $driver->syncRoles([RoleName::CraneOperator->value]);

    $dispatcher = User::factory()->create(['name' => 'DB Dispatcher']);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $crane = OperationalAsset::query()->create([
        'code' => 'CRN-DB-1',
        'name' => 'DB Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    // Ingest older sample
    $dbClient->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driver->id,
        'operational_asset_id' => $crane->id,
        'latitude' => 14.5000,
        'longitude' => 121.0000,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(10),
        'received_at' => now()->subMinutes(10),
    ]));

    // Ingest newer sample
    $latest = $dbClient->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $driver->id,
        'operational_asset_id' => $crane->id,
        'latitude' => 14.5500,
        'longitude' => 121.0500,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinute(),
        'received_at' => now()->subMinute(),
    ]));

    // Check database has both records
    expect(LocationUpdate::query()->where('user_id', $driver->id)->count())->toBe(2);

    // Latest positions query returns exactly 1 (the newest)
    $latestPositions = $dbClient->getLatestLocations($dispatcher);
    expect($latestPositions)->toHaveCount(1)
        ->and($latestPositions->first()->latitude)->toBe(14.55)
        ->and($latestPositions->first()->longitude)->toBe(121.05);

    // Query latest for specific user and asset
    expect($dbClient->getLatestLocationForUser($driver->id)?->latitude)->toBe(14.55)
        ->and($dbClient->getLatestLocationForAsset($crane->id)?->latitude)->toBe(14.55);

    // Query history with date_from filter
    $filteredHistory = $dbClient->queryLocationHistory([
        'user_id' => $driver->id,
        'date_from' => now()->subMinutes(5)->toDateTimeString(),
    ]);
    expect($filteredHistory)->toHaveCount(1)
        ->and($filteredHistory->first()->latitude)->toBe(14.55);
});

it('handles multi-worker job execution latest location scoping via TrackingClientInterface', function (): void {
    $dispatcher = User::factory()->create(['name' => 'Dispatcher Mary']);
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $craneOperator = User::factory()->create(['name' => 'Crane Op']);
    $craneOperator->syncRoles([RoleName::CraneOperator->value]);

    $rigger = User::factory()->create(['name' => 'Rigger Joe']);
    $rigger->syncRoles([RoleName::CraneOperator->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DISP-MULTI-1',
        'client' => 'Multi Client',
        'title' => 'Multi Worker Lift',
        'site' => 'Pier 15',
        'scheduled_start' => now()->subHour(),
        'scheduled_end' => now()->addHours(2),
        'status' => DispatchStatus::Working,
        'priority' => DispatchPriority::Routine,
        'created_by' => $dispatcher->id,
    ]);

    $client = app(TrackingClientInterface::class);

    // Rigger logged earlier (2 minutes ago)
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $rigger->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5100,
        'longitude' => 121.0100,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinutes(2),
        'received_at' => now()->subMinutes(2),
    ]));

    // Crane operator logged later (1 minute ago)
    $client->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => $craneOperator->id,
        'dispatch_job_id' => $job->id,
        'latitude' => 14.5200,
        'longitude' => 121.0200,
        'sharing_enabled' => true,
        'captured_at' => now()->subMinute(),
        'received_at' => now()->subMinute(),
    ]));

    // Dispatcher sees overall latest (Crane Operator)
    $dispatcherLatest = $client->getLatestLocationForJob($job->id, $dispatcher);
    expect($dispatcherLatest?->userId)->toBe($craneOperator->id)
        ->and($dispatcherLatest?->latitude)->toBe(14.52);

    // Rigger sees own latest location on the job despite crane operator having newer ping
    $riggerLatest = $client->getLatestLocationForJob($job->id, $rigger);
    expect($riggerLatest?->userId)->toBe($rigger->id)
        ->and($riggerLatest?->latitude)->toBe(14.51);
});

it('provides expressive assertion methods on FakeTrackingClient', function (): void {
    $fake = TrackingClient::fake();
    $fake->assertNothingIngested();

    $fake->ingestLocation(LocationSampleDto::fromArray([
        'user_id' => 99,
        'latitude' => 14.5,
        'longitude' => 121.0,
    ]));

    $fake->assertIngestedCount(1);
    $fake->assertIngested(fn (LocationSampleDto $sample): bool => $sample->userId === 99 && $sample->latitude === 14.5);
});

it('exports location audit dataset with date filters and correct ascending ID ordering through TrackingClientInterface', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    $client = app(TrackingClientInterface::class);

    $s1 = $client->ingestLocation(LocationSampleDto::fromArray([
        'id' => 101,
        'user_id' => $dispatcher->id,
        'latitude' => 14.50,
        'longitude' => 121.00,
        'sharing_enabled' => true,
        'captured_at' => CarbonImmutable::parse('2026-09-01T08:00:00Z'),
        'received_at' => CarbonImmutable::parse('2026-09-01T08:00:05Z'),
    ]));

    $s2 = $client->ingestLocation(LocationSampleDto::fromArray([
        'id' => 102,
        'user_id' => $dispatcher->id,
        'latitude' => 14.51,
        'longitude' => 121.01,
        'sharing_enabled' => true,
        'captured_at' => CarbonImmutable::parse('2026-09-05T08:00:00Z'),
        'received_at' => CarbonImmutable::parse('2026-09-05T08:00:05Z'),
    ]));

    $s3 = $client->ingestLocation(LocationSampleDto::fromArray([
        'id' => 103,
        'user_id' => $dispatcher->id,
        'latitude' => 14.52,
        'longitude' => 121.02,
        'sharing_enabled' => true,
        'captured_at' => CarbonImmutable::parse('2026-09-08T08:00:00Z'),
        'received_at' => CarbonImmutable::parse('2026-09-08T08:00:05Z'),
    ]));

    $dataset = new LocationAuditExportDataset;
    $rows = iterator_to_array($dataset->rows($dispatcher, [
        'date_from' => '2026-09-03',
        'date_to' => '2026-09-06',
    ]));

    // Only update 102 falls between 2026-09-03 and 2026-09-06
    expect($rows)->toHaveCount(1)
        ->and($rows[0][0])->toBe(102)
        ->and($rows[0][1])->toBe($dispatcher->id);
});
