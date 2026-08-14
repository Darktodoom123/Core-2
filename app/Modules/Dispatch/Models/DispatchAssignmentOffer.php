<?php

namespace App\Modules\Dispatch\Models;

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $attempt_id
 * @property int $plan_version_id
 * @property int $user_id
 * @property bool $is_mandatory
 * @property DispatchAssignmentOfferStatus $status
 * @property Carbon|null $accepted_at
 * @property Carbon|null $response_deadline
 * @property Carbon|null $ended_at
 */
class DispatchAssignmentOffer extends Model
{
    protected $fillable = [
        'attempt_id', 'plan_version_id', 'workspace_key', 'user_id', 'legacy_assignment_id', 'assignment_type',
        'is_mandatory', 'status', 'offered_at', 'response_deadline', 'responded_at', 'response_reason',
        'accepted_at', 'rejected_at', 'withdrawn_at', 'expired_at', 'created_by', 'approved_by',
        'legacy_response_status', 'compatibility_state', 'ended_at', 'ended_by', 'ended_reason',
    ];

    protected function casts(): array
    {
        return [
            'is_mandatory' => 'boolean',
            'status' => DispatchAssignmentOfferStatus::class,
            'offered_at' => 'datetime',
            'response_deadline' => 'datetime',
            'responded_at' => 'datetime',
            'accepted_at' => 'datetime',
            'rejected_at' => 'datetime',
            'withdrawn_at' => 'datetime',
            'expired_at' => 'datetime',
            'ended_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<DispatchExecutionAttempt, $this> */
    public function attempt(): BelongsTo
    {
        return $this->belongsTo(DispatchExecutionAttempt::class, 'attempt_id');
    }

    /** @return BelongsTo<DispatchPlanVersion, $this> */
    public function planVersion(): BelongsTo
    {
        return $this->belongsTo(DispatchPlanVersion::class, 'plan_version_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<DispatchPersonnelAssignment, $this> */
    public function legacyAssignment(): BelongsTo
    {
        return $this->belongsTo(DispatchPersonnelAssignment::class, 'legacy_assignment_id');
    }
}
