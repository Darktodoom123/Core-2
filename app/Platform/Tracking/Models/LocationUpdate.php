<?php

namespace App\Platform\Tracking\Models;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
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
        $freshnessTimestamp = $this->received_at ?? $this->captured_at;

        if (! $this->sharing_enabled || ! $freshnessTimestamp) {
            return 'offline';
        }

        // Freshness is based on when the server received the update. The
        // device-captured timestamp is still retained for audit and display.
        $secondsAgo = (int) abs(now()->diffInSeconds($freshnessTimestamp));

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
