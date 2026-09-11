<?php

namespace App\Modules\Dispatch\Models;

use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int|null $dispatch_job_id
 * @property int $operational_asset_id
 * @property int $operator_id
 * @property Carbon $shift_date
 * @property string $shift_type
 * @property bool $pre_climb_passed
 * @property bool $pre_climb_harness_inspected
 * @property bool $pre_climb_ladder_cleared
 * @property bool $anemometer_verified
 * @property float $operating_hours
 * @property int $lift_count
 * @property bool $free_slew_engaged
 * @property string|null $notes
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
final class TowerCraneShiftLog extends Model
{
    protected $table = 'tower_crane_shift_logs';

    protected $fillable = [
        'dispatch_job_id',
        'operational_asset_id',
        'operator_id',
        'shift_date',
        'shift_type',
        'pre_climb_passed',
        'pre_climb_harness_inspected',
        'pre_climb_ladder_cleared',
        'anemometer_verified',
        'operating_hours',
        'lift_count',
        'free_slew_engaged',
        'notes',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'shift_date' => 'date',
            'pre_climb_passed' => 'boolean',
            'pre_climb_harness_inspected' => 'boolean',
            'pre_climb_ladder_cleared' => 'boolean',
            'anemometer_verified' => 'boolean',
            'operating_hours' => 'float',
            'lift_count' => 'integer',
            'free_slew_engaged' => 'boolean',
        ];
    }

    /** @return BelongsTo<DispatchJob, $this> */
    public function dispatchJob(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id');
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function operationalAsset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }

    /** @return BelongsTo<User, $this> */
    public function operator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'operator_id');
    }
}
