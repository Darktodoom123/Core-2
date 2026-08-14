<?php

namespace App\Modules\Dispatch\Models;

use App\Modules\Dispatch\Enums\DispatchPlanVersionStatus;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DispatchPlanVersion extends Model
{
    public const CREATED_AT = 'created_at';

    public const UPDATED_AT = null;

    protected $fillable = [
        'attempt_id', 'workspace_key', 'version', 'status', 'snapshot', 'content_hash',
        'scheduled_start', 'scheduled_end', 'created_by', 'submitted_by', 'submitted_at',
        'sealed_at', 'superseded_at', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'status' => DispatchPlanVersionStatus::class,
            'snapshot' => 'array',
            'scheduled_start' => 'datetime',
            'scheduled_end' => 'datetime',
            'submitted_at' => 'datetime',
            'sealed_at' => 'datetime',
            'superseded_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<DispatchExecutionAttempt, $this> */
    public function attempt(): BelongsTo
    {
        return $this->belongsTo(DispatchExecutionAttempt::class, 'attempt_id');
    }

    /** @return HasMany<DispatchPlanApproval, $this> */
    public function approvals(): HasMany
    {
        return $this->hasMany(DispatchPlanApproval::class, 'plan_version_id');
    }

    /** @return HasMany<DispatchAssignmentOffer, $this> */
    public function assignmentOffers(): HasMany
    {
        return $this->hasMany(DispatchAssignmentOffer::class, 'plan_version_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
