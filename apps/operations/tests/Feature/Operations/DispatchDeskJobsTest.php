<?php

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function deskJobsUser(RoleName $role = RoleName::OperationsManager): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

/** @param array<string, mixed> $attributes */
function deskJobsFixture(User $creator, array $attributes = []): DispatchJob
{
    return DispatchJob::query()->create(array_merge([
        'reference' => 'DESK-'.Str::random(12),
        'client' => 'Dispatch client',
        'title' => 'Dispatch work',
        'site' => 'Manila',
        'status' => 'completed',
        'priority' => 'routine',
        'scheduled_start' => '2026-09-05 01:00:00',
        'scheduled_end' => '2026-09-05 05:00:00',
        'created_by' => $creator->id,
    ], $attributes));
}

it('paginates the full history deterministically and finds records beyond the workspace limit', function (): void {
    $user = deskJobsUser();
    $old = deskJobsFixture($user, ['reference' => 'OLDER-THAN-100', 'updated_at' => now()->subYear()]);
    for ($index = 0; $index < 101; $index++) {
        deskJobsFixture($user);
    }
    $this->actingAs($user)->getJson('/operations/dispatch-desk/jobs?view=history')
        ->assertOk()->assertJsonCount(25, 'jobs')->assertJsonPath('total', 102)
        ->assertJsonPath('current_page', 1)->assertJsonPath('last_page', 5)->assertJsonPath('per_page', 25);
    $this->getJson('/operations/dispatch-desk/jobs?view=history&page=5')
        ->assertOk()->assertJsonCount(2, 'jobs')->assertJsonPath('jobs.1.id', $old->id);
    $this->getJson('/operations/dispatch-desk/jobs?view=history&q=OLDER-THAN-100')
        ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('jobs.0.id', $old->id);
    $this->getJson('/operations/dispatch-desk/jobs?view=history&page=6')
        ->assertOk()->assertJsonCount(0, 'jobs')->assertJsonPath('total', 102);
});

it('searches reference title client site and source reference before paginating', function (string $field): void {
    $user = deskJobsUser();
    $match = deskJobsFixture($user, [$field => 'Needle value']);
    deskJobsFixture($user);
    $this->actingAs($user)->getJson('/operations/dispatch-desk/jobs?view=history&q=needle')
        ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('jobs.0.id', $match->id);
})->with(['reference', 'title', 'client', 'site', 'source_reference']);

it('filters source and excludes archived records', function (): void {
    $user = deskJobsUser();
    $manual = deskJobsFixture($user);
    $rental = deskJobsFixture($user, ['source_type' => 'rental_reservation']);
    deskJobsFixture($user, ['source_type' => 'sales_order']);
    deskJobsFixture($user)->delete();
    $this->actingAs($user)->getJson('/operations/dispatch-desk/jobs?view=history&source=manual')
        ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('jobs.0.id', $manual->id);
    $this->getJson('/operations/dispatch-desk/jobs?view=history&source=rental_reservation')
        ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('jobs.0.id', $rental->id);
});

it('uses strict interval overlap and includes only fully undated preparation work', function (): void {
    $user = deskJobsUser();
    $inside = deskJobsFixture($user, ['status' => 'scheduled']);
    $undated = deskJobsFixture($user, ['status' => 'draft', 'scheduled_start' => null, 'scheduled_end' => null]);
    deskJobsFixture($user, ['status' => 'working', 'scheduled_start' => null, 'scheduled_end' => null]);
    deskJobsFixture($user, ['status' => 'draft', 'scheduled_start' => null]);
    deskJobsFixture($user, ['status' => 'scheduled', 'scheduled_start' => '2026-09-04 20:00:00', 'scheduled_end' => '2026-09-05 00:00:00']);
    deskJobsFixture($user, ['status' => 'scheduled', 'scheduled_start' => '2026-09-06 00:00:00', 'scheduled_end' => '2026-09-06 02:00:00']);
    deskJobsFixture($user);
    $query = http_build_query(['view' => 'schedule', 'ends_after' => '2026-09-05T08:00:00+08:00', 'starts_before' => '2026-09-06T08:00:00+08:00']);
    $response = $this->actingAs($user)->getJson('/operations/dispatch-desk/jobs?'.$query)->assertOk()->assertJsonPath('total', 2);
    expect(array_column($response->json('jobs'), 'id'))->toEqualCanonicalizing([$inside->id, $undated->id]);
});

it('filters in-progress work independently of schedule dates', function (): void {
    $user = deskJobsUser();
    $working = deskJobsFixture($user, ['status' => 'working']);
    deskJobsFixture($user, ['status' => 'draft']);
    deskJobsFixture($user);
    $this->actingAs($user)->getJson('/operations/dispatch-desk/jobs?view=in-progress')
        ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('jobs.0.id', $working->id);
});

it('requires authenticated authorized access and scopes jobs and personnel to the viewer', function (): void {
    $this->getJson('/operations/dispatch-desk/jobs?view=history')->assertUnauthorized();
    $unauthorized = User::factory()->create();
    $unauthorized->syncRoles([]);
    $this->actingAs($unauthorized)->getJson('/operations/dispatch-desk/jobs?view=history')->assertForbidden();
    $manager = deskJobsUser();
    $operator = deskJobsUser(RoleName::CraneOperator);
    $other = deskJobsUser(RoleName::CraneOperator);
    $visible = deskJobsFixture($manager);
    deskJobsFixture($manager);
    foreach ([$operator, $other] as $worker) {
        DispatchPersonnelAssignment::query()->create([
            'dispatch_job_id' => $visible->id, 'user_id' => $worker->id,
            'assignment_type' => 'operator', 'assigned_by' => $manager->id,
        ]);
    }
    $this->actingAs($operator)->getJson('/operations/dispatch-desk/jobs?view=history')
        ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('jobs.0.id', $visible->id)
        ->assertJsonCount(1, 'jobs.0.personnel_assignments')
        ->assertJsonPath('jobs.0.personnel_assignments.0.user_id', $operator->id);
    $this->getJson('/operations/dispatch-desk/jobs?view=history&q=nonexistent')
        ->assertOk()->assertJsonPath('total', 0);
});

it('rejects invalid query parameters', function (array $query, string $field): void {
    $this->actingAs(deskJobsUser())->getJson('/operations/dispatch-desk/jobs?'.http_build_query($query))
        ->assertUnprocessable()->assertJsonValidationErrors($field);
})->with([
    [['view' => 'unknown'], 'view'],
    [['view' => 'history', 'source' => 'unknown'], 'source'],
    [['view' => 'history', 'page' => 0], 'page'],
    [['view' => 'history', 'q' => ['bad']], 'q'],
    [['view' => 'history', 'q' => str_repeat('a', 201)], 'q'],
    [['view' => 'schedule'], 'ends_after'],
    [['view' => 'schedule', 'ends_after' => 'tomorrow', 'starts_before' => 'next week'], 'ends_after'],
    [['view' => 'schedule', 'ends_after' => '2026-09-06T00:00:00Z', 'starts_before' => '2026-09-05T00:00:00Z'], 'starts_before'],
]);
