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
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function handoverOperator(string $name): User
{
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true, 'name' => $name]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    return $user;
}

/**
 * An outgoing operator on a working job with crane HO-CRN-7, and a relief
 * operator with no job. Returns [outgoing, relief, job].
 *
 * @return array{0: User, 1: User, 2: DispatchJob}
 */
function handoverScene(): array
{
    $outgoing = handoverOperator('Outgoing Operator');
    $relief = handoverOperator('Relief Operator');

    /** @var OperationalAsset $crane */
    $crane = OperationalAsset::query()->create([
        'code' => 'HO-CRN-7',
        'name' => '50T Crane',
        'kind' => 'crane',
        'status' => AssetStatus::Available,
    ]);

    /** @var DispatchJob $job */
    $job = DispatchJob::query()->create([
        'reference' => 'DSP-HO-1',
        'client' => 'Acme',
        'title' => 'Tandem lift',
        'site' => 'Pier 4',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Working,
        'version' => 1,
        'created_by' => $outgoing->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $outgoing->id,
        'assignment_type' => 'crane_operator',
        'assigned_by' => $outgoing->id,
        'response_status' => AssignmentResponse::Accepted,
    ]);

    DispatchAssetAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'operational_asset_id' => $crane->id,
        'assignment_type' => 'crane',
        'assigned_by' => $outgoing->id,
    ]);

    return [$outgoing, $relief, $job];
}

function startHandover(User $outgoing, DispatchJob $job): string
{
    $response = test()->withToken($outgoing->createToken('out')->plainTextToken)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/initiate")
        ->assertOk();

    app('auth')->forgetGuards();

    return (string) $response->json('data.pin');
}

function wrongPin(string $pin): string
{
    return $pin === '1234' ? '4321' : '1234';
}

it('lets a relief operator with no job claim the unit by its code and the PIN', function (): void {
    [$outgoing, $relief, $job] = handoverScene();
    $pin = startHandover($outgoing, $job);

    $this->withToken($relief->createToken('in')->plainTextToken)
        ->postJson('/api/v1/equipment-handovers/claim', [
            'asset_code' => 'ho-crn-7',
            'pin' => $pin,
        ])
        ->assertOk()
        ->assertJsonPath('data.dispatch_job_id', $job->id)
        ->assertJsonPath('data.asset_code', 'HO-CRN-7')
        ->assertJsonPath('data.active_operator_id', $relief->id);

    expect(DispatchPersonnelAssignment::query()
        ->where('dispatch_job_id', $job->id)
        ->where('user_id', $relief->id)
        ->whereNull('active_until')
        ->exists())->toBeTrue();
});

it('says no handover is waiting when the unit has none', function (): void {
    [, $relief] = handoverScene();

    $this->withToken($relief->createToken('in')->plainTextToken)
        ->postJson('/api/v1/equipment-handovers/claim', [
            'asset_code' => 'HO-CRN-7',
            'pin' => '1234',
        ])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'No handover is waiting for this unit. Ask the outgoing operator to start one.');
});

it('rejects a wrong PIN and cancels the handover after five wrong tries', function (): void {
    [$outgoing, $relief, $job] = handoverScene();
    $pin = startHandover($outgoing, $job);
    $token = $relief->createToken('in')->plainTextToken;

    foreach (range(1, 4) as $try) {
        $this->withToken($token)
            ->postJson('/api/v1/equipment-handovers/claim', ['asset_code' => 'HO-CRN-7', 'pin' => wrongPin($pin)])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'That PIN is not right for this unit.');
    }

    $this->withToken($token)
        ->postJson('/api/v1/equipment-handovers/claim', ['asset_code' => 'HO-CRN-7', 'pin' => wrongPin($pin)])
        ->assertUnprocessable()
        ->assertJsonPath('message', 'Too many wrong PINs. The handover was cancelled; ask the outgoing operator to start a new one.');

    // The real PIN no longer works once the handover is cancelled.
    $this->withToken($token)
        ->postJson('/api/v1/equipment-handovers/claim', ['asset_code' => 'HO-CRN-7', 'pin' => $pin])
        ->assertUnprocessable();

    $this->withToken($token)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/claim", ['pin' => $pin])
        ->assertUnprocessable();
});

it('applies the same wrong-PIN limit to the per-job claim', function (): void {
    [$outgoing, $relief, $job] = handoverScene();
    $pin = startHandover($outgoing, $job);
    $token = $relief->createToken('in')->plainTextToken;

    foreach (range(1, 5) as $try) {
        $this->withToken($token)
            ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/claim", ['pin' => wrongPin($pin)])
            ->assertUnprocessable();
    }

    $this->withToken($token)
        ->postJson("/api/v1/dispatch-jobs/{$job->id}/handover/claim", ['pin' => $pin])
        ->assertUnprocessable();
});

it('does not let the outgoing operator claim their own unit', function (): void {
    [$outgoing, , $job] = handoverScene();
    $pin = startHandover($outgoing, $job);

    $this->withToken($outgoing->createToken('again')->plainTextToken)
        ->postJson('/api/v1/equipment-handovers/claim', ['asset_code' => 'HO-CRN-7', 'pin' => $pin])
        ->assertUnprocessable();
});

it('requires a unit code and a four-digit PIN', function (): void {
    [, $relief] = handoverScene();

    $this->withToken($relief->createToken('in')->plainTextToken)
        ->postJson('/api/v1/equipment-handovers/claim', ['pin' => '12'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['asset_code', 'pin']);
});
