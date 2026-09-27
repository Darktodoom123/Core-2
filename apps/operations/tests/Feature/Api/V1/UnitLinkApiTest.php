<?php

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Models\UnitLink;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function unitLinkOperator(string $name): User
{
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true, 'name' => $name]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    return $user;
}

function unitLinkCrane(string $code, AssetStatus $status = AssetStatus::Available): OperationalAsset
{
    /** @var OperationalAsset */
    return OperationalAsset::query()->create([
        'code' => $code,
        'name' => '50T Crane',
        'kind' => 'crane',
        'status' => $status,
    ]);
}

/** A working job with the crane assigned and each operator accepted on it. */
function unitLinkJob(OperationalAsset $crane, User ...$operators): DispatchJob
{
    return unitLinkJobWithStatus(DispatchStatus::Working, $crane, ...$operators);
}

function unitLinkJobWithStatus(DispatchStatus $status, OperationalAsset $crane, User ...$operators): DispatchJob
{
    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-UL-'.Str::upper(Str::random(5)),
        'client' => 'Acme',
        'title' => 'Tandem lift',
        'site' => 'Pier 4',
        'priority' => DispatchPriority::Routine,
        'status' => $status,
        'version' => 1,
        'created_by' => $operators[0]->id,
    ]);

    foreach ($operators as $operator) {
        DispatchPersonnelAssignment::query()->create([
            'dispatch_job_id' => $job->id,
            'user_id' => $operator->id,
            'assignment_type' => 'crane_operator',
            'assigned_by' => $operator->id,
            'response_status' => AssignmentResponse::Accepted,
        ]);
    }

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $crane->id,
        'assignment_type' => 'crane',
        'assigned_by' => $operators[0]->id,
    ]);

    return $job;
}

function linkAs(User $operator, OperationalAsset $crane, ?string $commandId = null)
{
    app('auth')->forgetGuards();
    $request = test()->withToken($operator->createToken('phone')->plainTextToken);

    if ($commandId !== null) {
        $request = $request->withHeader('X-Command-Id', $commandId);
    }

    return $request->postJson('/api/v1/unit-link', ['operational_asset_id' => $crane->id]);
}

it('requires authentication', function (): void {
    $this->getJson('/api/v1/unit-link')->assertUnauthorized();
    $this->postJson('/api/v1/unit-link', [])->assertUnauthorized();
    $this->postJson('/api/v1/unit-link/release')->assertUnauthorized();
});

it('links an assigned operator, and another phone of theirs sees the link', function (): void {
    $operator = unitLinkOperator('Operator A');
    $crane = unitLinkCrane('UL-CRN-1');
    $job = unitLinkJob($crane, $operator);

    linkAs($operator, $crane)
        ->assertCreated()
        ->assertJsonPath('data.asset_code', 'UL-CRN-1')
        ->assertJsonPath('data.dispatch_job_id', $job->id)
        ->assertJsonPath('data.released_at', null);

    app('auth')->forgetGuards();
    $this->withToken($operator->createToken('second phone')->plainTextToken)
        ->getJson('/api/v1/unit-link')
        ->assertOk()
        ->assertJsonPath('data.asset_code', 'UL-CRN-1');
});

it('linking the same unit again returns the existing link', function (): void {
    $operator = unitLinkOperator('Operator A');
    $crane = unitLinkCrane('UL-CRN-1');
    unitLinkJob($crane, $operator);

    $first = linkAs($operator, $crane)->assertCreated()->json('data.id');
    $second = linkAs($operator, $crane)->assertOk()->json('data.id');

    expect($second)->toBe($first);
    expect(UnitLink::query()->count())->toBe(1);
});

it('refuses an operator not assigned to the unit', function (): void {
    $assigned = unitLinkOperator('Operator A');
    $stranger = unitLinkOperator('Operator B');
    $crane = unitLinkCrane('UL-CRN-1');
    unitLinkJob($crane, $assigned);

    linkAs($stranger, $crane)
        ->assertStatus(422)
        ->assertJsonPath('message', 'You are not assigned to UL-CRN-1. Contact dispatch.');
});

it('refuses a unit locked out for maintenance', function (): void {
    $operator = unitLinkOperator('Operator A');
    $crane = unitLinkCrane('UL-CRN-1', AssetStatus::UnderMaintenance);
    unitLinkJob($crane, $operator);

    linkAs($operator, $crane)
        ->assertStatus(422)
        ->assertJsonPath('message', 'UL-CRN-1 is out of service (Under maintenance). Contact dispatch.');
});

it('refuses a unit another operator is bound to', function (): void {
    $first = unitLinkOperator('Operator A');
    $second = unitLinkOperator('Operator B');
    $crane = unitLinkCrane('UL-CRN-1');
    unitLinkJob($crane, $first, $second);

    linkAs($first, $crane)->assertCreated();

    linkAs($second, $crane)
        ->assertStatus(409)
        ->assertJsonPath('message', 'Unit UL-CRN-1 is actively bound to Operator A. Contact dispatch.');
});

it('refuses a second unit until the first is released', function (): void {
    $operator = unitLinkOperator('Operator A');
    $craneOne = unitLinkCrane('UL-CRN-1');
    $craneTwo = unitLinkCrane('UL-CRN-2');
    unitLinkJob($craneOne, $operator);
    unitLinkJob($craneTwo, $operator);

    linkAs($operator, $craneOne)->assertCreated();

    linkAs($operator, $craneTwo)
        ->assertStatus(409)
        ->assertJsonPath('message', 'Release UL-CRN-1 before linking UL-CRN-2.');
});

it('releases the unit, and releasing again is harmless', function (): void {
    $operator = unitLinkOperator('Operator A');
    $crane = unitLinkCrane('UL-CRN-1');
    unitLinkJob($crane, $operator);
    linkAs($operator, $crane)->assertCreated();

    app('auth')->forgetGuards();
    $token = $operator->createToken('phone')->plainTextToken;

    $this->withToken($token)->postJson('/api/v1/unit-link/release')
        ->assertOk()
        ->assertJsonPath('data.release_reason', 'released');
    $this->withToken($token)->getJson('/api/v1/unit-link')
        ->assertOk()
        ->assertJsonPath('data', null);
    $this->withToken($token)->postJson('/api/v1/unit-link/release')
        ->assertOk()
        ->assertJsonPath('data', null);

    $this->assertDatabaseHas('audit_events', ['action' => 'fleet.unit_released']);
});

it('replays a retried link command instead of linking twice', function (): void {
    $operator = unitLinkOperator('Operator A');
    $crane = unitLinkCrane('UL-CRN-1');
    unitLinkJob($crane, $operator);
    $commandId = (string) Str::uuid();

    $first = linkAs($operator, $crane, $commandId)->assertCreated()->json('data.id');
    $replay = linkAs($operator, $crane, $commandId)->assertCreated()->json('data.id');

    expect($replay)->toBe($first);
});

it('ending the shift releases the unit', function (): void {
    $operator = unitLinkOperator('Operator A');
    $crane = unitLinkCrane('UL-CRN-1');
    $job = unitLinkJob($crane, $operator);
    linkAs($operator, $crane)->assertCreated();

    app('auth')->forgetGuards();
    $token = $operator->createToken('phone')->plainTextToken;

    $this->withToken($token)->postJson('/api/v1/hos/shifts/start', [
        'operational_asset_id' => $crane->id,
        'dispatch_job_id' => $job->id,
        'duty_status' => 'operating',
    ])->assertCreated();

    $this->withToken($token)->postJson('/api/v1/hos/shifts/certify', [
        'certification_statement' => 'I certify that these duty status entries are true, complete, and accurate.',
    ])->assertOk();

    expect(UnitLink::query()->open()->count())->toBe(0);
    $this->assertDatabaseHas('unit_links', ['user_id' => $operator->id, 'release_reason' => 'shift_ended']);
});

it('a defect lockout releases the unit', function (): void {
    $operator = unitLinkOperator('Operator A');
    $crane = unitLinkCrane('UL-CRN-1');
    unitLinkJob($crane, $operator);
    linkAs($operator, $crane)->assertCreated();

    app('auth')->forgetGuards();
    $this->withToken($operator->createToken('phone')->plainTextToken)
        ->postJson('/api/v1/dvir/inspections', [
            'inspection_type' => 'post_trip',
            'operational_asset_id' => $crane->id,
            'has_defects' => true,
            'signature_captured' => true,
            'checks' => [[
                'category' => 'hydraulics',
                'label' => 'Hydraulic line',
                'status' => 'critical',
            ]],
        ])
        ->assertCreated();

    expect(UnitLink::query()->open()->count())->toBe(0);
    $this->assertDatabaseHas('unit_links', ['user_id' => $operator->id, 'release_reason' => 'safety_lockout']);
});

it('a handover moves the unit link to the relief operator', function (): void {
    $outgoing = unitLinkOperator('Outgoing Operator');
    $relief = unitLinkOperator('Relief Operator');
    $crane = unitLinkCrane('UL-CRN-1');
    $job = unitLinkJob($crane, $outgoing);
    linkAs($outgoing, $crane)->assertCreated();

    app('auth')->forgetGuards();
    $pin = (string) $this->withToken($outgoing->createToken('out')->plainTextToken)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/initiate")
        ->assertOk()
        ->json('data.pin');

    app('auth')->forgetGuards();
    $reliefToken = $relief->createToken('relief')->plainTextToken;
    $this->withToken($reliefToken)
        ->postJson('/api/v1/equipment-handovers/claim', ['asset_code' => 'UL-CRN-1', 'pin' => $pin])
        ->assertOk();

    $this->withToken($reliefToken)->getJson('/api/v1/unit-link')
        ->assertOk()
        ->assertJsonPath('data.asset_code', 'UL-CRN-1');
    $this->assertDatabaseHas('unit_links', ['user_id' => $outgoing->id, 'release_reason' => 'handover']);
});

it('links on a scheduled job the operator accepted, but not on a finished or unapproved one', function (): void {
    $operator = unitLinkOperator('Operator A');
    $scheduled = unitLinkCrane('UL-CRN-1');
    unitLinkJobWithStatus(DispatchStatus::Scheduled, $scheduled, $operator);
    linkAs($operator, $scheduled)->assertCreated();

    $other = unitLinkOperator('Operator B');
    $finished = unitLinkCrane('UL-CRN-2');
    $draft = unitLinkCrane('UL-CRN-3');
    unitLinkJobWithStatus(DispatchStatus::Completed, $finished, $other);
    unitLinkJobWithStatus(DispatchStatus::Draft, $draft, $other);

    linkAs($other, $finished)->assertStatus(422);
    linkAs($other, $draft)->assertStatus(422);
});
