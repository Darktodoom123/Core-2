<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** @property OperationalAsset $asset */
class DispatchAssetAssignment extends Model
{
    protected $fillable = ['dispatch_job_id', 'operational_asset_id', 'assignment_type', 'assigned_by', 'approved_by', 'active_from', 'active_until'];

    protected function casts(): array
    {
        return ['active_from' => 'datetime', 'active_until' => 'datetime'];
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
}
