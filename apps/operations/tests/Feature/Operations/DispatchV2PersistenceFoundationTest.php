<?php

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchPlanVersionStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchReconciliationRunStatus;
use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchAuditLineage;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchIdempotencyKey;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchPlanApproval;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Modules\Dispatch\Models\DispatchReconciliationFinding;
use App\Modules\Dispatch\Models\DispatchReconciliationRun;
use App\Modules\Sales\Enums\SalesFulfillmentMode;
use App\Modules\Sales\Enums\SalesOrderStatus;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Idempotency\Models\CommandLog;
use App\Platform\Identity\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

it('adds the canonical foundation without removing legacy tables or target-forbidden lifecycle values', function (): void {
    foreach ([
        'dispatch_handoffs',
        'dispatch_execution_attempts',
        'dispatch_plan_versions',
        'dispatch_plan_approvals',
        'dispatch_assignment_offers',
        'dispatch_idempotency_keys',
        'dispatch_audit_lineage',
        'dispatch_reconciliation_runs',
        'dispatch_reconciliation_findings',
    ] as $table) {
        expect(Schema::hasTable($table))->toBeTrue("Missing {$table}.");
    }

    expect(Schema::hasColumn('dispatch_handoffs', 'workspace_key'))->toBeTrue()
        ->and(Schema::hasColumn('dispatch_handoffs', 'source_reference'))->toBeTrue()
        ->and(Schema::hasColumn('dispatch_execution_attempts', 'handoff_id'))->toBeTrue()
        ->and(Schema::hasColumn('dispatch_execution_attempts', 'replaces_attempt_id'))->toBeTrue()
        ->and(Schema::hasColumn('dispatch_execution_attempts', 'version'))->toBeTrue()
        ->and(Schema::hasColumn('dispatch_execution_attempts', 'designated_lead_offer_id'))->toBeTrue()
        ->and(Schema::hasColumn('dispatch_plan_versions', 'content_hash'))->toBeTrue()
        ->and(Schema::hasColumn('dispatch_assignment_offers', 'response_deadline'))->toBeTrue()
        ->and(Schema::hasColumn('dispatch_idempotency_keys', 'owner_type'))->toBeTrue()
        ->and(Schema::hasColumn('dispatch_audit_lineage', 'audit_event_id'))->toBeTrue();

    expect(DispatchAttemptStatus::cases())->not->toContain(DispatchAttemptStatus::tryFrom('accepted'))
        ->and(DispatchPlanVersionStatus::cases())->not->toContain(DispatchPlanVersionStatus::tryFrom('on_hold'))
        ->and(DispatchAssignmentOfferStatus::Accepted->value)->toBe('accepted');

    expect(Schema::hasTable('dispatch_jobs'))->toBeTrue()
        ->and(Schema::hasTable('command_logs'))->toBeTrue();
});

it('enforces canonical ownership, attempt cardinality, and protected legacy lineage', function (): void {
    $actor = User::factory()->create();
    $job = DispatchJob::query()->create([
        'reference' => 'V2-CONSTRAINT-1',
        'client' => 'Constraint Customer',
        'title' => 'Constraint dispatch',
        'site' => 'Constraint site',
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $actor->id,
    ]);
    $handoff = DispatchHandoff::query()->create([
        'source_type' => 'legacy_dispatch_job',
        'source_id' => $job->id,
        'source_reference' => 'V2-CONSTRAINT-1',
        'legacy_dispatch_job_id' => $job->id,
        'created_by' => $actor->id,
        'compatibility_state' => 'legacy_only',
    ]);
    $attempt = DispatchExecutionAttempt::query()->create([
        'handoff_id' => $handoff->id,
        'attempt_number' => 1,
        'status' => DispatchAttemptStatus::Draft,
        'version' => 1,
        'created_by' => $actor->id,
    ]);

    expect(fn (): DispatchExecutionAttempt => DispatchExecutionAttempt::query()->create([
        'handoff_id' => $handoff->id,
        'attempt_number' => 1,
        'status' => DispatchAttemptStatus::Draft,
        'version' => 1,
        'created_by' => $actor->id,
    ]))->toThrow(QueryException::class);

    $key = DispatchIdempotencyKey::query()->create([
        'owner_type' => User::class,
        'owner_id' => $actor->id,
        'idempotency_key' => 'constraint-key',
        'action_name' => 'dispatch.test',
        'attempt_id' => $attempt->id,
    ]);

    expect(fn (): DispatchIdempotencyKey => DispatchIdempotencyKey::query()->create([
        'owner_type' => User::class,
        'owner_id' => $actor->id,
        'idempotency_key' => $key->idempotency_key,
        'action_name' => 'dispatch.test',
        'attempt_id' => $attempt->id,
    ]))->toThrow(QueryException::class);

    expect(fn (): bool => (bool) $handoff->delete())
        ->toThrow(QueryException::class);
});

it('reconciles a long Sales reference and preserves source, plan, offer, approval, idempotency, and audit lineage', function (): void {
    $actor = User::factory()->create();
    $client = Client::query()->create([
        'code' => 'CLI-V2-FOUNDATION',
        'company_name' => 'V2 Foundation Customer',
        'status' => 'active',
    ]);
    $reference = str_repeat('S', 64);
    $order = SalesOrder::query()->create([
        'reference' => $reference,
        'client_id' => $client->id,
        'created_by' => $actor->id,
        'status' => SalesOrderStatus::Confirmed,
        'fulfillment_mode' => SalesFulfillmentMode::Delivery,
        'currency' => 'PHP',
        'total_cents' => 100,
    ]);
    $job = DispatchJob::query()->create([
        'reference' => 'V2-FOUNDATION-1',
        'client' => $client->company_name,
        'title' => 'Foundation dispatch',
        'site' => 'Foundation site',
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $actor->id,
        'source_type' => DispatchSourceType::SalesOrder,
        'source_id' => $order->id,
        'source_reference' => substr($reference, 0, 48),
    ]);
    $order->update(['dispatch_job_id' => $job->id]);
    $assignment = DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $actor->id,
        'assignment_type' => 'driver',
        'response_status' => AssignmentResponse::Accepted,
        'responded_at' => now(),
        'assigned_by' => $actor->id,
        'active_from' => now(),
    ]);
    $approval = ApprovalRequest::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'kind' => 'dispatch_activation',
        'status' => ApprovalStatus::Approved,
        'requested_by' => $actor->id,
        'decided_by' => $actor->id,
        'reason' => 'Fixture approval',
        'decided_at' => now(),
    ]);
    $secondApproval = ApprovalRequest::query()->create([
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'kind' => 'dispatch_activation',
        'status' => ApprovalStatus::Approved,
        'requested_by' => $actor->id,
        'decided_by' => $actor->id,
        'reason' => 'Replacement approval history',
        'decided_at' => now(),
    ]);
    $audit = AuditEvent::query()->create([
        'actor_id' => $actor->id,
        'subject_type' => $job->getMorphClass(),
        'subject_id' => $job->id,
        'action' => 'dispatch.created',
        'before' => null,
        'after' => ['job_id' => $job->id],
        'request_id' => Str::uuid(),
        'occurred_at' => now(),
    ]);
    $command = CommandLog::query()->create([
        'user_id' => $actor->id,
        'command_id' => Str::uuid(),
        'action_name' => 'dispatch.create',
        'payload_hash' => hash('sha256', 'foundation'),
        'expected_version' => 1,
        'status' => 'completed',
        'response_code' => 200,
        'response_payload' => ['dispatch_job_id' => $job->id],
    ]);

    $this->artisan('dispatch:reconcile', ['--limit' => 100])->assertExitCode(0);

    $handoff = DispatchHandoff::query()->where('legacy_dispatch_job_id', $job->id)->sole();
    $attempt = DispatchExecutionAttempt::query()->where('handoff_id', $handoff->id)->sole();
    $plan = DispatchPlanVersion::query()->where('attempt_id', $attempt->id)->sole();
    $offer = DispatchAssignmentOffer::query()->where('legacy_assignment_id', $assignment->id)->sole();

    expect($handoff->source_reference)->toBe($reference)
        ->and($handoff->workspace_key)->toBe('operations')
        ->and($attempt->status)->toBe(DispatchAttemptStatus::Draft)
        ->and($attempt->version)->toBe(1)
        ->and($attempt->designated_lead_offer_id)->toBeNull()
        ->and($plan->status)->toBe(DispatchPlanVersionStatus::Approved)
        ->and(strlen($plan->content_hash))->toBe(64)
        ->and($offer->status)->toBe(DispatchAssignmentOfferStatus::Accepted)
        ->and($offer->is_mandatory)->toBeFalse()
        ->and(DispatchPlanApproval::query()->where('approval_request_id', $approval->id)->count())->toBe(1)
        ->and(DispatchPlanApproval::query()->where('approval_request_id', $secondApproval->id)->count())->toBe(1)
        ->and(DispatchPlanApproval::query()->where('plan_version_id', $plan->id)->count())->toBe(2)
        ->and(DispatchIdempotencyKey::query()->where('legacy_command_log_id', $command->id)->count())->toBe(1)
        ->and(DispatchAuditLineage::query()->where('audit_event_id', $audit->id)->count())->toBe(1)
        ->and(DispatchReconciliationFinding::query()->where('severity', 'blocker')->where('code', 'terminal_delivery_violation')->count())->toBe(1);
});

it('resumes a bounded reconciliation run idempotently and does not write during dry-run', function (): void {
    $actor = User::factory()->create();

    foreach (['V2-RESUME-1', 'V2-RESUME-2'] as $reference) {
        DispatchJob::query()->create([
            'reference' => $reference,
            'client' => 'Resume Customer',
            'title' => $reference,
            'site' => 'Resume site',
            'scheduled_start' => now()->addHour(),
            'scheduled_end' => now()->addHours(2),
            'priority' => DispatchPriority::Routine,
            'status' => DispatchStatus::Draft,
            'created_by' => $actor->id,
        ]);
    }

    $this->artisan('dispatch:reconcile', ['--limit' => 1, '--dry-run' => true])->assertExitCode(0);
    expect(DispatchHandoff::query()->count())->toBe(0);

    $this->artisan('dispatch:reconcile', ['--limit' => 1])->assertExitCode(0);
    $run = DispatchReconciliationRun::query()->where('dry_run', false)->latest('id')->firstOrFail();
    expect(DispatchHandoff::query()->count())->toBe(1);

    $this->artisan('dispatch:reconcile', ['--limit' => 10, '--run' => $run->id])->assertExitCode(0);
    expect(DispatchHandoff::query()->count())->toBe(2)
        ->and(DispatchExecutionAttempt::query()->count())->toBe(2)
        ->and(DispatchPlanVersion::query()->count())->toBe(2)
        ->and($run->refresh()->status)->toBe(DispatchReconciliationRunStatus::Completed);

    $this->artisan('dispatch:reconcile', ['--limit' => 10, '--run' => $run->id])->assertExitCode(0);
    expect(DispatchHandoff::query()->count())->toBe(2);
});

it('creates explicit findings and a compatibility handoff for an invalid legacy row', function (): void {
    $actor = User::factory()->create();
    $job = DispatchJob::query()->create([
        'reference' => 'V2-INVALID-1',
        'client' => 'Invalid Customer',
        'title' => 'Invalid source',
        'site' => 'Invalid site',
        'scheduled_start' => now()->addHours(2),
        'scheduled_end' => now()->addHour(),
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Draft,
        'created_by' => $actor->id,
        'source_type' => 'unknown_source',
        'source_id' => 999999,
    ]);
    DB::table('dispatch_jobs')->where('id', $job->id)->update(['status' => 'unknown_legacy_status']);

    $this->artisan('dispatch:reconcile', ['--limit' => 100])->assertExitCode(0);

    $handoff = DispatchHandoff::query()->where('legacy_dispatch_job_id', $job->id)->sole();
    $attempt = DispatchExecutionAttempt::query()->where('handoff_id', $handoff->id)->sole();

    expect($handoff->source_type)->toBe('legacy_dispatch_job')
        ->and($attempt->status)->toBe(DispatchAttemptStatus::Draft)
        ->and($attempt->scheduled_start)->toBeNull()
        ->and($attempt->scheduled_end)->toBeNull()
        ->and(DispatchReconciliationFinding::query()->where('entity_id', $job->id)->whereIn('code', [
            'invalid_source_link',
            'invalid_schedule_interval',
            'invalid_legacy_status',
        ])->count())->toBe(3);
});
