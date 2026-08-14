<?php

namespace App\Modules\Dispatch\Contracts;

use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchOutboxMessage;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Models\User;

interface DispatchOutboxRecorder
{
    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     */
    public function record(
        User $actor,
        DispatchExecutionAttempt $attempt,
        string $action,
        array $before,
        array $after,
        AuditEvent $audit,
        ?int $idempotencyKeyId = null,
    ): DispatchOutboxMessage;
}
