<?php

namespace App\Platform\Safety\Models;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $lift_reference
 * @property int|null $dispatch_job_id
 * @property int|null $operational_asset_id
 * @property string $project_site
 * @property int|null $crane_operator_id
 * @property int|null $lead_rigger_id
 * @property string $rigger_tesda_nc_number
 * @property string $risk_level
 * @property float $gross_load_weight_tons
 * @property float $crane_rated_capacity_tons
 * @property float $load_percentage_of_capacity
 * @property float $boom_length_meters
 * @property float $working_radius_meters
 * @property string $ground_bearing_condition
 * @property float $weather_wind_speed_kph
 * @property string $status
 * @property int|null $foreman_id
 * @property Carbon|null $foreman_signed_at
 * @property int|null $safety_officer_id
 * @property Carbon|null $safety_officer_signed_at
 * @property string|null $rejection_reason
 * @property Carbon $created_at
 * @property Carbon $updated_at
 */
final class CriticalLiftPlan extends Model
{
    protected $table = 'critical_lift_plans';

    protected $fillable = [
        'lift_reference',
        'dispatch_job_id',
        'operational_asset_id',
        'project_site',
        'crane_operator_id',
        'lead_rigger_id',
        'rigger_tesda_nc_number',
        'risk_level',
        'gross_load_weight_tons',
        'crane_rated_capacity_tons',
        'load_percentage_of_capacity',
        'boom_length_meters',
        'working_radius_meters',
        'ground_bearing_condition',
        'weather_wind_speed_kph',
        'status',
        'foreman_id',
        'foreman_signed_at',
        'safety_officer_id',
        'safety_officer_signed_at',
        'rejection_reason',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'gross_load_weight_tons' => 'float',
            'crane_rated_capacity_tons' => 'float',
            'load_percentage_of_capacity' => 'float',
            'boom_length_meters' => 'float',
            'working_radius_meters' => 'float',
            'weather_wind_speed_kph' => 'float',
            'foreman_signed_at' => 'datetime',
            'safety_officer_signed_at' => 'datetime',
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
    public function craneOperator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'crane_operator_id');
    }

    /** @return BelongsTo<User, $this> */
    public function leadRigger(): BelongsTo
    {
        return $this->belongsTo(User::class, 'lead_rigger_id');
    }

    /** @return BelongsTo<User, $this> */
    public function foreman(): BelongsTo
    {
        return $this->belongsTo(User::class, 'foreman_id');
    }

    /** @return BelongsTo<User, $this> */
    public function safetyOfficer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'safety_officer_id');
    }
}
