<?php

use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

function riggerRemovalMigration(): Migration
{
    return require database_path('migrations/2026_09_29_120000_remove_rigger_role_and_crew_slot.php');
}

function riggerRemovalJob(User $actor, string $reference, array $attributes = []): DispatchJob
{
    return DispatchJob::query()->create(array_merge([
        'reference' => $reference,
        'client' => 'Bridge contractor',
        'title' => 'Girder lift',
        'site' => 'Bridge site',
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(4),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $actor->id,
    ], $attributes));
}

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    $this->manager = User::factory()->create();
    $this->manager->syncRoles([RoleName::OperationsManager->value]);
});

it('retires rigger-only accounts and deletes the rigger role', function (): void {
    Role::findOrCreate('rigger', 'web');
    $rigger = User::factory()->create(['is_active' => true]);
    $rigger->assignRole('rigger');
    $rigger->createToken('field');
    $dualRole = User::factory()->create(['is_active' => true]);
    $dualRole->assignRole('rigger', RoleName::CraneOperator->value);

    riggerRemovalMigration()->up();

    expect(Role::query()->where('name', 'rigger')->exists())->toBeFalse()
        ->and($rigger->refresh()->is_active)->toBeFalse()
        ->and($rigger->tokens()->count())->toBe(0)
        ->and($rigger->roles()->count())->toBe(0)
        ->and($dualRole->refresh()->is_active)->toBeTrue()
        ->and($dualRole->roles()->pluck('name')->all())->toBe([RoleName::CraneOperator->value]);
});

it('strips rigger slots from job requirements, phase coverage, and pending rosters', function (): void {
    $job = riggerRemovalJob($this->manager, 'DSP-RIG-MIG-1', [
        'resource_requirements' => ['personnel' => ['crane_operator' => 1, 'rigger' => 2], 'assets' => ['crane' => 1]],
    ]);
    $untouched = riggerRemovalJob($this->manager, 'DSP-RIG-MIG-2', [
        'resource_requirements' => ['personnel' => ['driver' => 1], 'assets' => ['truck' => 1]],
    ]);
    $planId = DB::table('dispatch_project_plans')->insertGetId([
        'source_reference' => 'RIG-MIG-PLAN', 'name' => 'Plan', 'client' => 'Client', 'site' => 'Site',
        'created_by' => $this->manager->id, 'created_at' => now(), 'updated_at' => now(),
    ]);
    $phaseId = DB::table('dispatch_project_phases')->insertGetId([
        'project_plan_id' => $planId, 'name' => 'Lifting', 'kind' => 'operations',
        'starts_at' => now(), 'ends_at' => now()->addMonth(),
        'coverage' => json_encode(['crane_operator' => 1, 'driver' => 0, 'rigger' => 2]),
        'created_at' => now(), 'updated_at' => now(),
    ]);
    $shiftId = DB::table('dispatch_project_shifts')->insertGetId([
        'project_phase_id' => $phaseId, 'dispatch_job_id' => $job->id,
        'pending_roster' => json_encode([
            ['user_id' => $this->manager->id, 'assignment_type' => 'rigger'],
            ['user_id' => $this->manager->id, 'assignment_type' => 'crane_operator'],
        ]),
        'created_at' => now(), 'updated_at' => now(),
    ]);

    riggerRemovalMigration()->up();

    expect($job->refresh()->resource_requirements)
        ->toBe(['personnel' => ['crane_operator' => 1], 'assets' => ['crane' => 1]])
        ->and($untouched->refresh()->resource_requirements)
        ->toBe(['personnel' => ['driver' => 1], 'assets' => ['truck' => 1]])
        ->and(json_decode(DB::table('dispatch_project_phases')->where('id', $phaseId)->value('coverage'), true))
        ->toBe(['crane_operator' => 1, 'driver' => 0])
        ->and(json_decode(DB::table('dispatch_project_shifts')->where('id', $shiftId)->value('pending_roster'), true))
        ->toBe([['user_id' => $this->manager->id, 'assignment_type' => 'crane_operator']]);
});

it('keeps rigger certifications as general qualifications', function (): void {
    $operator = User::factory()->create();
    $credentialId = DB::table('personnel_credentials')->insertGetId([
        'user_id' => $operator->id, 'kind' => 'rigger_certification', 'credential_number' => 'TESDA-RIG-MIG',
        'credential_type' => 'TESDA NC-II Rigging', 'status' => 'active', 'created_at' => now(), 'updated_at' => now(),
    ]);

    riggerRemovalMigration()->up();

    expect(DB::table('personnel_credentials')->where('id', $credentialId)->value('kind'))->toBe('qualification');
});
