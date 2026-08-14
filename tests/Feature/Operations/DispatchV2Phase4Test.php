<?php

use App\Modules\Dispatch\Actions\CreateDispatchFromSource;
use App\Modules\Dispatch\Contracts\DispatchOutboxDeliveryHandler;
use App\Modules\Dispatch\Contracts\DispatchOutboxRecorder;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Jobs\DeliverDispatchOutboxMessage;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchAuditLineage;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchIdempotencyKey;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchOutboxMessage;
use App\Modules\Dispatch\Models\DispatchReconciliationFinding;
use App\Modules\Dispatch\Models\DispatchReconciliationRun;
use App\Modules\Dispatch\Services\DispatchOutboxDeliveryService;
use App\Modules\Dispatch\Services\DispatchV2CommandService;
use App\Modules\Rental\Enums\RentalReservationStatus;
use App\Modules\Rental\Models\RentalReservation;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    config(['dispatch.v2_commands_enabled' => true]);
});

function phase4User(RoleName $role, string $name = 'Phase 4 Actor'): User
{
    $user = User::factory()->create(['name' => $name, 'is_active' => true]);
    $user->syncRoles([$role->value]);

    return $user;
}

/** @return array{job: DispatchJob, handoff: DispatchHandoff, attempt: DispatchExecutionAttempt} */
function phase4Aggregate(User $actor): array
{
    $job = DispatchJob::query()->create([
        'reference' => 'P4-MANUAL-'.fake()->unique()->numerify('####'),
        'client' => 'Phase 4 Customer',
        'title' => 'Phase 4 dispatch',
        'site' => 'Phase 4 site',
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'priority' => 'routine',
        'status' => DispatchStatus::Draft,
        'created_by' => $actor->id,
        'version' => 1,
    ]);
    $handoff = DispatchHandoff::query()->create([
        'workspace_key' => 'operations',
        'source_system' => 'core2',
        'source_type' => 'manual',
        'source_id' => $job->id,
        'source_reference' => $job->reference,
        'external_reference' => $job->reference,
        'payload_hash' => hash('sha256', $job->reference),
        'legacy_dispatch_job_id' => $job->id,
        'created_by' => $actor->id,
        'compatibility_state' => 'v2_command',
        'received_at' => now(),
        'snapshot_at' => now(),
    ]);
    $attempt = DispatchExecutionAttempt::query()->create([
        'handoff_id' => $handoff->id,
        'workspace_key' => 'operations',
        'correlation_id' => fake()->uuid(),
        'attempt_number' => 1,
        'status' => DispatchAttemptStatus::Draft,
        'scheduled_start' => $job->scheduled_start,
        'scheduled_end' => $job->scheduled_end,
        'version' => 1,
        'created_by' => $actor->id,
    ]);

    return compact('job', 'handoff', 'attempt');
}

it('creates one canonical source handoff and replays exact source retries without duplicate side effects', function (): void {
    Queue::fake();
    $dispatcher = phase4User(RoleName::Dispatcher);
    $client = Client::query()->create(['code' => 'P4-CLIENT', 'company_name' => 'P4 Customer', 'status' => 'active']);
    $reservation = RentalReservation::query()->create([
        'reference' => 'P4-RENTAL-1',
        'client_id' => $client->id,
        'created_by' => $dispatcher->id,
        'status' => RentalReservationStatus::Reserved,
        'start_date' => now()->addDay()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'fulfillment_mode' => 'delivery',
        'delivery_location' => 'P4 yard',
    ]);
    $attributes = [
        'reference' => 'P4-DISPATCH-1',
        'client' => $client->company_name,
        'title' => 'P4 delivery',
        'site' => 'P4 yard',
        'scheduled_start' => now()->addDay()->startOfHour(),
        'scheduled_end' => now()->addDay()->addHours(2)->startOfHour(),
        'priority' => 'routine',
    ];

    $first = app(CreateDispatchFromSource::class)->handle($dispatcher, $reservation, DispatchSourceType::RentalReservation, $attributes);
    $second = app(CreateDispatchFromSource::class)->handle($dispatcher, $reservation, DispatchSourceType::RentalReservation, $attributes);
    $handoff = DispatchHandoff::query()->where('source_type', DispatchSourceType::RentalReservation->value)->sole();

    expect($second->id)->toBe($first->id)
        ->and(DispatchHandoff::query()->count())->toBe(1)
        ->and(DispatchExecutionAttempt::query()->where('handoff_id', $handoff->id)->count())->toBe(1)
        ->and($handoff->external_reference)->toBe($reservation->reference)
        ->and(strlen((string) $handoff->payload_hash))->toBe(64)
        ->and($handoff->inbound_owner_type)->toBe(DispatchSourceType::RentalReservation->value)
        ->and($handoff->inbound_owner_id)->toBe($reservation->id)
        ->and(DispatchIdempotencyKey::query()->count())->toBe(1)
        ->and($handoff->inbound_idempotency_key_id)->not->toBeNull()
        ->and(DispatchAuditLineage::query()->where('handoff_id', $handoff->id)->count())->toBe(1)
        ->and(DispatchOutboxMessage::query()->count())->toBe(1)
        ->and(AuditEvent::query()->where('action', 'dispatch.v2.attempt.created')->count())->toBe(1);
});

it('rejects source payload and owner reuse conflicts before creating writes', function (): void {
    Queue::fake();
    $dispatcher = phase4User(RoleName::Dispatcher);
    $other = phase4User(RoleName::Dispatcher, 'Other dispatcher');
    $aggregate = phase4Aggregate($dispatcher);
    $commands = app(DispatchV2CommandService::class);
    $payload = ['canonical_handoff' => ['source_type' => 'manual', 'source_id' => $aggregate['job']->id, 'external_reference' => $aggregate['job']->reference, 'allow_new_attempt' => true, 'replacement_policy' => 'source_replan', 'payload' => ['stable' => true]]];
    $mutation = DispatchV2Mutation::forOwner(1, 'p4-key', User::class, $dispatcher->id, payload: $payload);

    $created = $commands->create($dispatcher, $aggregate['job'], $mutation);
    $auditCount = AuditEvent::query()->count();
    $outboxCount = DispatchOutboxMessage::query()->count();

    $replay = $commands->create($dispatcher, $aggregate['job'], $mutation);
    expect($replay->id)->toBe($created->id);

    expect(fn () => $commands->create($dispatcher, $aggregate['job'], DispatchV2Mutation::forOwner(1, 'p4-key', User::class, $dispatcher->id, payload: ['changed' => true])))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::IdempotencyPayloadMismatch);
    expect(fn () => $commands->create($other, $aggregate['job'], DispatchV2Mutation::forOwner(1, 'p4-key', User::class, $other->id, payload: $payload)))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::IdempotencyConflict);
    expect(fn () => $commands->cancel($dispatcher, $aggregate['attempt'], new DispatchV2Mutation(1, 'p4-key', 'operations', 'Wrong action')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::IdempotencyConflict);

    expect(AuditEvent::query()->count())->toBe($auditCount)
        ->and(DispatchOutboxMessage::query()->count())->toBe($outboxCount)
        ->and(DispatchExecutionAttempt::query()->where('handoff_id', $aggregate['handoff']->id)->count())->toBe(2);
});

it('rolls back canonical state, audit, lineage, receipt, and outbox intent together', function (): void {
    Queue::fake();
    $dispatcher = phase4User(RoleName::Dispatcher);
    $aggregate = phase4Aggregate($dispatcher);
    $recorder = Mockery::mock(DispatchOutboxRecorder::class);
    $recorder->shouldReceive('record')->once()->andThrow(new RuntimeException('outbox persistence failure'));
    $this->app->instance(DispatchOutboxRecorder::class, $recorder);

    expect(fn () => app(DispatchV2CommandService::class)->cancel($dispatcher, $aggregate['attempt'], new DispatchV2Mutation(1, 'p4-rollback', 'operations', 'rollback')))
        ->toThrow(RuntimeException::class);

    expect($aggregate['attempt']->fresh()->status)->toBe(DispatchAttemptStatus::Draft)
        ->and($aggregate['attempt']->fresh()->version)->toBe(1)
        ->and(AuditEvent::query()->count())->toBe(0)
        ->and(DispatchAuditLineage::query()->count())->toBe(0)
        ->and(DispatchIdempotencyKey::query()->count())->toBe(0)
        ->and(DispatchOutboxMessage::query()->count())->toBe(0);
});

it('keeps replacement attempts monotonic and never reopens a completed predecessor', function (): void {
    Queue::fake();
    $dispatcher = phase4User(RoleName::Dispatcher);
    $manager = phase4User(RoleName::OperationsManager, 'P4 manager');
    $aggregate = phase4Aggregate($dispatcher);
    $commands = app(DispatchV2CommandService::class);

    $cancelled = $commands->cancel($dispatcher, $aggregate['attempt'], new DispatchV2Mutation(1, null, 'operations', 'weather'));
    $replacement = $commands->reopen($manager, $cancelled, new DispatchV2Mutation(2, null, 'operations', 'weather cleared', ['replacement_policy' => 'cancelled_replacement']));

    expect($replacement->attempt_number)->toBe(2)
        ->and($replacement->replaces_attempt_id)->toBe($cancelled->id)
        ->and($replacement->replacement_policy)->toBe('cancelled_replacement')
        ->and($replacement->replacement_reason)->toBe('weather cleared')
        ->and($cancelled->fresh()->status)->toBe(DispatchAttemptStatus::Cancelled);

    $replacement->update(['status' => DispatchAttemptStatus::Completed]);
    expect(fn () => $commands->reopen($manager, $replacement, new DispatchV2Mutation(1, null, 'operations', 'completed replacement')))
        ->toThrow(fn (DispatchV2CommandException $exception): bool => $exception->getErrorCode() === DispatchV2CommandCode::InvalidTransition);
});

it('defers durable outbox delivery until commit and retries a failed handler without duplicating delivery', function (): void {
    Queue::fake();
    $dispatcher = phase4User(RoleName::Dispatcher);
    $aggregate = phase4Aggregate($dispatcher);
    DB::beginTransaction();
    app(DispatchV2CommandService::class)->cancel($dispatcher, $aggregate['attempt'], new DispatchV2Mutation(1, 'p4-after-commit', 'operations', 'after commit'));
    Queue::assertNothingPushed();
    DB::commit();
    Queue::assertPushed(DeliverDispatchOutboxMessage::class, 1);

    $message = DispatchOutboxMessage::query()->sole();
    $handler = Mockery::mock(DispatchOutboxDeliveryHandler::class);
    $handlerCalls = 0;
    $handler->shouldReceive('handle')->twice()->andReturnUsing(function () use (&$handlerCalls): null {
        $handlerCalls++;
        if ($handlerCalls === 1) {
            throw new RuntimeException('temporary effect failure');
        }

        return null;
    });
    $this->app->instance(DispatchOutboxDeliveryHandler::class, $handler);
    expect(fn () => app(DispatchOutboxDeliveryService::class)->deliver($message->id))->toThrow(RuntimeException::class);
    $delivered = app(DispatchOutboxDeliveryService::class)->deliver($message->id);

    expect($delivered->status)->toBe('delivered')
        ->and($delivered->attempts)->toBe(2)
        ->and(DispatchOutboxMessage::query()->count())->toBe(1);
});

it('reconciles manual sources and reports canonical source payload drift idempotently', function (): void {
    Queue::fake();
    $dispatcher = phase4User(RoleName::Dispatcher);
    $client = Client::query()->create(['code' => 'P4-RECON', 'company_name' => 'P4 Recon Customer', 'status' => 'active']);
    $reservation = RentalReservation::query()->create([
        'reference' => 'P4-RECON-RENTAL',
        'client_id' => $client->id,
        'created_by' => $dispatcher->id,
        'status' => RentalReservationStatus::Reserved,
        'start_date' => now()->addDay()->toDateString(),
        'end_date' => now()->addDays(2)->toDateString(),
        'fulfillment_mode' => 'delivery',
        'delivery_location' => 'Original recon yard',
    ]);
    $manualJob = DispatchJob::query()->create([
        'reference' => 'P4-RECON-MANUAL',
        'client' => 'P4 Recon Customer',
        'title' => 'Manual recon dispatch',
        'site' => 'P4 recon site',
        'scheduled_start' => now()->addHour(),
        'scheduled_end' => now()->addHours(2),
        'priority' => 'routine',
        'status' => DispatchStatus::Draft,
        'created_by' => $dispatcher->id,
        'version' => 1,
    ]);

    app(CreateDispatchFromSource::class)->handle($dispatcher, $reservation, DispatchSourceType::RentalReservation, [
        'reference' => 'P4-RECON-DISPATCH',
        'client' => $client->company_name,
        'title' => 'Recon delivery',
        'site' => 'Original recon yard',
        'scheduled_start' => now()->addDay()->startOfHour(),
        'scheduled_end' => now()->addDay()->addHours(2)->startOfHour(),
        'priority' => 'routine',
    ]);
    $reservation->update(['delivery_location' => 'Changed recon yard']);

    $this->artisan('dispatch:reconcile', ['--limit' => 100])->assertExitCode(0);

    expect(DispatchHandoff::query()->where('source_type', DispatchSourceType::Manual->value)->where('source_id', $manualJob->id)->exists())->toBeTrue()
        ->and(DispatchReconciliationFinding::query()->where('code', 'source_hash_mismatch')->count())->toBe(1)
        ->and(DispatchJob::query()->whereKey($manualJob->id)->exists())->toBeTrue();

    $findingCount = DispatchReconciliationFinding::query()->count();
    $run = DispatchReconciliationRun::query()->latest('id')->firstOrFail();
    $this->artisan('dispatch:reconcile', ['--run' => $run->id, '--limit' => 100])->assertExitCode(0);

    expect(DispatchReconciliationFinding::query()->count())->toBe($findingCount);
});
