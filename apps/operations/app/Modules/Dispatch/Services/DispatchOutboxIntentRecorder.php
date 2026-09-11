<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Contracts\DispatchOutboxRecorder;
use App\Modules\Dispatch\Jobs\DeliverDispatchOutboxMessage;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchOutboxMessage;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;

final class DispatchOutboxIntentRecorder implements DispatchOutboxRecorder
{
    public function record(
        User $actor,
        DispatchExecutionAttempt $attempt,
        string $action,
        array $before,
        array $after,
        AuditEvent $audit,
        ?int $idempotencyKeyId = null,
    ): DispatchOutboxMessage {
        $dedupeKey = $idempotencyKeyId !== null
            ? 'dispatch-idempotency-'.$idempotencyKeyId
            : 'dispatch-audit-'.$audit->id;

        $message = DispatchOutboxMessage::query()->firstOrCreate(
            ['dedupe_key' => $dedupeKey],
            [
                'workspace_key' => $attempt->workspace_key,
                'topic' => $action,
                'aggregate_type' => $attempt->getMorphClass(),
                'aggregate_id' => $attempt->id,
                'attempt_id' => $attempt->id,
                'audit_event_id' => $audit->id,
                'idempotency_key_id' => $idempotencyKeyId,
                'payload' => [
                    'attempt_id' => $attempt->id,
                    'handoff_id' => $attempt->handoff_id,
                    'action' => $action,
                    'actor_id' => $actor->id,
                    'before' => $before,
                    'after' => $after,
                    'audit_event_id' => $audit->id,
                ],
                'status' => 'pending',
                'available_at' => now(),
            ],
        );

        DB::afterCommit(function () use ($message): void {
            DeliverDispatchOutboxMessage::dispatch($message->id)->afterCommit();
        });

        return $message;
    }
}
