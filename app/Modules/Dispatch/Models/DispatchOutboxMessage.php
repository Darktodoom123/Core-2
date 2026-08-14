<?php

namespace App\Modules\Dispatch\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $dedupe_key
 * @property string $status
 * @property array<string, mixed> $payload
 * @property int $attempts
 * @property Carbon|null $available_at
 * @property Carbon|null $delivered_at
 */
class DispatchOutboxMessage extends Model
{
    protected $fillable = [
        'workspace_key', 'dedupe_key', 'topic', 'aggregate_type', 'aggregate_id', 'attempt_id', 'audit_event_id',
        'idempotency_key_id', 'payload', 'status', 'attempts', 'available_at', 'delivered_at', 'last_error',
    ];

    protected function casts(): array
    {
        return [
            'aggregate_id' => 'integer',
            'attempt_id' => 'integer',
            'audit_event_id' => 'integer',
            'idempotency_key_id' => 'integer',
            'payload' => 'array',
            'attempts' => 'integer',
            'available_at' => 'datetime',
            'delivered_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<DispatchExecutionAttempt, $this> */
    public function attempt(): BelongsTo
    {
        return $this->belongsTo(DispatchExecutionAttempt::class, 'attempt_id');
    }

    /** @return BelongsTo<DispatchIdempotencyKey, $this> */
    public function idempotencyKey(): BelongsTo
    {
        return $this->belongsTo(DispatchIdempotencyKey::class, 'idempotency_key_id');
    }
}
