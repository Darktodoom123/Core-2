<?php

use App\Modules\Dispatch\Commands\DispatchV2Commands;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchPlanApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchPlanVersionStatus;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchAuditLineage;
use App\Modules\Dispatch\Models\DispatchEmergencyOverride;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchPlanApproval;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Modules\Dispatch\Queries\DispatchV2ReadinessQuery;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\Inspection;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    config(['dispatch.v2_commands_enabled' => true, 'dispatch.phase3_commands_enabled' => true]);
    $this->seed(RolePermissionSeeder::class);
});

function phase3User(RoleName $role, string $name): User
{
    /** @var User $user */
    $user = User::factory()->create(['name' => $name, 'is_active' => true]);
    $user->syncRoles([$role->value]);

    return $user;
}

/** @return array{attempt: DispatchExecutionAttempt, plan: DispatchPlanVersion, dispatcher: User, manager: User, worker: User} */
function phase3Aggregate(bool $approved = false): array
{
    $dispatcher = phase3User(RoleName::OperationsManager, 'Phase 3 Dispatcher');
    $manager = phase3User(RoleName::OperationsManager, 'Phase 3 Manager');
    $worker = phase3User(RoleName::CraneOperator, 'Phase 3 Worker');
    PersonnelCredential::query()->create([
        'user_id' => $worker->id,
        'kind' => 'driver_license',
        'credential_number' => 'P3-DL-'.$worker->id,
        'credential_type' => 'professional',
        'status' => 'active',
        'issued_at' => now()->subYear(),
        'expires_at' => now()->addYear(),
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'P3-'.uniqid(),
        'client' => 'Phase 3 Client',
        'title' => 'Phase 3 dispatch',
        'site' => 'Phase 3 site',
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'priority' => 'routine',
        'status' => 'draft',
        'version' => 1,
        'created_by' => $dispatcher->id,
    ]);
    $handoff = DispatchHandoff::query()->create([
        'workspace_key' => 'operations',
        'source_type' => 'legacy_dispatch_job',
        'source_id' => $job->id,
        'source_reference' => $job->reference,
        'legacy_dispatch_job_id' => $job->id,
        'created_by' => $dispatcher->id,
        'compatibility_state' => 'v2_command',
    ]);
    $attempt = DispatchExecutionAttempt::query()->create([
        'handoff_id' => $handoff->id,
        'workspace_key' => 'operations',
        'attempt_number' => 1,
        'status' => DispatchAttemptStatus::Draft,
        'scheduled_start' => $job->scheduled_start,
        'scheduled_end' => $job->scheduled_end,
        'version' => 1,
        'created_by' => $dispatcher->id,
    ]);
    $plan = DispatchPlanVersion::query()->create([
        'attempt_id' => $attempt->id,
        'workspace_key' => 'operations',
        'version' => 1,
        'status' => $approved ? DispatchPlanVersionStatus::Approved : DispatchPlanVersionStatus::Draft,
        'snapshot' => ['mandatory_assignments' => [['slot' => 'driver', 'assignment_type' => 'driver']]],
        'content_hash' => hash('sha256', 'phase3-'.$attempt->id),
        'scheduled_start' => $job->scheduled_start,
        'scheduled_end' => $job->scheduled_end,
        'created_by' => $dispatcher->id,
        'submitted_by' => $dispatcher->id,
        'submitted_at' => now(),
        'sealed_at' => now(),
    ]);
    if ($approved) {
        DispatchPlanApproval::query()->create([
            'plan_version_id' => $plan->id,
            'kind' => 'plan_approval',
            'status' => $approved ? DispatchPlanApprovalStatus::Approved : DispatchPlanApprovalStatus::Pending,
            'requested_by' => $dispatcher->id,
            'request_reason' => 'Phase 3 plan request',
            'decided_by' => $approved ? $manager->id : null,
            'reason' => $approved ? 'Phase 3 plan decision' : null,
            'decided_at' => now(),
        ]);
    }

    return compact('attempt', 'plan', 'dispatcher', 'manager', 'worker');
}

function phase3Mutation(int $version, ?string $key = null, ?string $reason = null, array $payload = []): DispatchV2Mutation
{
    return new DispatchV2Mutation($version, $key, 'operations', $reason, $payload);
}

it('enforces the typed offer lifecycle, actor scope, expected version, replay ownership, and non-cancellation', function (): void {
    $aggregate = phase3Aggregate(true);
    $commands = app(DispatchV2Commands::class);

    $offer = $commands->proposeOffer($aggregate['dispatcher'], $aggregate['attempt'], phase3Mutation(1, 'offer-create', 'Need a driver', [
        'user_id' => $aggregate['worker']->id,
        'assignment_type' => 'driver',
        'is_mandatory' => true,
    ]));
    expect($offer->status)->toBe(DispatchAssignmentOfferStatus::Proposed);

    $offer = $commands->offer($aggregate['dispatcher'], $offer, phase3Mutation(2, 'offer-send', 'Offer sent'));
    expect($offer->status)->toBe(DispatchAssignmentOfferStatus::Offered);

    $otherWorker = phase3User(RoleName::CraneOperator, 'Other Worker');
    expect(fn (): DispatchAssignmentOffer => $commands->acceptOffer($otherWorker, $offer, phase3Mutation(3, 'offer-accept-wrong', 'Accept')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::Forbidden);

    $accepted = $commands->acceptOffer($aggregate['worker'], $offer, phase3Mutation(3, 'offer-accept', 'I accept'));
    $replay = $commands->acceptOffer($aggregate['worker'], $offer, phase3Mutation(3, 'offer-accept', 'I accept'));
    expect($accepted->status)->toBe(DispatchAssignmentOfferStatus::Accepted)
        ->and($replay->id)->toBe($accepted->id)
        ->and($aggregate['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::Draft);

    expect(fn (): DispatchAssignmentOffer => $commands->acceptOffer($aggregate['worker'], $offer, phase3Mutation(4, 'offer-accept', 'Different payload')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::IdempotencyPayloadMismatch);

    $ended = $commands->endOffer($aggregate['manager'], $accepted, phase3Mutation(4, 'offer-end', 'Assignment history closed'));
    expect($ended->status)->toBe(DispatchAssignmentOfferStatus::Ended)
        ->and($aggregate['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::Draft)
        ->and(AuditEvent::query()->where('action', 'dispatch.v2.assignment_offer.accepted')->exists())->toBeTrue()
        ->and(DispatchAuditLineage::query()->where('offer_id', $offer->id)->count())->toBeGreaterThanOrEqual(1);

    expect(fn (): DispatchAssignmentOffer => $commands->endOffer($aggregate['manager'], $accepted, phase3Mutation(4, 'offer-end-stale', 'Stale end attempt')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::StaleVersion);
});

it('requires an explicit accepted lead, serializes designation and replacement, and protects progression from non-leads', function (): void {
    $aggregate = phase3Aggregate(true);
    $commands = app(DispatchV2Commands::class);
    $leadOffer = DispatchAssignmentOffer::query()->create([
        'attempt_id' => $aggregate['attempt']->id,
        'plan_version_id' => $aggregate['plan']->id,
        'workspace_key' => 'operations',
        'user_id' => $aggregate['worker']->id,
        'assignment_type' => 'driver',
        'is_mandatory' => true,
        'status' => DispatchAssignmentOfferStatus::Accepted,
        'accepted_at' => now(),
        'created_by' => $aggregate['dispatcher']->id,
    ]);

    expect(fn (): DispatchExecutionAttempt => $commands->dispatch($aggregate['dispatcher'], $aggregate['attempt'], phase3Mutation(1)))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::NotReady);

    $designated = $commands->designateLead($aggregate['manager'], $aggregate['attempt'], phase3Mutation(1, 'lead-designate', 'Designating the qualified lead', [
        'offer_id' => $leadOffer->id,
    ]));
    expect($designated->designated_lead_offer_id)->toBe($leadOffer->id);

    $dispatched = $commands->dispatch($aggregate['dispatcher'], $aggregate['attempt'], phase3Mutation(2));
    expect($dispatched->status)->toBe(DispatchAttemptStatus::Dispatched);

    $nonLead = phase3User(RoleName::CraneOperator, 'Non Lead');
    expect(fn (): DispatchExecutionAttempt => $commands->progress($nonLead, $dispatched, DispatchAttemptStatus::EnRoute, phase3Mutation(3, null, 'I am not the lead')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::Forbidden);

    expect(fn (): DispatchExecutionAttempt => $commands->progress($aggregate['manager'], $dispatched, DispatchAttemptStatus::EnRoute, phase3Mutation(3, null, 'Missing explicit override')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::Forbidden);
    $overridden = $commands->progress($aggregate['manager'], $dispatched, DispatchAttemptStatus::EnRoute, phase3Mutation(3, null, 'Operational incident override', [
        'operational_override' => true,
    ]));
    expect($overridden->status)->toBe(DispatchAttemptStatus::EnRoute);
});

it('keeps optional declines non-blocking while reporting authoritative personnel and asset safety blockers', function (): void {
    $aggregate = phase3Aggregate(true);
    $worker = $aggregate['worker'];
    $worker->update(['suspended_at' => now()]);
    $mandatory = DispatchAssignmentOffer::query()->create([
        'attempt_id' => $aggregate['attempt']->id,
        'plan_version_id' => $aggregate['plan']->id,
        'workspace_key' => 'operations',
        'user_id' => $worker->id,
        'assignment_type' => 'driver',
        'is_mandatory' => true,
        'status' => DispatchAssignmentOfferStatus::Accepted,
        'accepted_at' => now(),
    ]);
    DispatchAssignmentOffer::query()->create([
        'attempt_id' => $aggregate['attempt']->id,
        'plan_version_id' => $aggregate['plan']->id,
        'workspace_key' => 'operations',
        'user_id' => phase3User(RoleName::CraneOperator, 'Optional Decline')->id,
        'assignment_type' => 'driver',
        'is_mandatory' => false,
        'status' => DispatchAssignmentOfferStatus::Rejected,
        'rejected_at' => now(),
    ]);
    $asset = OperationalAsset::query()->create(['code' => 'P3-UNSAFE', 'name' => 'Unsafe asset', 'kind' => 'truck', 'status' => AssetStatus::UnderMaintenance]);
    MaintenanceWorkOrder::query()->create(['operational_asset_id' => $asset->id, 'status' => 'open', 'defect' => 'Brake defect', 'dispatch_blocking' => true]);
    Inspection::query()->create(['operational_asset_id' => $asset->id, 'technician_id' => $aggregate['dispatcher']->id, 'type' => 'safety', 'result' => 'failed', 'checklist' => [], 'findings' => 'Brake failure']);
    $aggregate['plan']->update(['snapshot' => [
        'mandatory_assignments' => [['slot' => 'driver', 'assignment_type' => 'driver', 'user_id' => $worker->id]],
        'assets' => [['asset_id' => $asset->id, 'is_mandatory' => true]],
    ]]);

    $projection = app(DispatchV2ReadinessQuery::class)->handle($aggregate['dispatcher'], $aggregate['attempt']);
    $codes = collect($projection->blockers)->map(fn ($blocker): string => $blocker->code->value)->all();
    expect($codes)->toContain('personnel_suspended')->toContain('asset_unsafe')
        ->and($mandatory->fresh()->status)->toBe(DispatchAssignmentOfferStatus::Accepted)
        ->and($projection->ready)->toBeFalse();
});

it('does not let an optional unsafe asset block a dispatch with a valid designated lead', function (): void {
    $aggregate = phase3Aggregate(true);
    $commands = app(DispatchV2Commands::class);
    $leadOffer = DispatchAssignmentOffer::query()->create([
        'attempt_id' => $aggregate['attempt']->id,
        'plan_version_id' => $aggregate['plan']->id,
        'workspace_key' => 'operations',
        'user_id' => $aggregate['worker']->id,
        'assignment_type' => 'driver',
        'is_mandatory' => true,
        'status' => DispatchAssignmentOfferStatus::Accepted,
        'accepted_at' => now(),
    ]);
    $optionalAsset = OperationalAsset::query()->create([
        'code' => 'P3-OPTIONAL-UNSAFE',
        'name' => 'Optional unsafe asset',
        'kind' => 'truck',
        'status' => AssetStatus::UnderMaintenance,
    ]);
    $aggregate['plan']->update(['snapshot' => [
        'mandatory_assignments' => [['slot' => 'driver', 'assignment_type' => 'driver']],
        'assets' => [['asset_id' => $optionalAsset->id, 'is_mandatory' => false]],
    ]]);

    $commands->designateLead($aggregate['manager'], $aggregate['attempt'], phase3Mutation(1, 'optional-asset-lead', 'Designated lead', [
        'offer_id' => $leadOffer->id,
    ]));
    $dispatched = $commands->dispatch($aggregate['dispatcher'], $aggregate['attempt'], phase3Mutation(2, 'optional-asset-dispatch', 'Dispatch without optional asset'));

    expect($dispatched->status)->toBe(DispatchAttemptStatus::Dispatched);
});

it('uses maker-checker plan approval and supersedes prior material approval without losing reasons', function (): void {
    $aggregate = phase3Aggregate(false);
    $aggregate['dispatcher']->roles()->detach();
    $aggregate['dispatcher']->givePermissionTo([PermissionName::DispatchCreate->value, PermissionName::DispatchApproveChange->value]);
    $commands = app(DispatchV2Commands::class);
    $submitted = $commands->submitPlan($aggregate['dispatcher'], $aggregate['attempt'], phase3Mutation(1, null, 'Requester reason', [
        'snapshot' => ['mandatory_assignments' => [['slot' => 'driver', 'assignment_type' => 'driver']], 'assets' => []],
    ]));
    $pending = $submitted->approvals()->where('status', DispatchPlanApprovalStatus::Pending)->sole();
    expect($pending->request_reason)->toBe('Requester reason');
    expect(fn (): DispatchPlanApproval => $commands->approvePlan($aggregate['dispatcher'], $aggregate['attempt'], phase3Mutation(2, null, 'Self decision')))
        ->toThrow(DispatchV2CommandException::class);

    $approved = $commands->approvePlan($aggregate['manager'], $aggregate['attempt'], phase3Mutation(2, null, 'Checker decision'));
    expect($approved->status)->toBe(DispatchPlanApprovalStatus::Approved)
        ->and($approved->request_reason)->toBe('Requester reason')
        ->and($approved->reason)->toBe('Checker decision');

    $next = $commands->submitPlan($aggregate['dispatcher'], $aggregate['attempt'], phase3Mutation(3, null, 'Material revision', [
        'snapshot' => ['mandatory_assignments' => [['slot' => 'crane_operator', 'assignment_type' => 'crane_operator']], 'assets' => []],
    ]));
    expect($next->version)->toBe(2)
        ->and($aggregate['plan']->fresh()->status)->toBe(DispatchPlanVersionStatus::Superseded)
        ->and($approved->fresh()->status)->toBe(DispatchPlanApprovalStatus::Superseded);
});

it('requires scoped independent emergency approval, consumes it once, and cannot waive lead or asset safety', function (): void {
    $aggregate = phase3Aggregate(true);
    $commands = app(DispatchV2Commands::class);
    $override = $commands->proposeEmergencyOverride($aggregate['dispatcher'], $aggregate['attempt'], phase3Mutation(1, 'override-propose', 'Storm response', [
        'plan_version_id' => $aggregate['plan']->id,
        'blocker_codes' => ['pending_mandatory_acceptance'],
        'expires_at' => now()->addHour()->toIso8601String(),
    ]));
    expect($override->status->value)->toBe('proposed');
    expect(fn (): DispatchEmergencyOverride => $commands->approveEmergencyOverride($aggregate['dispatcher'], $override, phase3Mutation(1, 'override-approve-self', 'Self approval')))
        ->toThrow(DispatchV2CommandException::class);
    $approved = $commands->approveEmergencyOverride($aggregate['manager'], $override, phase3Mutation(2, 'override-approve', 'Checker approved storm scope'));
    expect($approved->status->value)->toBe('approved');

    expect(fn (): DispatchExecutionAttempt => $commands->dispatch($aggregate['dispatcher'], $aggregate['attempt'], phase3Mutation(3)))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::NotReady);
    expect($approved->fresh()->status->value)->toBe('approved');
});

it('consumes an approved emergency waiver only when it waives the matching soft blocker', function (): void {
    $aggregate = phase3Aggregate(true);
    $commands = app(DispatchV2Commands::class);
    $leadOffer = DispatchAssignmentOffer::query()->create([
        'attempt_id' => $aggregate['attempt']->id,
        'plan_version_id' => $aggregate['plan']->id,
        'workspace_key' => 'operations',
        'user_id' => $aggregate['worker']->id,
        'assignment_type' => 'driver',
        'is_mandatory' => true,
        'status' => DispatchAssignmentOfferStatus::Accepted,
        'accepted_at' => now(),
    ]);
    $unaccepted = phase3User(RoleName::CraneOperator, 'Pending Emergency Worker');
    $pendingOffer = DispatchAssignmentOffer::query()->create([
        'attempt_id' => $aggregate['attempt']->id,
        'plan_version_id' => $aggregate['plan']->id,
        'workspace_key' => 'operations',
        'user_id' => $unaccepted->id,
        'assignment_type' => 'crane_operator',
        'is_mandatory' => true,
        'status' => DispatchAssignmentOfferStatus::Offered,
        'offered_at' => now(),
    ]);
    $aggregate['plan']->update(['snapshot' => ['mandatory_assignments' => [
        ['slot' => 'driver', 'assignment_type' => 'driver'],
        ['slot' => 'crane_operator', 'assignment_type' => 'crane_operator'],
    ]]]);
    $designated = $commands->designateLead($aggregate['manager'], $aggregate['attempt'], phase3Mutation(1, 'consume-lead', 'Designated lead', ['offer_id' => $leadOffer->id]));
    $override = $commands->proposeEmergencyOverride($aggregate['dispatcher'], $designated, phase3Mutation(2, 'consume-propose', 'Critical staffing exception', [
        'plan_version_id' => $aggregate['plan']->id,
        'blocker_codes' => ['pending_mandatory_acceptance'],
        'expires_at' => now()->addHour()->toIso8601String(),
    ]));
    $approved = $commands->approveEmergencyOverride($aggregate['manager'], $override, phase3Mutation(3, 'consume-approve', 'Approved for this plan only'));
    $dispatched = $commands->dispatch($aggregate['dispatcher'], $aggregate['attempt'], phase3Mutation(4, 'consume-dispatch', 'Dispatch under approved scope'));

    expect($dispatched->status)->toBe(DispatchAttemptStatus::Dispatched)
        ->and($approved->fresh()->status->value)->toBe('consumed')
        ->and($pendingOffer->fresh()->status)->toBe(DispatchAssignmentOfferStatus::Offered);
});
