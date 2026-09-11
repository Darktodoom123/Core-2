<?php

namespace App\Platform\Audit\Contracts;

use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;

interface AuditEventRecorder
{
    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    public function handle(User $actor, Model $subject, string $action, ?array $before = null, ?array $after = null, ?string $reason = null): AuditEvent;
}
