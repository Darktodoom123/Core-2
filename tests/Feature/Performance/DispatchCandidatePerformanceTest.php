<?php

use App\Modules\Assignment\Http\Requests\ListDispatchCandidatesRequest;
use App\Modules\Assignment\Queries\AssetCandidateQuery;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function candidatePerformanceDispatcher(): User
{
    $user = User::factory()->create(['name' => 'Candidate dispatcher']);
    $user->syncRoles([RoleName::Dispatcher->value]);

    return $user;
}

function candidatePerformanceJob(User $dispatcher, string $reference = 'CAND-1001'): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => $reference,
        'client' => 'Candidate client',
        'title' => 'Candidate dispatch',
        'site' => 'Pasig City',
        'scheduled_start' => now()->addDays(2)->startOfHour(),
        'scheduled_end' => now()->addDays(2)->startOfHour()->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);
}

it('does not create deferred candidate work for an assigned field user', function (): void {
    $dispatcher = candidatePerformanceDispatcher();
    $driver = User::factory()->create(['name' => 'Assigned field user']);
    $driver->syncRoles([RoleName::Driver->value]);
    $job = candidatePerformanceJob($dispatcher, 'CAND-1002');
    $job->personnelAssignments()->create([
        'user_id' => $driver->id,
        'assignment_type' => 'driver',
        'assigned_by' => $dispatcher->id,
        'active_from' => $job->scheduled_start,
    ]);

    $response = $this->actingAs($driver)->get("/operations/dispatch-jobs/{$job->id}");
    $page = json_decode(json_encode($response->viewData('page')), true, flags: JSON_THROW_ON_ERROR);

    $response->assertOk()->assertInertia(fn (Assert $assert) => $assert
        ->where('capabilities.view_assignment_candidates', false)
        ->has('personnel_candidates', 0)
        ->has('asset_candidates', 0));

    expect($page['deferredProps']['dispatch-candidates'] ?? null)->toBeNull();
});

it('keeps the candidate page query count fixed as the asset pool grows', function (): void {
    $dispatcher = candidatePerformanceDispatcher();
    $job = candidatePerformanceJob($dispatcher, 'CAND-1003');

    foreach (range(1, 5) as $index) {
        OperationalAsset::query()->create([
            'code' => sprintf('SM-%03d', $index),
            'name' => 'Small pool asset',
            'kind' => 'equipment',
            'status' => AssetStatus::Available,
        ]);
    }

    $smallCount = candidatePerformanceQueryCount(function () use ($job): void {
        app(AssetCandidateQuery::class)->page(
            $job,
            ListDispatchCandidatesRequest::create('/', 'GET', [
                'resource' => 'assets',
                'per_page' => 25,
            ]),
        );
    });

    foreach (range(6, 200) as $index) {
        OperationalAsset::query()->create([
            'code' => sprintf('LG-%03d', $index),
            'name' => 'Large pool asset',
            'kind' => 'equipment',
            'status' => AssetStatus::Available,
        ]);
    }

    $largeCount = candidatePerformanceQueryCount(function () use ($job): void {
        app(AssetCandidateQuery::class)->page(
            $job,
            ListDispatchCandidatesRequest::create('/', 'GET', [
                'resource' => 'assets',
                'per_page' => 25,
            ]),
        );
    });

    expect($largeCount)->toBe($smallCount)
        ->and($largeCount)->toBeLessThanOrEqual(8);
});

it('validates bounded candidate filters at the request boundary', function (): void {
    $dispatcher = candidatePerformanceDispatcher();
    $job = candidatePerformanceJob($dispatcher, 'CAND-1004');

    $this->actingAs($dispatcher)
        ->get("/operations/dispatch-jobs/{$job->id}?resource=assets&search=".str_repeat('x', 81))
        ->assertSessionHasErrors('search');

    $this->actingAs($dispatcher)
        ->get("/operations/dispatch-jobs/{$job->id}?resource=assets&per_page=51")
        ->assertSessionHasErrors('per_page');
});

function candidatePerformanceQueryCount(Closure $callback): int
{
    $count = 0;
    DB::listen(static function () use (&$count): void {
        $count++;
    });

    $callback();

    return $count;
}
