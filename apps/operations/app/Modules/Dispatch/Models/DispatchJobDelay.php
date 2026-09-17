<?php

namespace App\Modules\Dispatch\Models;

use App\Modules\Dispatch\Enums\DelayContext;
use App\Modules\Dispatch\Enums\DelayReason;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $workspace_key
 * @property int $dispatch_job_id
 * @property int|null $dispatch_execution_attempt_id
 * @property int|null $operational_asset_id
 * @property int $reported_by
 * @property DelayContext $context
 * @property DelayReason $reason
 * @property string $reason_label
 * @property int|null $estimated_minutes
 * @property string|null $notes
 * @property int $job_version
 * @property Carbon $reported_at
 * @property string|null $command_id
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property DispatchJob|null $dispatchJob
 * @property User|null $reporter
 * @property OperationalAsset|null $operationalAsset
 * @property DispatchExecutionAttempt|null $attempt
 */
class DispatchJobDelay extends Model
{
    protected $fillable = [
        'workspace_key',
        'dispatch_job_id',
        'dispatch_execution_attempt_id',
        'operational_asset_id',
        'reported_by',
        'context',
        'reason',
        'reason_label',
        'estimated_minutes',
        'notes',
        'job_version',
        'reported_at',
        'command_id',
    ];

    protected function casts(): array
    {
        return [
            'context' => DelayContext::class,
            'reason' => DelayReason::class,
            'estimated_minutes' => 'integer',
            'job_version' => 'integer',
            'reported_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<DispatchJob, $this> */
    public function dispatchJob(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id');
    }

    /** @return BelongsTo<User, $this> */
    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function operationalAsset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }

    /** @return BelongsTo<DispatchExecutionAttempt, $this> */
    public function attempt(): BelongsTo
    {
        return $this->belongsTo(DispatchExecutionAttempt::class, 'dispatch_execution_attempt_id');
    }
}
