<?php

namespace App\Platform\Audit\Actions;

use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

final class RecordAuditEvent
{
    /**
     * @param  array<string, mixed>|null  $before
     * @param  array<string, mixed>|null  $after
     */
    public function handle(User $actor, Model $subject, string $action, ?array $before = null, ?array $after = null, ?string $reason = null): AuditEvent
    {
        $request = request();
        $requestId = $request->attributes->get('audit_request_id');

        if (! is_string($requestId) || ! Str::isUuid($requestId)) {
            $requestId = (string) Str::uuid();
            $request->attributes->set('audit_request_id', $requestId);
        }

        return AuditEvent::query()->create([
            'actor_id' => $actor->id, 'subject_type' => $subject->getMorphClass(), 'subject_id' => $subject->getKey(),
            'action' => $action, 'before' => $before, 'after' => $after, 'reason' => $reason,
            'request_id' => $requestId, 'ip_address' => $request->ip(), 'occurred_at' => now(),
        ]);
    }
}
