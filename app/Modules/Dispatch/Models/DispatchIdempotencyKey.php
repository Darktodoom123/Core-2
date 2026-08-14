<?php

namespace App\Modules\Dispatch\Models;

use App\Platform\Idempotency\Models\CommandLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DispatchIdempotencyKey extends Model
{
    protected $fillable = [
        'workspace_key', 'owner_type', 'owner_id', 'idempotency_key', 'action_name', 'payload_hash',
        'expected_version', 'status', 'response_code', 'response_payload', 'attempt_id', 'legacy_command_log_id',
        'claimed_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'owner_id' => 'integer',
            'expected_version' => 'integer',
            'response_code' => 'integer',
            'response_payload' => 'array',
            'claimed_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<DispatchExecutionAttempt, $this> */
    public function attempt(): BelongsTo
    {
        return $this->belongsTo(DispatchExecutionAttempt::class, 'attempt_id');
    }

    /** @return BelongsTo<CommandLog, $this> */
    public function legacyCommandLog(): BelongsTo
    {
        return $this->belongsTo(CommandLog::class, 'legacy_command_log_id');
    }
}
