<?php

namespace App\Shared\Assets\Models;

use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\UnitLinkReleaseReason;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An operator physically bound to a unit on site, from link to release.
 *
 * @property int $id
 * @property int $operational_asset_id
 * @property int $user_id
 * @property int|null $dispatch_job_id
 * @property Carbon $linked_at
 * @property Carbon|null $released_at
 * @property UnitLinkReleaseReason|null $release_reason
 * @property-read OperationalAsset $asset
 * @property-read User $user
 */
class UnitLink extends Model
{
    protected $fillable = ['operational_asset_id', 'user_id', 'dispatch_job_id', 'linked_at', 'released_at', 'release_reason'];

    protected function casts(): array
    {
        return [
            'linked_at' => 'datetime',
            'released_at' => 'datetime',
            'release_reason' => UnitLinkReleaseReason::class,
        ];
    }

    /** @return BelongsTo<OperationalAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(OperationalAsset::class, 'operational_asset_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @param  Builder<UnitLink>  $query
     * @return Builder<UnitLink>
     */
    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereNull('released_at');
    }
}
