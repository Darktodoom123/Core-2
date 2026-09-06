<?php

namespace App\Modules\Dvir\Models;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dvir\Enums\DvirInspectionType;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $operational_asset_id
 * @property int|null $dispatch_job_id
 * @property DvirInspectionType $inspection_type
 * @property string|null $asset_code
 * @property string|null $asset_name
 * @property string|null $inspector_name
 * @property float|null $starting_odometer_km
 * @property float|null $ending_odometer_km
 * @property float|null $engine_hours
 * @property bool $has_defects
 * @property int $critical_defects_count
 * @property bool $signature_captured
 * @property string|null $remarks
 * @property Carbon $completed_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read string $reference
 * @property-read User $user
 * @property-read OperationalAsset|null $operationalAsset
 * @property-read DispatchJob|null $dispatchJob
 * @property-read Collection<int, DvirInspectionCheck> $checks
 * @property-read Collection<int, DvirInspectionPhoto> $photos
 */
class DvirInspection extends Model
{
    protected $table = 'dvir_inspections';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'inspection_type' => DvirInspectionType::class,
            'starting_odometer_km' => 'float',
            'ending_odometer_km' => 'float',
            'engine_hours' => 'float',
            'has_defects' => 'boolean',
            'critical_defects_count' => 'integer',
            'signature_captured' => 'boolean',
            'completed_at' => 'datetime',
        ];
    }

    /**
     * Human-friendly reference used by the mobile client, e.g. DVIR-000042.
     */
    public function getReferenceAttribute(): string
    {
        return sprintf('DVIR-%06d', $this->getKey());
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
     * @return HasMany<DvirInspectionCheck, $this>
     */
    public function checks(): HasMany
    {
        return $this->hasMany(DvirInspectionCheck::class, 'dvir_inspection_id')
            ->orderBy('sort_order', 'asc')
            ->orderBy('id', 'asc');
    }

    /**
     * @return HasMany<DvirInspectionPhoto, $this>
     */
    public function photos(): HasMany
    {
        return $this->hasMany(DvirInspectionPhoto::class, 'dvir_inspection_id')
            ->orderBy('id', 'asc');
    }

    /**
     * @param  Builder<DvirInspection>  $query
     * @return Builder<DvirInspection>
     */
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }

    /**
     * @param  Builder<DvirInspection>  $query
     * @return Builder<DvirInspection>
     */
    public function scopeCompletedWithinDays(Builder $query, int $days): Builder
    {
        return $query->where('completed_at', '>=', Carbon::now()->subDays($days)->startOfDay());
    }
}
