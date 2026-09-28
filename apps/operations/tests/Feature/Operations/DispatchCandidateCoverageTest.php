<?php

use App\Modules\Assignment\Http\Requests\ListDispatchCandidatesRequest;
use App\Modules\Assignment\Queries\AssetCandidateQuery;
use App\Modules\Assignment\Queries\PersonnelCandidateQuery;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    $this->dispatcher = User::factory()->create(['name' => 'Coverage dispatcher']);
    $this->dispatcher->syncRoles([RoleName::OperationsManager->value]);
    $this->job = DispatchJob::query()->create([
        'reference' => 'DSP-COVERAGE-1',
        'client' => 'Test client',
        'title' => 'Resource coverage',
        'site' => 'Test site',
        'scheduled_start' => now()->addDays(3)->startOfHour(),
        'scheduled_end' => now()->addDays(3)->startOfHour()->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'version' => 1,
        'created_by' => $this->dispatcher->id,
    ]);
});

function coverageAsset(string $code, string $kind, AssetStatus $status = AssetStatus::Available): OperationalAsset
{
    $asset = OperationalAsset::query()->create([
        'code' => $code,
        'name' => $code.' resource',
        'kind' => $kind,
        'status' => $status,
    ]);
    $asset->inspections()->create([
        'technician_id' => User::query()->firstOrFail()->id,
        'type' => 'daily_safety',
        'result' => 'passed',
        'checklist' => ['fixture_readiness' => true],
        'completed_at' => now()->subDay(),
    ]);

    return $asset;
}

function coverageOperator(string $name, ?string $licenseStatus = null): User
{
    $user = User::factory()->create(['name' => $name]);
    $user->syncRoles([RoleName::CraneOperator->value]);
    $user->personnelProfile()->create(['availability_status' => 'available']);
    if ($licenseStatus !== null) {
        $user->personnelCredentials()->create([
            'kind' => 'driver_license',
            'credential_number' => 'DL-'.str_replace(' ', '-', $name),
            'credential_type' => 'professional',
            'issued_at' => now()->subYear(),
            'expires_at' => $licenseStatus === 'expired' ? now()->subDay() : now()->addYear(),
            'status' => 'active',
        ]);
    }

    return $user;
}

test('fleet vehicles and tower cranes appear and can be assigned under their own kinds', function (): void {
    $vehicle = coverageAsset('VEH-001', 'vehicle');
    $tower = coverageAsset('TWR-001', 'tower_crane');
    $page = app(AssetCandidateQuery::class)->page($this->job, ListDispatchCandidatesRequest::create('/', 'GET', ['resource' => 'assets']));

    expect(array_column($page->data, 'assignment_type'))->toEqualCanonicalizing(['tower_crane', 'vehicle'])
        ->and(collect($page->data)->every(fn (array $item): bool => $item['eligible']))->toBeTrue();

    $this->actingAs($this->dispatcher)->post("/operations/dispatch-jobs/{$this->job->id}/assignments", [
        'assets' => [
            ['operational_asset_id' => $vehicle->id, 'assignment_type' => 'vehicle'],
            ['operational_asset_id' => $tower->id, 'assignment_type' => 'tower_crane'],
        ],
        'version' => $this->job->version,
    ])->assertSessionHasNoErrors();

    expect($this->job->assetAssignments()->whereNull('active_until')->pluck('assignment_type')->all())
        ->toEqualCanonicalizing(['vehicle', 'tower_crane']);
});

test('new asset kinds still reject a mismatched or blocked resource', function (): void {
    $vehicle = coverageAsset('VEH-002', 'vehicle');
    $blockedTower = coverageAsset('TWR-002', 'tower_crane', AssetStatus::UnderMaintenance);

    $this->actingAs($this->dispatcher)->post("/operations/dispatch-jobs/{$this->job->id}/assignments", [
        'assets' => [['operational_asset_id' => $vehicle->id, 'assignment_type' => 'tower_crane']],
        'version' => $this->job->version,
    ])->assertSessionHasErrors('assets');

    $this->post("/operations/dispatch-jobs/{$this->job->id}/assignments", [
        'assets' => [['operational_asset_id' => $blockedTower->id, 'assignment_type' => 'tower_crane']],
        'version' => $this->job->version,
    ])->assertSessionHasErrors('assets');

    expect($this->job->assetAssignments()->count())->toBe(0);
});

test('candidate and assignment checks agree after a failed inspection and its passing follow-up', function (): void {
    $vehicle = OperationalAsset::query()->create([
        'code' => 'VEH-INSPECT',
        'name' => 'Inspection evidence vehicle',
        'kind' => 'vehicle',
        'status' => AssetStatus::Available,
    ]);
    $candidate = fn (): array => collect(app(AssetCandidateQuery::class)->page(
        $this->job,
        ListDispatchCandidatesRequest::create('/', 'GET', ['resource' => 'assets']),
    )->data)->firstWhere('id', $vehicle->id);

    expect($candidate()['eligible'])->toBeTrue()
        ->and($candidate()['activation_constraints'][0])->toContain('passing workshop inspection');

    $vehicle->inspections()->create([
        'technician_id' => $this->dispatcher->id,
        'type' => 'daily_safety',
        'result' => 'failed',
        'checklist' => ['brakes' => 'repair required'],
        'completed_at' => now()->subHour(),
    ]);

    expect($candidate()['eligible'])->toBeFalse();

    $this->actingAs($this->dispatcher)->post("/operations/dispatch-jobs/{$this->job->id}/assignments", [
        'assets' => [['operational_asset_id' => $vehicle->id, 'assignment_type' => 'vehicle']],
        'version' => $this->job->version,
    ])->assertSessionHasErrors('assets');

    $vehicle->inspections()->create([
        'technician_id' => $this->dispatcher->id,
        'type' => 'daily_safety',
        'result' => 'passed',
        'checklist' => ['brakes' => 'ok'],
        'completed_at' => now(),
    ]);

    expect($candidate()['eligible'])->toBeTrue();
});

test('new asset kinds can replace an existing assignment through the normal reassignment route', function (string $kind): void {
    $current = coverageAsset(strtoupper($kind).'-OLD', $kind);
    $replacement = coverageAsset(strtoupper($kind).'-NEW', $kind);
    $assignment = $this->job->assetAssignments()->create([
        'operational_asset_id' => $current->id,
        'assignment_type' => $kind,
        'assigned_by' => $this->dispatcher->id,
        'active_from' => $this->job->scheduled_start,
    ]);

    $this->actingAs($this->dispatcher)->post("/operations/dispatch-jobs/{$this->job->id}/reassign", [
        'end_asset_assignment_ids' => [$assignment->id],
        'assets' => [['operational_asset_id' => $replacement->id, 'assignment_type' => $kind]],
        'version' => $this->job->version,
    ])->assertSessionHasNoErrors();

    expect($assignment->fresh()->active_until)->not->toBeNull()
        ->and($this->job->assetAssignments()->whereNull('active_until')->first()?->operational_asset_id)->toBe($replacement->id);
})->with(['vehicle', 'tower_crane']);

test('driver filter evaluates crane operators against their driver licences', function (): void {
    coverageOperator('A Missing');
    $valid = coverageOperator('B Licensed', 'valid');
    coverageOperator('C Expired', 'expired');

    $page = app(PersonnelCandidateQuery::class)->page($this->job, ListDispatchCandidatesRequest::create('/', 'GET', [
        'resource' => 'personnel', 'type' => 'driver',
    ]));

    expect($page->data)->toHaveCount(3)
        ->and(collect($page->data)->firstWhere('id', $valid->id)['assignment_type'])->toBe('driver')
        ->and(collect($page->data)->firstWhere('id', $valid->id)['credential']['status'])->toBe('valid')
        ->and(collect($page->data)->firstWhere('name', 'A Missing')['eligible'])->toBeFalse()
        ->and(collect($page->data)->firstWhere('name', 'C Expired')['credential']['status'])->toBe('expired');

    $this->actingAs($this->dispatcher)->post("/operations/dispatch-jobs/{$this->job->id}/assignments", [
        'personnel' => [['user_id' => $valid->id, 'assignment_type' => 'driver']],
        'version' => $this->job->version,
    ])->assertSessionHasNoErrors();

    expect($this->job->personnelAssignments()->where('user_id', $valid->id)->first()?->assignment_type)->toBe('driver');
});

test('eligible-only asset pages count the full eligible pool before slicing pages', function (): void {
    coverageAsset('A-Blocked', 'vehicle', AssetStatus::UnderMaintenance);
    coverageAsset('B-Ready', 'vehicle');
    coverageAsset('C-Blocked', 'vehicle', AssetStatus::UnderMaintenance);
    coverageAsset('D-Ready', 'vehicle');

    $first = app(AssetCandidateQuery::class)->page($this->job, ListDispatchCandidatesRequest::create('/', 'GET', [
        'resource' => 'assets', 'type' => 'vehicle', 'eligible_only' => true, 'per_page' => 1, 'page' => 1,
    ]));
    $second = app(AssetCandidateQuery::class)->page($this->job, ListDispatchCandidatesRequest::create('/', 'GET', [
        'resource' => 'assets', 'type' => 'vehicle', 'eligible_only' => true, 'per_page' => 1, 'page' => 2,
    ]));

    expect($first->pagination['total'])->toBe(2)
        ->and($first->pagination['last_page'])->toBe(2)
        ->and($first->data[0]['code'])->toBe('B-Ready')
        ->and($second->data[0]['code'])->toBe('D-Ready');
});

test('eligible-only driver pages skip unlicensed operators and report eligible totals', function (): void {
    coverageOperator('A Missing');
    coverageOperator('B Licensed', 'valid');
    coverageOperator('C Expired', 'expired');
    coverageOperator('D Licensed', 'valid');

    $first = app(PersonnelCandidateQuery::class)->page($this->job, ListDispatchCandidatesRequest::create('/', 'GET', [
        'resource' => 'personnel', 'type' => 'driver', 'eligible_only' => true, 'per_page' => 1, 'page' => 1,
    ]));
    $second = app(PersonnelCandidateQuery::class)->page($this->job, ListDispatchCandidatesRequest::create('/', 'GET', [
        'resource' => 'personnel', 'type' => 'driver', 'eligible_only' => true, 'per_page' => 1, 'page' => 2,
    ]));

    expect($first->pagination['total'])->toBe(2)
        ->and($first->pagination['last_page'])->toBe(2)
        ->and($first->data[0]['name'])->toBe('B Licensed')
        ->and($second->data[0]['name'])->toBe('D Licensed');
});
