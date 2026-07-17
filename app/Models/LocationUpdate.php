<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LocationUpdate extends Model
{
    protected $fillable = ['user_id', 'operational_asset_id', 'dispatch_job_id', 'latitude', 'longitude', 'accuracy_metres', 'speed', 'remarks', 'source', 'sharing_enabled', 'captured_at', 'received_at'];

    protected function casts(): array
    {
        return ['sharing_enabled' => 'boolean', 'speed' => 'decimal:2', 'captured_at' => 'datetime', 'received_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
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
