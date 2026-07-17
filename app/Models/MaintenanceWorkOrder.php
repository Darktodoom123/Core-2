<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property bool $dispatch_blocking
 * @property Carbon|null $released_at
 * @property OperationalAsset $asset
 */
class MaintenanceWorkOrder extends Model
{
    protected $fillable = ['operational_asset_id', 'technician_id', 'status', 'defect', 'work_performed', 'parts', 'dispatch_blocking', 'released_at'];

    protected function casts(): array
    {
        return ['work_performed' => 'array', 'parts' => 'array', 'dispatch_blocking' => 'boolean', 'released_at' => 'datetime'];
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }
}
