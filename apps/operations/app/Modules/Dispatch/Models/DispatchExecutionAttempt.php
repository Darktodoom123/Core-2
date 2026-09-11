<?php

namespace App\Modules\Dispatch\Models;

use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $handoff_id
 * @property string $workspace_key
 * @property string|null $correlation_id
 * @property int $attempt_number
 * @property int|null $replaces_attempt_id
 * @property string|null $replacement_policy
 * @property string|null $replacement_reason
 * @property DispatchAttemptStatus $status
 * @property string|null $legacy_status
 * @property string|null $compatibility_state
 * @property Carbon|null $scheduled_start
 * @property Carbon|null $scheduled_end
 * @property int $version
 * @property array<string, mixed>|null $legacy_snapshot
 * @property Carbon|null $legacy_deleted_at
 * @property Carbon|null $archived_at
 * @property int|null $archived_by
 * @property string|null $archive_reason
 * @property int|null $legacy_dispatch_job_id
 * @property int|null $created_by
 * @property int|null $activated_by
 * @property int|null $cancelled_by
 * @property string|null $cancellation_reason
 * @property int|null $designated_lead_offer_id
 * @property int|null $lead_designated_by
 * @property Carbon|null $lead_designated_at
 * @property string|null $lead_designation_reason
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property DispatchHandoff $handoff
 */
class DispatchExecutionAttempt extends Model
{
    /** The active command envelope's idempotency claim; never persisted as an Eloquent attribute. */
    public ?int $v2IdempotencyKeyId = null;

    protected $fillable = [
        'handoff_id', 'workspace_key', 'correlation_id', 'attempt_number', 'replaces_attempt_id', 'replacement_policy', 'replacement_reason', 'legacy_dispatch_job_id',
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

    /** @return HasMany<DispatchPlanVersion, $this> */
    public function planVersions(): HasMany
    {
        return $this->hasMany(DispatchPlanVersion::class, 'attempt_id');
    }

    /** @return HasOne<DispatchPlanVersion, $this> */
    public function activePlanVersion(): HasOne
    {
        return $this->hasOne(DispatchPlanVersion::class, 'attempt_id')
            ->whereIn('status', ['approved', 'submitted'])
            ->latestOfMany('version');
    }

    /** @return HasMany<DispatchAssignmentOffer, $this> */
    public function offers(): HasMany
    {
        return $this->hasMany(DispatchAssignmentOffer::class, 'attempt_id');
    }

    /** @return HasMany<DispatchAssignmentOffer, $this> */
    public function assignmentOffers(): HasMany
    {
        return $this->hasMany(DispatchAssignmentOffer::class, 'attempt_id');
    }

    /** @return HasMany<DispatchPlanApproval, $this> */
    public function planApprovals(): HasMany
    {
        return $this->hasMany(DispatchPlanApproval::class, 'attempt_id');
    }

    /** @return HasMany<DispatchEmergencyOverride, $this> */
    public function emergencyOverrides(): HasMany
    {
        return $this->hasMany(DispatchEmergencyOverride::class, 'attempt_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** @return BelongsTo<User, $this> */
    public function leadDesignator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lead_designated_by');
    }

    /** @return BelongsTo<DispatchAssignmentOffer, $this> */
    public function designatedLeadOffer(): BelongsTo
    {
        return $this->belongsTo(DispatchAssignmentOffer::class, 'designated_lead_offer_id');
    }
}
