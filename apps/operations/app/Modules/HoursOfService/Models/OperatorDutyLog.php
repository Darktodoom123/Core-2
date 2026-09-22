<?php

namespace App\Modules\HoursOfService\Models;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\StandbyReason;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $operator_shift_id
 * @property int $user_id
 * @property int|null $operational_asset_id
 * @property int|null $dispatch_job_id
 * @property DutyStatus $duty_status
 * @property DutyStatus|null $previous_duty_status
 * @property StandbyReason|null $standby_reason
 * @property bool $is_demurrage_billable
 * @property Carbon $started_at
 * @property Carbon|null $ended_at
 * @property int|null $duration_minutes
 * @property Carbon|null $occurred_at
 * @property Carbon|null $accepted_at
 * @property float|null $latitude
 * @property float|null $longitude
 * @property float|null $accuracy_metres
 * @property string|null $location_name
 * @property Carbon|null $location_observed_at
 * @property string|null $location_source
 * @property string|null $location_freshness
 * @property string|null $remarks
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read OperatorShift $shift
 * @property-read User $user
 * @property-read OperationalAsset|null $operationalAsset
 * @property-read DispatchJob|null $dispatchJob
 */
class OperatorDutyLog extends Model
{
    protected $table = 'operator_duty_logs';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'duty_status' => DutyStatus::class,
            'previous_duty_status' => DutyStatus::class,
            'standby_reason' => StandbyReason::class,
            'is_demurrage_billable' => 'boolean',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'duration_minutes' => 'integer',
            'occurred_at' => 'datetime',
            'accepted_at' => 'datetime',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'accuracy_metres' => 'decimal:2',
            'location_observed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<OperatorShift, $this>
     */
    public function shift(): BelongsTo
    {
        return $this->belongsTo(OperatorShift::class, 'operator_shift_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return BelongsTo<OperationalAsset, $this>
     */
    public function operationalAsset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }

    /**
     * @return BelongsTo<DispatchJob, $this>
     */
    public function dispatchJob(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id');
    }

    /**
     * @param  Builder<OperatorDutyLog>  $query
     * @return Builder<OperatorDutyLog>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('ended_at');
    }

    /**
     * @param  Builder<OperatorDutyLog>  $query
     * @return Builder<OperatorDutyLog>
     */
    public function scopeDemurrageBillable(Builder $query): Builder
    {
        return $query->where('is_demurrage_billable', true);
    }
}
