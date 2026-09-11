<?php

use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Planning\Models\ProjectPlan;
use App\Modules\Dispatch\Planning\Models\ProjectShift;
use App\Modules\Dispatch\Planning\Queries\ProjectPlanningQuery;
use App\Modules\Dispatch\Planning\Services\ProjectShiftReadiness;
use App\Modules\Dispatch\Services\DispatchV2CommandService;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->seed(RolePermissionSeeder::class);
    $this->manager = User::factory()->create();
    $this->manager->assignRole(RoleName::OperationsManager->value);
    $this->approver = User::factory()->create();
    $this->approver->assignRole(RoleName::OperationsManager->value);
    $this->asset = OperationalAsset::query()->create(['code' => 'PLAN-CR-1', 'name' => 'Site crane', 'kind' => 'crane', 'status' => AssetStatus::Available]);
    $this->start = now()->addDays(7)->startOfDay();
});

function planningProject($test): ProjectPlan
{
    $test->actingAs($test->manager)->post('/operations/project-plans', [
        'name' => 'Three-month bridge works', 'source_reference' => 'CORE1-PROJ-100',
        'client' => 'Bridge contractor', 'site' => 'Bridge site',
    ])->assertRedirect();

    $plan = ProjectPlan::query()->sole();
    $test->post("/operations/project-plans/{$plan->id}/phases", [
        'version' => $plan->version, 'name' => 'Lifting operations', 'kind' => 'operations',
        'starts_at' => $test->start->toIso8601String(), 'ends_at' => $test->start->copy()->addMonths(3)->toIso8601String(),
        'coverage' => ['crane_operator' => 1, 'driver' => 0, 'rigger' => 0],
    ])->assertRedirect();

    return $plan->refresh();
}

it('reserves a crane across three months and blocks other usage', function () {
    $plan = planningProject($this);
    $phase = $plan->phases()->sole();
    $this->post("/operations/project-plans/{$plan->id}/phases/{$phase->id}/allocations", [
        'version' => $plan->version, 'operational_asset_id' => $this->asset->id, 'kind' => 'reservation',
        'starts_at' => $phase->starts_at->toIso8601String(), 'ends_at' => $phase->ends_at->toIso8601String(), 'notes' => 'Remains on site',
    ])->assertRedirect();
    $assessment = app(OperationalAssetAvailability::class)->assess(new AssetUsageRequest(
        $this->asset->id, AssetUsageType::DispatchAssign, $this->start->toImmutable(), $this->start->copy()->addHour()->toImmutable(),
    ));
    expect($assessment->allowed())->toBeFalse();
});

it('requires independent baseline approval and rejects stale edits', function () {
    $plan = planningProject($this);
    $this->post("/operations/project-plans/{$plan->id}/submit", ['version' => $plan->version])->assertRedirect();
    $plan->refresh();
    $this->post("/operations/project-plans/{$plan->id}/decision", ['version' => $plan->version, 'decision' => 'approved', 'reason' => 'Reviewed'])->assertForbidden();
    $this->actingAs($this->approver)->post("/operations/project-plans/{$plan->id}/decision", ['version' => $plan->version, 'decision' => 'approved', 'reason' => 'Reviewed'])->assertRedirect();
    expect($plan->refresh()->status)->toBe('approved');
    $this->actingAs($this->manager)->post("/operations/project-plans/{$plan->id}/submit", ['version' => 1])->assertSessionHasErrors('version');
});

it('generates a week of distinct linked shifts and prevents duplicates on retry', function () {
    $plan = planningProject($this);
    $phase = $plan->phases()->sole();
    $payload = ['version' => $plan->version, 'starts_at' => $this->start->copy()->addHours(7)->toIso8601String(), 'ends_at' => $this->start->copy()->addHours(15)->toIso8601String(), 'days' => 7];
    $url = "/operations/project-plans/{$plan->id}/phases/{$phase->id}/shifts";
    $this->post($url, $payload)->assertRedirect();
    expect(ProjectShift::query()->count())->toBe(7);
    $this->post($url, $payload)->assertSessionHasErrors('version');
    expect(ProjectShift::query()->count())->toBe(7);
});

it('denies field users the project planning mutation and data', function () {
    $field = User::factory()->create();
    $field->assignRole(RoleName::CraneOperator->value);
    $this->actingAs($field)->post('/operations/project-plans', ['name' => 'Forged'])->assertForbidden();
    $this->get('/?view=dispatch')->assertOk()->assertInertia(fn ($page) => $page->missing('projectPlanning'));
});

function planningPreparedShift($test): ProjectShift
{
    $plan = planningProject($test);
    $phase = $plan->phases()->sole();
    $phase->allocations()->create(['operational_asset_id' => $test->asset->id, 'kind' => 'reservation', 'starts_at' => $phase->starts_at, 'ends_at' => $phase->ends_at]);
    $test->post("/operations/project-plans/{$plan->id}/phases/{$phase->id}/shifts", ['version' => $plan->version, 'starts_at' => $test->start->copy()->addHours(7)->toIso8601String(), 'ends_at' => $test->start->copy()->addHours(15)->toIso8601String(), 'days' => 1])->assertSessionHasNoErrors();
    $test->post("/operations/project-plans/{$plan->id}/submit", ['version' => $plan->refresh()->version])->assertSessionHasNoErrors();
    $test->actingAs($test->approver)->post("/operations/project-plans/{$plan->id}/decision", ['version' => $plan->refresh()->version, 'decision' => 'approved', 'reason' => 'Independent review'])->assertSessionHasNoErrors();
    $worker = User::factory()->create();
    $worker->assignRole(RoleName::CraneOperator->value);
    $worker->personnelCredentials()->create(['kind' => 'operator_certification', 'credential_number' => 'OP-PLAN', 'credential_type' => 'TESDA', 'status' => 'active', 'issued_at' => now()->subYear(), 'expires_at' => now()->addYear()]);
    $shift = $phase->shifts()->sole();
    $test->actingAs($test->manager)->post("/operations/project-plans/{$plan->id}/shifts/{$shift->id}/roster", ['version' => $plan->refresh()->version, 'shift_version' => $shift->version, 'personnel' => [['user_id' => $worker->id, 'assignment_type' => 'crane_operator']], 'reason' => 'Weekly coverage'])->assertSessionHasNoErrors();

    return $shift->refresh();
}

it('allows maintenance inside its phase reservation but rejects other phase commitments', function () {
    $shift = planningPreparedShift($this);
    $phase = $shift->phase;
    $plan = $phase->plan;
    $payload = ['version' => $plan->version, 'operational_asset_id' => $this->asset->id, 'kind' => 'maintenance', 'starts_at' => $this->start->copy()->addDays(2)->toIso8601String(), 'ends_at' => $this->start->copy()->addDays(3)->toIso8601String()];
    $this->post("/operations/project-plans/{$plan->id}/phases/{$phase->id}/allocations", $payload)->assertSessionHasNoErrors();
    $other = $plan->phases()->create(['name' => 'Other phase', 'kind' => 'operations', 'starts_at' => $phase->starts_at, 'ends_at' => $phase->ends_at, 'coverage' => $phase->coverage]);
    $payload['version'] = $plan->refresh()->version;
    $this->post("/operations/project-plans/{$plan->id}/phases/{$other->id}/allocations", $payload)->assertSessionHasErrors('allocation');
    expect($other->allocations()->count())->toBe(0);
});

it('enforces the confirmation lock exactly 24 hours before a scheduled shift', function (int $minutesBeforeLock, bool $locked) {
    $shift = planningPreparedShift($this);
    $plan = $shift->phase->plan;
    $this->travelTo($shift->job->scheduled_start->copy()->subDay()->subMinutes($minutesBeforeLock));

    $this->post("/operations/project-plans/{$plan->id}/shifts/{$shift->id}/roster", [
        'version' => $plan->version, 'shift_version' => $shift->version,
        'personnel' => [], 'reason' => 'Review operator vacancy',
    ])->assertSessionHasNoErrors();

    expect($shift->refresh()->pending_roster)->toBe($locked ? [] : null)
        ->and($shift->job->personnelAssignments()->whereNull('active_until')->count())->toBe($locked ? 1 : 0);
})->with([[1, false], [0, true]]);

it('links planned dispatch detail back to coverage and disables generic assignment controls', function () {
    $shift = planningPreparedShift($this);
    $this->get('/operations/dispatch-jobs/'.$shift->dispatch_job_id)->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('project_context.name', $shift->phase->plan->name)
            ->where('project_context.phase', $shift->phase->name)
            ->where('capabilities.assign_resources', false)
            ->where('capabilities.reassign_resources', false));
});

it('rechecks maintenance conflicts at baseline approval', function () {
    $shift = planningPreparedShift($this);
    $phase = $shift->phase;
    $plan = $phase->plan;
    $other = $plan->phases()->create(['name' => 'Other phase', 'kind' => 'operations', 'starts_at' => $phase->starts_at, 'ends_at' => $phase->ends_at, 'coverage' => $phase->coverage]);
    $other->allocations()->create(['operational_asset_id' => $this->asset->id, 'kind' => 'maintenance', 'starts_at' => $phase->starts_at, 'ends_at' => $phase->ends_at]);
    $this->post("/operations/project-plans/{$plan->id}/submit", ['version' => $plan->version])->assertSessionHasNoErrors();
    $this->actingAs($this->approver)->post("/operations/project-plans/{$plan->id}/decision", ['version' => $plan->refresh()->version, 'decision' => 'approved', 'reason' => 'Review'])->assertSessionHasErrors('plan');
});

it('allows incomplete crews before activation but never applies them to an active shift', function () {
    $shift = planningPreparedShift($this);
    $plan = $shift->phase->plan;
    $url = "/operations/project-plans/{$plan->id}/shifts/{$shift->id}/roster";
    $this->post($url, ['version' => $plan->version, 'shift_version' => $shift->version, 'personnel' => [], 'reason' => 'Pending staffing'])->assertSessionHasNoErrors();
    $shift->job->update(['status' => DispatchStatus::Working]);
    $this->post($url, ['version' => $plan->refresh()->version, 'shift_version' => $shift->refresh()->version, 'personnel' => [], 'reason' => 'Remove all workers'])->assertSessionHasErrors('personnel');
    $shift->update(['pending_roster' => [], 'requested_by' => $this->manager->id]);
    $this->actingAs($this->approver)->post("/operations/project-plans/{$plan->id}/shifts/{$shift->id}/decision", ['version' => $plan->refresh()->version, 'shift_version' => $shift->version, 'decision' => 'approved', 'reason' => 'Review'])->assertSessionHasErrors('personnel');
    expect($shift->refresh()->pending_roster)->toBe([]);
});

it('shows archived shift history without breaking planning or allocation previews', function () {
    $shift = planningPreparedShift($this);
    $shift->job->update(['status' => DispatchStatus::Cancelled]);
    $shift->job->delete();
    $projection = app(ProjectPlanningQuery::class)->make($this->manager);
    expect($projection['projects'][0]['phases'][0]['shifts'][0]['archived'])->toBeTrue();
    $phase = $shift->phase;
    $allocation = $phase->allocations()->sole();
    $this->get('/operations/project-plans/'.$phase->project_plan_id.'/phases/'.$phase->id.'/allocation-preview/'.$allocation->id.'?'.http_build_query(['version' => $phase->plan->version, 'operational_asset_id' => $this->asset->id, 'kind' => 'reservation', 'starts_at' => $phase->starts_at->toIso8601String(), 'ends_at' => $phase->ends_at->toIso8601String()]))->assertOk();
});

it('returns proposed crew names for independent exception review', function () {
    $shift = planningPreparedShift($this);
    $worker = User::factory()->create(['name' => 'Proposed worker']);
    $shift->update(['pending_roster' => [['user_id' => $worker->id, 'assignment_type' => 'crane_operator']], 'requested_by' => $this->manager->id]);
    $projection = app(ProjectPlanningQuery::class)->make($this->approver);
    expect($projection['projects'][0]['phases'][0]['shifts'][0]['pending_roster'][0]['name'])->toBe('Proposed worker');
});

it('enforces project baseline approval for reopened canonical attempts', function () {
    $shift = planningPreparedShift($this);
    $commands = app(DispatchV2CommandService::class);
    $attempt = $shift->job->attempts()->sole();
    $attempt = $commands->cancel($this->manager, $attempt, DispatchV2Mutation::forVersion($attempt->version, reason: 'Cancelled shift'));
    $replacement = $commands->reopen($this->manager, $attempt, DispatchV2Mutation::forVersion($attempt->version, reason: 'Replacement shift'));
    $shift->phase->plan->update(['status' => 'draft', 'approved_version' => null]);
    expect(fn () => $commands->dispatch($this->manager, $replacement, DispatchV2Mutation::forVersion($replacement->version)))
        ->toThrow(ValidationException::class, 'The project baseline needs independent approval.');
});

it('rejects a canonical schedule that differs from the confirmed project shift', function () {
    $shift = planningPreparedShift($this);
    $attempt = $shift->job->attempts()->sole();
    $commands = app(DispatchV2CommandService::class);
    $commands->submitPlan($this->manager, $attempt, DispatchV2Mutation::forVersion($attempt->version, reason: 'Different time', payload: ['snapshot' => ['scheduled_start' => $this->start->copy()->addMonths(4)->toIso8601String(), 'scheduled_end' => $this->start->copy()->addMonths(4)->addHours(8)->toIso8601String()]]));
    expect(fn () => $commands->dispatch($this->manager, $attempt->refresh(), DispatchV2Mutation::forVersion($attempt->version)))
        ->toThrow(ValidationException::class, 'The execution schedule differs from the confirmed project shift.');
});

it('keeps active crew replacements pending until an independent complete-coverage decision', function () {
    $shift = planningPreparedShift($this);
    $job = $shift->job;
    $job->update(['status' => DispatchStatus::Working]);
    $original = $job->personnelAssignments()->whereNull('active_until')->sole();
    $replacement = User::factory()->create();
    $replacement->assignRole(RoleName::CraneOperator->value);
    $replacement->personnelCredentials()->create(['kind' => 'operator_certification', 'credential_number' => 'OP-REPLACE', 'credential_type' => 'TESDA', 'status' => 'active', 'expires_at' => now()->addYear()]);
    $plan = $shift->phase->plan;
    $this->post("/operations/project-plans/{$plan->id}/shifts/{$shift->id}/roster", ['version' => $plan->version, 'shift_version' => $shift->version, 'personnel' => [['user_id' => $replacement->id, 'assignment_type' => 'crane_operator']], 'reason' => 'Operator relief'])->assertSessionHasNoErrors();
    expect($original->refresh()->active_until)->toBeNull();
    $decision = ['version' => $plan->refresh()->version, 'shift_version' => $shift->refresh()->version, 'decision' => 'approved', 'reason' => 'Qualified relief confirmed'];
    $this->post("/operations/project-plans/{$plan->id}/shifts/{$shift->id}/decision", $decision)->assertForbidden();
    $this->actingAs($this->approver)->post("/operations/project-plans/{$plan->id}/shifts/{$shift->id}/decision", $decision)->assertSessionHasNoErrors();
    expect($original->refresh()->active_until)->not->toBeNull()
        ->and($job->personnelAssignments()->whereNull('active_until')->sole()->user_id)->toBe($replacement->id)
        ->and($shift->refresh()->pending_roster)->toBeNull();
});

it('dispatches aligned canonical resources and rejects an unconfirmed canonical crew', function (bool $reopened) {
    $shift = planningPreparedShift($this);
    if ($reopened) {
        $job = $shift->job;
        $workerId = $job->personnelAssignments()->whereNull('active_until')->sole()->user_id;
        $this->post("/operations/dispatch-jobs/{$job->id}/cancel", ['version' => $job->version, 'reason' => 'Pause'])->assertSessionHasNoErrors();
        $this->post("/operations/dispatch-jobs/{$job->id}/reopen", ['version' => $job->refresh()->version, 'reason' => 'Resume'])->assertSessionHasNoErrors();
        $plan = $shift->refresh()->phase->plan;
        $this->post("/operations/project-plans/{$plan->id}/shifts/{$shift->id}/roster", ['version' => $plan->version, 'shift_version' => $shift->version, 'personnel' => [['user_id' => $workerId, 'assignment_type' => 'crane_operator']], 'reason' => 'Reconfirmed'])->assertSessionHasNoErrors();
    }
    $attempt = $shift->job->canonicalHandoff->attempts()->latest('attempt_number')->firstOrFail();
    $executionPlan = $attempt->planVersions()->sole();
    $executionPlan->update(['status' => 'approved']);
    $executionPlan->approvals()->create(['attempt_id' => $attempt->id, 'workspace_key' => 'operations', 'kind' => 'plan_approval', 'status' => 'approved', 'requested_by' => $this->manager->id, 'decided_by' => $this->approver->id, 'decided_at' => now()]);
    $workerId = $shift->job->personnelAssignments()->whereNull('active_until')->sole()->user_id;
    $offer = $attempt->offers()->create(['workspace_key' => 'operations', 'plan_version_id' => $executionPlan->id, 'user_id' => $workerId, 'assignment_type' => 'crane_operator', 'status' => 'accepted', 'accepted_at' => now(), 'is_mandatory' => true]);
    $executionPlan->requirementSlots()->create(['attempt_id' => $attempt->id, 'workspace_key' => 'operations', 'kind' => 'asset', 'slot_key' => 'crane', 'assignment_type' => 'crane', 'is_mandatory' => true, 'operational_asset_id' => $this->asset->id]);
    $attempt->update(['designated_lead_offer_id' => $offer->id]);
    $other = User::factory()->create();
    $offer->update(['user_id' => $other->id]);
    $commands = app(DispatchV2CommandService::class);
    expect(fn () => $commands->dispatch($this->manager, $attempt, DispatchV2Mutation::forVersion($attempt->version)))
        ->toThrow(ValidationException::class, 'The execution crew and assets must match the confirmed project shift.');
    $offer->update(['user_id' => $workerId]);
    expect($commands->dispatch($this->manager, $attempt, DispatchV2Mutation::forVersion($attempt->version))->status)->toBe(DispatchAttemptStatus::Dispatched);
})->with([false, true]);

it('checks maintenance against ordinary dispatch commitments at approval', function () {
    $shift = planningPreparedShift($this);
    $phase = $shift->phase;
    $plan = $phase->plan;
    $otherAsset = OperationalAsset::query()->create(['code' => 'MAINT-CR-2', 'name' => 'Maintenance crane', 'kind' => 'crane', 'status' => AssetStatus::UnderMaintenance]);
    $payload = ['version' => $plan->version, 'operational_asset_id' => $otherAsset->id, 'kind' => 'maintenance', 'starts_at' => $this->start->copy()->addDays(2)->toIso8601String(), 'ends_at' => $this->start->copy()->addDays(3)->toIso8601String()];
    $this->post("/operations/project-plans/{$plan->id}/phases/{$phase->id}/allocations", $payload)->assertSessionHasNoErrors();
    $otherJob = $shift->job->replicate(['reference']);
    $otherJob->fill(['reference' => 'OTHER-COMMITMENT', 'scheduled_start' => $payload['starts_at'], 'scheduled_end' => $payload['ends_at']])->save();
    $otherJob->assetAssignments()->create(['operational_asset_id' => $otherAsset->id, 'assignment_type' => 'crane', 'assigned_by' => $this->manager->id, 'active_from' => $payload['starts_at']]);
    $this->post("/operations/project-plans/{$plan->id}/submit", ['version' => $plan->refresh()->version])->assertSessionHasNoErrors();
    $this->actingAs($this->approver)->post("/operations/project-plans/{$plan->id}/decision", ['version' => $plan->refresh()->version, 'decision' => 'approved', 'reason' => 'Review new commitment'])->assertSessionHasErrors('plan');
});

it('cancels and reopens a staffed project shift using the reviewed legacy version', function () {
    $shift = planningPreparedShift($this);
    $job = $shift->job;
    $oldVersion = $job->version;
    $workerId = $job->personnelAssignments()->whereNull('active_until')->sole()->user_id;
    expect($job->attempts()->sole()->version)->not->toBe($oldVersion);
    $this->post("/operations/dispatch-jobs/{$job->id}/cancel", ['version' => $oldVersion - 1, 'reason' => 'Stale cancellation'])->assertSessionHasErrors('version');
    expect($job->refresh()->status)->toBe(DispatchStatus::Draft);
    $this->post("/operations/dispatch-jobs/{$job->id}/cancel", ['version' => $oldVersion, 'reason' => 'Site paused'])->assertRedirect()->assertSessionHasNoErrors();
    expect($job->refresh()->status)->toBe(DispatchStatus::Cancelled)
        ->and($job->version)->toBe($oldVersion + 1)
        ->and($job->personnelAssignments()->whereNull('active_until')->count())->toBe(0)
        ->and($shift->refresh()->confirmed_plan_version)->toBeNull();
    $this->post("/operations/dispatch-jobs/{$job->id}/reopen", ['version' => $oldVersion, 'reason' => 'Stale reopening'])->assertSessionHasErrors('version');
    $this->post("/operations/dispatch-jobs/{$job->id}/reopen", ['version' => $job->version, 'reason' => 'Site resumed'])->assertRedirect()->assertSessionHasNoErrors();
    expect($job->refresh()->status)->toBe(DispatchStatus::Draft)
        ->and($job->version)->toBe($oldVersion + 2)
        ->and($job->canonicalHandoff->attempts()->count())->toBe(2)
        ->and(app(ProjectShiftReadiness::class)->blockers($job))->toContain('Confirm crew coverage against the current approved baseline.');
    $this->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => $job->version])->assertSessionHasErrors('project_plan');
    $this->post("/operations/dispatch-jobs/{$job->id}/assignments", ['personnel' => [['user_id' => $workerId, 'assignment_type' => 'crane_operator']]])->assertSessionHasErrors('resources');
    $this->post("/operations/dispatch-jobs/{$job->id}/reassign", ['version' => $job->version, 'reason' => 'Bypass planning', 'personnel' => [['user_id' => $workerId, 'assignment_type' => 'crane_operator']]])->assertSessionHasErrors('resources');
    $plan = $shift->refresh()->phase->plan;
    $this->post("/operations/project-plans/{$plan->id}/shifts/{$shift->id}/roster", ['version' => $plan->version, 'shift_version' => $shift->version, 'personnel' => [['user_id' => $workerId, 'assignment_type' => 'crane_operator']], 'reason' => 'Reconfirmed resumed coverage'])->assertSessionHasNoErrors();
    expect(app(ProjectShiftReadiness::class)->blockers($job->refresh()))->toBe([]);
    $this->post("/operations/dispatch-jobs/{$job->id}/activate", ['version' => $job->version])->assertRedirect()->assertSessionHasNoErrors();
    expect($job->refresh()->status)->toBe(DispatchStatus::Dispatched);
});

it('rejects phase edits while a shift is active without invalidating its approved baseline', function () {
    $shift = planningPreparedShift($this);
    $shift->job->update(['status' => DispatchStatus::Dispatched]);
    $phase = $shift->phase;
    $plan = $phase->plan;
    $this->post("/operations/project-plans/{$plan->id}/phases/{$phase->id}", ['version' => $plan->version, 'name' => 'Changed active phase', 'kind' => $phase->kind, 'starts_at' => $phase->starts_at->toIso8601String(), 'ends_at' => $phase->ends_at->toIso8601String(), 'coverage' => $phase->coverage])->assertSessionHasErrors('phase');
    expect($plan->refresh()->status)->toBe('approved')->and($phase->refresh()->name)->toBe('Lifting operations');
});

it('bounds project phase count while still permitting edits to existing phases', function () {
    $plan = planningProject($this);
    $phase = $plan->phases()->sole();
    for ($index = 1; $index < 32; $index++) {
        $plan->phases()->create(['name' => 'Phase '.$index, 'kind' => $phase->kind, 'starts_at' => $phase->starts_at, 'ends_at' => $phase->ends_at, 'coverage' => $phase->coverage]);
    }
    $payload = ['version' => $plan->version, 'name' => 'Additional phase', 'kind' => $phase->kind, 'starts_at' => $phase->starts_at->toIso8601String(), 'ends_at' => $phase->ends_at->toIso8601String(), 'coverage' => $phase->coverage];
    $this->post("/operations/project-plans/{$plan->id}/phases", $payload)->assertSessionHasErrors('phase');
    expect($plan->phases()->count())->toBe(32);
    $this->post("/operations/project-plans/{$plan->id}/phases/{$phase->id}", $payload)->assertSessionHasNoErrors();
});

it('rejects shift generation beyond the per-project limit before creating dispatches', function () {
    $shift = planningPreparedShift($this);
    $phase = $shift->phase;
    $plan = $phase->plan;
    $attributes = $shift->job->getAttributes();
    unset($attributes['id']);
    foreach (array_chunk(range(1, 999), 100) as $chunk) {
        DispatchJob::query()->insert(array_map(fn ($index) => [...$attributes, 'reference' => 'LIMIT-SHIFT-'.$index], $chunk));
    }
    $jobIds = DispatchJob::query()->where('reference', 'like', 'LIMIT-SHIFT-%')->pluck('id')->all();
    foreach (array_chunk($jobIds, 100) as $chunk) {
        ProjectShift::query()->insert(array_map(fn ($jobId) => ['project_phase_id' => $phase->id, 'dispatch_job_id' => $jobId], $chunk));
    }
    $this->post("/operations/project-plans/{$plan->id}/phases/{$phase->id}/shifts", ['version' => $plan->version, 'starts_at' => $this->start->copy()->addDays(2)->toIso8601String(), 'ends_at' => $this->start->copy()->addDays(2)->addHours(8)->toIso8601String(), 'days' => 1])->assertSessionHasErrors('days');
    expect(ProjectShift::query()->count())->toBe(1000)->and(DispatchJob::query()->count())->toBe(1000);
});
