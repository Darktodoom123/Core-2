<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use Illuminate\Validation\ValidationException;

final class DispatchDeliveryAttemptGuard
{
    public function requireCompleted(
        DispatchSourceType $sourceType,
        int $sourceId,
        ?int $legacyDispatchJobId,
        string $field = 'status',
        string $message = 'A completed canonical dispatch is required before delivery fulfillment.',
    ): DispatchExecutionAttempt {
        $handoff = $legacyDispatchJobId === null
            ? null
            : DispatchHandoff::query()
                ->where('workspace_key', 'operations')
                ->where('legacy_dispatch_job_id', $legacyDispatchJobId)
                ->lockForUpdate()
                ->first();

        if ($handoff === null
            || $handoff->source_type !== $sourceType->value
            || (int) $handoff->source_id !== $sourceId
            || $handoff->workspace_key !== 'operations') {
            throw ValidationException::withMessages([$field => $message]);
        }

        $attempt = DispatchExecutionAttempt::query()
            ->where('handoff_id', $handoff->id)
            ->where('workspace_key', $handoff->workspace_key)
            ->where('status', DispatchAttemptStatus::Completed)
            ->whereNull('archived_at')
            ->orderByDesc('attempt_number')
            ->lockForUpdate()
            ->first();

        if (! $attempt instanceof DispatchExecutionAttempt) {
            throw ValidationException::withMessages([$field => $message]);
        }

        return $attempt->setRelation('handoff', $handoff);
    }
}
