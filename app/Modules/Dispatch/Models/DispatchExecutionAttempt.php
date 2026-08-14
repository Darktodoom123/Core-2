<?php

namespace App\Modules\Dispatch\Models;

use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DispatchExecutionAttempt extends Model
{
    protected $fillable = [
        'handoff_id', 'workspace_key', 'attempt_number', 'replaces_attempt_id', 'legacy_dispatch_job_id',
        'status', 'legacy_status', 'compatibility_state', 'scheduled_start', 'scheduled_end', 'version',
        'legacy_snapshot', 'created_by', 'activated_by', 'cancelled_by', 'cancellation_reason',
        'legacy_deleted_at', 'archived_at', 'archived_by', 'archive_reason', 'designated_lead_offer_id',
        'lead_designated_by', 'lead_designated_at', 'lead_designation_reason',
    ];

    protected function casts(): array
    {
        return [
            'status' => DispatchAttemptStatus::class,
            'attempt_number' => 'integer',
            'scheduled_start' => 'datetime',
            'scheduled_end' => 'datetime',
            'version' => 'integer',
            'legacy_snapshot' => 'array',
            'legacy_deleted_at' => 'datetime',
            'archived_at' => 'datetime',
            'lead_designated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<DispatchHandoff, $this> */
    public function handoff(): BelongsTo
    {
        return $this->belongsTo(DispatchHandoff::class, 'handoff_id');
    }

    /** @return BelongsTo<self, $this> */
    public function replacedAttempt(): BelongsTo
    {
        return $this->belongsTo(self::class, 'replaces_attempt_id');
    }

    /** @return HasMany<self, $this> */
    public function replacementAttempts(): HasMany
    {
        return $this->hasMany(self::class, 'replaces_attempt_id');
    }

    /** @return BelongsTo<DispatchJob, $this> */
    public function legacyDispatchJob(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'legacy_dispatch_job_id');
    }

    /** @return HasMany<DispatchPlanVersion, $this> */
    public function planVersions(): HasMany
    {
        return $this->hasMany(DispatchPlanVersion::class, 'attempt_id');
    }

    /** @return HasMany<DispatchAssignmentOffer, $this> */
    public function assignmentOffers(): HasMany
    {
        return $this->hasMany(DispatchAssignmentOffer::class, 'attempt_id');
    }

    /** @return BelongsTo<DispatchAssignmentOffer, $this> */
    public function designatedLeadOffer(): BelongsTo
    {
        return $this->belongsTo(DispatchAssignmentOffer::class, 'designated_lead_offer_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
