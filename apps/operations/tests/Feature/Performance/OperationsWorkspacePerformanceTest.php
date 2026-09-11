<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function performanceWorkspaceDispatcher(string $name = 'Performance dispatcher'): User
{
    $user = User::factory()->create(['name' => $name]);
    $user->syncRoles([RoleName::OperationsManager->value]);

    return $user;
}

function performanceWorkspaceJob(User $dispatcher, string $reference = 'PERF-1001'): DispatchJob
{
    return DispatchJob::query()->create([
        'reference' => $reference,
        'client' => 'Performance client',
        'title' => 'Performance dispatch',
        'site' => 'Quezon City',
        'scheduled_start' => now()->addDay()->startOfHour(),
        'scheduled_end' => now()->addDay()->startOfHour()->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
    ]);
}

it('keeps the initial workspace response to the shell and defers only the authorized initial section', function (): void {
    $dispatcher = performanceWorkspaceDispatcher();

    $queryCount = 0;
    DB::listen(static function () use (&$queryCount): void {
        $queryCount++;
    });
    $response = $this->actingAs($dispatcher)->get('/');
    $initialQueryCount = $queryCount;

    $response->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('workspace')
        ->has('navigation')
        ->has('capabilities')
        ->has('workspace')
        ->has('badges')
        ->missing('jobs')
        ->missing('users')
        ->missing('notifications')
        ->loadDeferredProps('workspace-overview', fn (Assert $section) => $section
            ->has('jobs')
            ->has('clients')
            ->has('serviceRequests')
            ->has('assets')));

    $page = json_decode(json_encode($response->viewData('page')), true, flags: JSON_THROW_ON_ERROR);

    expect($page['deferredProps']['workspace-overview'] ?? [])->toContain('jobs')
        ->and($page['props'])->not->toHaveKey('users')
        ->and($initialQueryCount)->toBeLessThanOrEqual(14)
        ->and(strlen(json_encode($page['props'], JSON_THROW_ON_ERROR)))->toBeLessThan(150_000);
});

it('loads only the mapped dispatch section on a partial deferred visit', function (): void {
    $dispatcher = performanceWorkspaceDispatcher();
    $job = performanceWorkspaceJob($dispatcher, 'PERF-1002');

    $queryCount = 0;
    DB::listen(static function () use (&$queryCount): void {
        $queryCount++;
    });
    $response = $this->actingAs($dispatcher)->get('/?view=dispatch');
    $initialQueryCount = $queryCount;

    $response->assertOk()->assertInertia(fn (Assert $page) => $page
        ->where('initial_section', 'dispatch')
        ->missing('users')
        ->missing('notifications')
        ->loadDeferredProps('workspace-dispatch', fn (Assert $section) => $section
            ->has('jobs')
            ->where('jobs.0.reference', $job->reference)
            ->has('clients')
            ->has('serviceRequests')
            ->has('assets')));

    expect($initialQueryCount)->toBeLessThanOrEqual(14);
});
