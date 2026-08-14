<?php

namespace App\Modules\Dispatch\Models;

use App\Modules\Dispatch\Enums\DispatchPlanApprovalStatus;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DispatchPlanApproval extends Model
{
    protected $fillable = [
        'plan_version_id', 'approval_request_id', 'kind', 'status', 'requested_by', 'request_reason', 'decided_by', 'reason', 'decided_at',
    ];

    protected function casts(): array
    {
        return ['status' => DispatchPlanApprovalStatus::class, 'decided_at' => 'datetime'];
    }

    /** @return BelongsTo<DispatchPlanVersion, $this> */
    public function planVersion(): BelongsTo
    {
        return $this->belongsTo(DispatchPlanVersion::class, 'plan_version_id');
    }

    /** @return BelongsTo<ApprovalRequest, $this> */
    public function legacyApprovalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class, 'approval_request_id');
    }

    /** @return BelongsTo<User, $this> */
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
