<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\SiteHazardTicket;
use App\Platform\Safety\Models\WorkStoppageNotice;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Carbon::setTestNow('2026-09-27 08:00:00');
});

afterEach(function (): void {
    Carbon::setTestNow();
});

function safetyOperator(): User
{
    /** @var User $user */
    $user = User::factory()->create(['is_active' => true]);
    $user->syncRoles([RoleName::CraneOperator->value]);

    return $user;
}

/** @param  array<string, mixed>  $attributes */
function hazardBy(User $reporter, array $attributes = []): SiteHazardTicket
{
    return SiteHazardTicket::query()->create([
        'ticket_code' => 'HZ-'.Str::upper(Str::random(6)),
        'project_site' => 'Pier 4',
        'reporter_id' => $reporter->id,
        'category' => 'overhead_powerline',
        'severity' => 'high',
        'description' => 'Line within swing radius',
        'location_detail' => 'North gate',
        'corrective_action_required' => 'Re-route lift',
        'status' => 'open',
        ...$attributes,
    ]);
}

/** @param  array<string, mixed>  $attributes */
function stoppageBy(User $issuer, array $attributes = []): WorkStoppageNotice
{
    return WorkStoppageNotice::query()->create([
        'notice_number' => 'WS-'.Str::upper(Str::random(6)),
        'project_site' => 'Pier 4',
        'issued_by' => $issuer->id,
        'dole_regulation_reference' => 'OSHS Rule 1005',
        'reason' => 'Unsafe ground',
        'affected_area' => 'Pad 2',
        'is_active' => true,
        ...$attributes,
    ]);
}

it('lists the operator\'s own hazard reports and stoppages with their outcome', function (): void {
    $worker = safetyOperator();
    $open = hazardBy($worker);
    Carbon::setTestNow(now()->addHour());
    $fixed = hazardBy($worker, [
        'status' => 'rectified',
        'rectified_at' => now()->addMinutes(30),
        'rectification_notes' => 'Line de-energised',
    ]);
    $lifted = stoppageBy($worker, [
        'is_active' => false,
        'lifted_at' => now()->addMinutes(45),
        'lift_reason' => 'Ground compacted',
    ]);

    $this->withToken($worker->createToken('m')->plainTextToken)
        ->getJson('/api/v1/safety/my-reports')
        ->assertOk()
        ->assertJsonCount(2, 'data.hazards')
        ->assertJsonPath('data.hazards.0.id', $fixed->id)
        ->assertJsonPath('data.hazards.0.status', 'rectified')
        ->assertJsonPath('data.hazards.0.rectification_notes', 'Line de-energised')
        ->assertJsonPath('data.hazards.0.rectified_at', now()->addMinutes(30)->toIso8601String())
        ->assertJsonPath('data.hazards.1.id', $open->id)
        ->assertJsonPath('data.hazards.1.rectified_at', null)
        ->assertJsonPath('data.work_stoppages.0.id', $lifted->id)
        ->assertJsonPath('data.work_stoppages.0.is_active', false)
        ->assertJsonPath('data.work_stoppages.0.lift_reason', 'Ground compacted');
});

it('never shows another person\'s reports', function (): void {
    $worker = safetyOperator();
    $other = safetyOperator();
    hazardBy($other);
    stoppageBy($other);

    $this->withToken($worker->createToken('m')->plainTextToken)
        ->getJson('/api/v1/safety/my-reports')
        ->assertOk()
        ->assertJsonCount(0, 'data.hazards')
        ->assertJsonCount(0, 'data.work_stoppages');
});

it('bounds reports to a window of days, 30 by default and 90 at most', function (): void {
    $worker = safetyOperator();
    Carbon::setTestNow(now()->subDays(40));
    hazardBy($worker);
    Carbon::setTestNow(now()->addDays(40));
    hazardBy($worker);
    $token = $worker->createToken('m')->plainTextToken;

    $this->withToken($token)->getJson('/api/v1/safety/my-reports')
        ->assertOk()->assertJsonCount(1, 'data.hazards');
    $this->withToken($token)->getJson('/api/v1/safety/my-reports?days=60')
        ->assertOk()->assertJsonCount(2, 'data.hazards');
    $this->withToken($token)->getJson('/api/v1/safety/my-reports?days=91')
        ->assertUnprocessable()->assertJsonValidationErrors(['days']);
});

it('requires a signed-in account', function (): void {
    $this->getJson('/api/v1/safety/my-reports')->assertUnauthorized();
});
