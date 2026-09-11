<?php

namespace App\Modules\Assignment\Models;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property Carbon|null $active_until
 * @property DispatchJob $job
 * @property OperationalAsset $asset
 */
class DispatchAssetAssignment extends Model
{
    protected $fillable = ['dispatch_job_id', 'operational_asset_id', 'assignment_type', 'site_latitude', 'site_longitude', 'assigned_by', 'approved_by', 'active_from', 'active_until'];

    protected function casts(): array
    {
        return [
            'active_from' => 'datetime',
            'active_until' => 'datetime',
            'site_latitude' => 'float',
            'site_longitude' => 'float',
        ];
    }

    /** @return BelongsTo<DispatchJob, $this> */
    public function job(): BelongsTo
    {
        return $this->belongsTo(DispatchJob::class, 'dispatch_job_id');
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }

    /**
     * @param  Builder<DispatchAssetAssignment>  $query
     * @return Builder<DispatchAssetAssignment>
     */
    public function scopeActive(Builder $query): Builder
    {
        $now = now();

        return $query->open()
            ->where(function (Builder $query) use ($now): void {
                $query->whereNull('active_from')->orWhere('active_from', '<=', $now);
            });
    }

    /**
     * @param  Builder<DispatchAssetAssignment>  $query
     * @return Builder<DispatchAssetAssignment>
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->where(function (Builder $query): void {
            $query->whereNull('active_until')->orWhere('active_until', '>', now());
        });
    }
}
