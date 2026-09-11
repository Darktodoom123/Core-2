<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Workspace\Queries\WorkspaceAssetsQuery;
use App\Platform\Workspace\Queries\WorkspaceFuelRequestsQuery;
use App\Platform\Workspace\Queries\WorkspaceJobReportsQuery;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('paginates and searches assets beyond 100 records with stable ordering and wildcard escaping', function (): void {
    $dispatcher = User::factory()->create();
    $dispatcher->syncRoles([RoleName::OperationsManager->value]);

    // Create 105 assets
    for ($i = 1; $i <= 105; $i++) {
        OperationalAsset::query()->create([
            'code' => sprintf('AST-%03d', $i),
            'name' => "Asset {$i}",
            'kind' => $i <= 50 ? 'mobile_crane' : 'heavy_truck',
            'subtype' => $i <= 50 ? 'hydraulic_crane' : 'dump_truck',
            'status' => AssetStatus::Available,
        ]);
    }

    // Special asset with wildcard chars in code
    OperationalAsset::query()->create([
        'code' => 'AST_SPECIAL%01',
        'name' => 'Special Wildcard Rig',
        'kind' => 'special_equipment',
        'status' => AssetStatus::Available,
    ]);

    $query = app(WorkspaceAssetsQuery::class);

    // Page 1 (default 50)
    $page1 = $query->paginate($dispatcher, ['page' => 1, 'per_page' => 50]);
    expect($page1->total())->toBe(106);
    expect($page1->count())->toBe(50);
    expect($page1->items()[0]->code)->toBe('AST-001');

    // Page 3 (items 101 to 106)
    $page3 = $query->paginate($dispatcher, ['page' => 3, 'per_page' => 50]);
    expect($page3->count())->toBe(6);
    expect($page3->items()[0]->code)->toBe('AST-101');

    // Category filter: cranes
    $cranes = $query->paginate($dispatcher, ['category' => 'cranes', 'per_page' => 100]);
    expect($cranes->total())->toBe(50);

    // Escaped wildcard search: searching "AST_SPECIAL" should match "AST_SPECIAL%01" literally
    $wildcardSearch = $query->paginate($dispatcher, ['search' => 'AST_SPECIAL%']);
    expect($wildcardSearch->total())->toBe(1);
    expect($wildcardSearch->items()[0]->code)->toBe('AST_SPECIAL%01');
});

it('paginates fuel requests beyond 100 records and computes truthful stage counts', function (): void {
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $requester = User::factory()->create(['name' => 'Field Driver One']);
    $requester->syncRoles([RoleName::CraneOperator->value]);

    // Create 110 fuel requests across different statuses
    for ($i = 1; $i <= 110; $i++) {
        $status = match ($i % 5) {
            0 => FuelRequestStatus::Submitted,
            1 => FuelRequestStatus::Forwarded,
            2 => FuelRequestStatus::Approved,
            3 => FuelRequestStatus::Verified,
            default => FuelRequestStatus::Logged,
        };

        $req = FuelRequest::query()->create([
            'reference' => sprintf('FR-2026-%04d', $i),
            'requester_id' => $requester->id,
            'quantity_litres' => 100.0,
            'fuel_type' => 'diesel',
            'purpose' => "Field operations shift {$i}",
            'status' => $status,
            'created_at' => now()->subMinutes(120 - $i),
        ]);

        if ($status === FuelRequestStatus::Logged && $i === 4) {
            FuelLog::query()->create([
                'fuel_request_id' => $req->id,
                'recorded_by' => $manager->id,
                'quantity_litres' => 160.0, // variance / anomaly
                'is_anomaly' => true,
                'recorded_at' => now(),
            ]);
        }
    }

    $query = app(WorkspaceFuelRequestsQuery::class);

    // Page 1 (25 items)
    $page1 = $query->paginate($manager, ['page' => 1, 'per_page' => 25]);
    expect($page1->total())->toBe(110);
    expect($page1->count())->toBe(25);

    // Page 5 (last 10 items)
    $page5 = $query->paginate($manager, ['page' => 5, 'per_page' => 25]);
    expect($page5->count())->toBe(10);

    // Stage counts
    $counts = $query->counts($manager);
    expect($counts['total'])->toBe(110);
    expect($counts['pending'])->toBe(44); // submitted (22) + forwarded (22)
    expect($counts['approved'])->toBe(22);
    expect($counts['verified'])->toBe(22);
    expect($counts['logged'])->toBe(22);
    expect($counts['anomalies'])->toBe(1);

    // Search by reference
    $searchRes = $query->paginate($manager, ['search' => 'FR-2026-0042']);
    expect($searchRes->total())->toBe(1);
    expect($searchRes->items()[0]->reference)->toBe('FR-2026-0042');

    // Filter by anomalies
    $anomalyRes = $query->paginate($manager, ['status' => 'anomalies']);
    expect($anomalyRes->total())->toBe(1);
});

it('paginates job reports beyond 100 records and isolates statistics accurately', function (): void {
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $author = User::factory()->create(['name' => 'Reporting Tech One']);
    $author->syncRoles([RoleName::CraneOperator->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-2026-999',
        'client' => 'Test Client',
        'title' => 'Test Dispatch Job',
        'site' => 'Site A',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $manager->id,
        'version' => 1,
    ]);

    // Create 105 job reports
    for ($i = 1; $i <= 105; $i++) {
        $status = match ($i % 4) {
            0 => JobReportStatus::Draft,
            1 => JobReportStatus::Submitted,
            2 => JobReportStatus::Approved,
            default => JobReportStatus::Rejected,
        };

        JobReport::query()->create([
            'dispatch_job_id' => $job->id,
            'author_id' => $author->id,
            'work_summary' => "Completed field inspection stage {$i}",
            'status' => $status,
            'submitted_at' => $status === JobReportStatus::Draft ? null : now()->subMinutes(120 - $i),
            'created_at' => now()->subMinutes(120 - $i),
        ]);
    }

    $query = app(WorkspaceJobReportsQuery::class);

    // Page 1 (25 items)
    $page1 = $query->paginate($manager, ['page' => 1, 'per_page' => 25]);
    expect($page1->total())->toBe(105);
    expect($page1->count())->toBe(25);

    // Page 5 (items 101 to 105)
    $page5 = $query->paginate($manager, ['page' => 5, 'per_page' => 25]);
    expect($page5->count())->toBe(5);

    // Stats
    $stats = $query->stats($manager);
    expect($stats['total'])->toBe(105);
    expect($stats['draft'])->toBe(26);
    expect($stats['submitted'])->toBe(27);
    expect($stats['approved'])->toBe(26);
    expect($stats['rejected'])->toBe(26);

    // Filter by status
    $submittedReports = $query->paginate($manager, ['status' => 'submitted']);
    expect($submittedReports->total())->toBe(27);

    // Search by summary text
    $search = $query->paginate($manager, ['search' => 'stage 42']);
    expect($search->total())->toBe(1);
});

it('supports Inertia partial reload for companion props on operations workspace', function (): void {
    $manager = User::factory()->create();
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $author = User::factory()->create();
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-2026-998',
        'client' => 'Test Client',
        'title' => 'Test Dispatch Job',
        'site' => 'Site A',
        'status' => DispatchStatus::Draft,
        'priority' => DispatchPriority::Routine,
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(4),
        'created_by' => $manager->id,
        'version' => 1,
    ]);

    JobReport::query()->create([
        'dispatch_job_id' => $job->id,
        'author_id' => $author->id,
        'work_summary' => 'Partial reload verification report',
        'status' => JobReportStatus::Submitted,
        'submitted_at' => now(),
    ]);

    // Partial reload requesting only jobReports and companion props
    $manifest = public_path('build/manifest.json');
    $version = file_exists($manifest) ? hash_file('xxh128', $manifest) : '';
    $response = $this->actingAs($manager)
        ->withHeaders([
            'X-Inertia' => 'true',
            'X-Inertia-Version' => $version,
            'X-Inertia-Partial-Component' => 'workspace',
            'X-Inertia-Partial-Data' => 'jobReports,jobReports_total,jobReports_stats,jobReports_pagination',
        ])
        ->get('/operations?view=reports');

    $response->assertOk();
    $page = $response->json();

    expect($page['props'])->toHaveKeys(['jobReports', 'jobReports_total', 'jobReports_stats', 'jobReports_pagination']);
    expect($page['props']['jobReports_total'])->toBe(1);
    expect($page['props']['jobReports_stats']['submitted'])->toBe(1);
    expect($page['props']['jobReports_pagination']['current_page'])->toBe(1);
});
