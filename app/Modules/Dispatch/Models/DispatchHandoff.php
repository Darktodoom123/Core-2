<?php

namespace App\Modules\Dispatch\Models;

use App\Modules\Dispatch\Enums\DispatchSourceType;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DispatchHandoff extends Model
{
    protected $fillable = [
        'workspace_key',
        'source_type',
        'source_id',
        'source_reference',
        'legacy_dispatch_job_id',
        'created_by',
        'compatibility_state',
        'legacy_snapshot',
    ];

    protected function casts(): array
    {
        return ['source_id' => 'integer', 'legacy_snapshot' => 'array'];
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
}
