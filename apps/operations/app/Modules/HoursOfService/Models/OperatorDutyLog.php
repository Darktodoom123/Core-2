<?php

namespace App\Modules\HoursOfService\Models;

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\StandbyReason;
use App\Platform\Identity\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $operator_shift_id
 * @property int $user_id
 * @property DutyStatus $duty_status
 * @property StandbyReason|null $standby_reason
 * @property bool $is_demurrage_billable
 * @property Carbon $started_at
 * @property Carbon|null $ended_at
 * @property int|null $duration_minutes
 * @property float|null $latitude
 * @property float|null $longitude
 * @property string|null $location_name
 * @property string|null $remarks
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read OperatorShift $shift
 * @property-read User $user
 */
class OperatorDutyLog extends Model
{
    protected $table = 'operator_duty_logs';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'duty_status' => DutyStatus::class,
            'standby_reason' => StandbyReason::class,
            'is_demurrage_billable' => 'boolean',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'duration_minutes' => 'integer',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
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
