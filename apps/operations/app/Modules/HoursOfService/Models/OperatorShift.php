<?php

namespace App\Modules\HoursOfService\Models;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $operational_asset_id
 * @property int|null $dispatch_job_id
 * @property ShiftStatus $status
 * @property Carbon $started_at
 * @property Carbon|null $ended_at
 * @property int $operating_minutes
 * @property int $driving_minutes
 * @property int $standby_minutes
 * @property int $break_minutes
 * @property bool $is_certified
 * @property Carbon|null $certified_at
 * @property string|null $certification_statement
 * @property string|null $remarks
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User $user
 * @property-read OperationalAsset|null $operationalAsset
 * @property-read DispatchJob|null $dispatchJob
 * @property-read Collection<int, OperatorDutyLog> $dutyLogs
 * @property-read OperatorDutyLog|null $activeDutyLog
 */
class OperatorShift extends Model
{
    protected $table = 'operator_shifts';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'status' => ShiftStatus::class,
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'certified_at' => 'datetime',
            'operating_minutes' => 'integer',
            'driving_minutes' => 'integer',
            'standby_minutes' => 'integer',
            'break_minutes' => 'integer',
            'is_certified' => 'boolean',
        ];
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
     * @return HasMany<OperatorDutyLog, $this>
     */
    public function dutyLogs(): HasMany
    {
        return $this->hasMany(OperatorDutyLog::class, 'operator_shift_id')->orderBy('started_at', 'asc');
    }

    /**
     * @return HasOne<OperatorDutyLog, $this>
     */
    public function activeDutyLog(): HasOne
    {
        return $this->hasOne(OperatorDutyLog::class, 'operator_shift_id')
            ->whereNull('ended_at')
            ->latestOfMany('started_at');
    }

    /**
     * @param  Builder<OperatorShift>  $query
     * @return Builder<OperatorShift>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', [ShiftStatus::ACTIVE, ShiftStatus::ON_BREAK]);
    }

    /**
     * @param  Builder<OperatorShift>  $query
     * @return Builder<OperatorShift>
     */
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }
}
