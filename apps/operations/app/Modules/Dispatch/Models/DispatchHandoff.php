<?php

namespace App\Modules\Dispatch\Models;

use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $workspace_key
 * @property string $source_system
 * @property string $source_type
 * @property int $source_id
 * @property string $external_reference
 * @property string|null $payload_hash
 * @property string|null $inbound_owner_type
 * @property int|null $inbound_owner_id
 * @property string|null $inbound_idempotency_key
 * @property string $compatibility_state
 */
class DispatchHandoff extends Model
{
    protected $fillable = [
        'workspace_key', 'source_system', 'source_type', 'source_id', 'source_reference', 'external_reference',
        'payload_hash', 'inbound_owner_type', 'inbound_owner_id', 'inbound_idempotency_key',
        'inbound_idempotency_key_id', 'received_at', 'snapshot_at', 'legacy_dispatch_job_id', 'created_by',
        'compatibility_state', 'legacy_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'source_id' => 'integer',
            'inbound_owner_id' => 'integer',
            'legacy_snapshot' => 'array',
            'received_at' => 'datetime',
            'snapshot_at' => 'datetime',
        ];
    }

    public function sourceType(): ?DispatchSourceType
    {
        return DispatchSourceType::tryFrom((string) $this->source_type);
    }

    /** @return HasMany<DispatchExecutionAttempt, $this> */
    public function attempts(): HasMany
    {
        return $this->hasMany(DispatchExecutionAttempt::class, 'handoff_id');
    }

    /** @return BelongsTo<DispatchJob, $this> */
    public function legacyDispatchJob(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'legacy_dispatch_job_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<DispatchIdempotencyKey, $this> */
    public function inboundIdempotencyKey(): BelongsTo
    {
        return $this->belongsTo(DispatchIdempotencyKey::class, 'inbound_idempotency_key_id');
    }
}
