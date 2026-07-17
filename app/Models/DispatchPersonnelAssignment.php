<?php

namespace App\Models;

use App\Enums\AssignmentResponse;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DispatchPersonnelAssignment extends Model
{
    protected $fillable = ['dispatch_job_id', 'user_id', 'assignment_type', 'response_status', 'assigned_by', 'approved_by', 'active_from', 'active_until'];

    protected function casts(): array
    {
        return ['response_status' => AssignmentResponse::class, 'active_from' => 'datetime', 'active_until' => 'datetime'];
    }

    /** @return BelongsTo<DispatchJob, $this> */
    public function job(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
