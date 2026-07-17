<?php

namespace App\Actions;

use App\Models\AuditEvent;
use App\Models\User;
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
        return AuditEvent::query()->create([
            'actor_id' => $actor->id, 'subject_type' => $subject::class, 'subject_id' => $subject->getKey(),
            'action' => $action, 'before' => $before, 'after' => $after, 'reason' => $reason,
            'request_id' => request()->header('X-Request-ID', (string) Str::uuid()), 'ip_address' => request()->ip(), 'occurred_at' => now(),
        ]);
    }
}
