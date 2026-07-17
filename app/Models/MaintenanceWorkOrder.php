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
    protected $fillable = ['operational_asset_id', 'technician_id', 'status', 'defect', 'work_performed', 'parts', 'dispatch_blocking', 'released_at', 'scheduled_at', 'next_due_at', 'remarks', 'release_verified_by', 'release_checklist'];

    protected function casts(): array
    {
        return ['work_performed' => 'array', 'parts' => 'array', 'dispatch_blocking' => 'boolean', 'released_at' => 'datetime', 'scheduled_at' => 'datetime', 'next_due_at' => 'datetime', 'release_checklist' => 'array'];
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }

    /** @return BelongsTo<User, $this> */
    public function releaseVerifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'release_verified_by');
    }
}
