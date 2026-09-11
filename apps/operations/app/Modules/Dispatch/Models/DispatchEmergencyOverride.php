<?php

namespace App\Modules\Dispatch\Models;

use App\Modules\Dispatch\Enums\DispatchEmergencyOverrideStatus;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $attempt_id
 * @property int|null $plan_version_id
 * @property string $workspace_key
 * @property string $kind
 * @property array<string, mixed> $scope
 * @property DispatchEmergencyOverrideStatus $status
 * @property int $requested_by
 * @property int|null $decided_by
 * @property string $request_reason
 * @property string|null $decision_reason
 * @property Carbon|null $expires_at
 * @property Carbon|null $decided_at
 * @property Carbon|null $consumed_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class DispatchEmergencyOverride extends Model
{
    protected $fillable = [
        'attempt_id', 'plan_version_id', 'workspace_key', 'kind', 'scope', 'status', 'requested_by',
        'decided_by', 'request_reason', 'decision_reason', 'expires_at', 'decided_at', 'consumed_at',
        'idempotency_key_id',
    ];

    protected function casts(): array
    {
        return [
            'scope' => 'array',
            'status' => DispatchEmergencyOverrideStatus::class,
            'expires_at' => 'datetime',
            'decided_at' => 'datetime',
            'consumed_at' => 'datetime',
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
    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    /** @return BelongsTo<User, $this> */
    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
