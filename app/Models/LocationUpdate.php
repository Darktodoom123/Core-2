<?php

namespace App\Models;

use App\Enums\PermissionName;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property Carbon|null $captured_at
 * @property Carbon|null $received_at
 */
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

    public function getFreshnessStatusAttribute(): string
    {
        if (! $this->sharing_enabled || ! $this->captured_at) {
            return 'offline';
        }

        $secondsAgo = (int) abs(now()->diffInSeconds($this->captured_at));

        if ($secondsAgo <= 120) {
            return 'fresh';
        }

        if ($secondsAgo <= 600) {
            return 'delayed';
        }

        if ($secondsAgo <= 1800) {
            return 'stale';
        }

        return 'offline';
    }

    /**
     * @param  Builder<LocationUpdate>  $query
     * @return Builder<LocationUpdate>
     */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        if ($user->can(PermissionName::TrackingViewAll->value)) {
            return $query;
        }

        return $query->where('user_id', $user->id);
    }
}
