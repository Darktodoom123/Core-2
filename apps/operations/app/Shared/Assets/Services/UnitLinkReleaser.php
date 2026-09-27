<?php

namespace App\Shared\Assets\Services;

use App\Shared\Assets\Enums\UnitLinkReleaseReason;
use App\Shared\Assets\Models\UnitLink;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Closes open unit links. Call inside the caller's transaction so the
 * release commits with the event that caused it (shift end, lockout, handover).
 */
final class UnitLinkReleaser
{
    /** @return Collection<int, UnitLink> */
    public function forUser(int $userId, UnitLinkReleaseReason $reason): Collection
    {
        return $this->release(UnitLink::query()->where('user_id', $userId), $reason);
    }

    /** @return Collection<int, UnitLink> */
    public function forAsset(int $assetId, UnitLinkReleaseReason $reason): Collection
    {
        return $this->release(UnitLink::query()->where('operational_asset_id', $assetId), $reason);
    }

    /**
     * @param  Builder<UnitLink>  $query
     * @return Collection<int, UnitLink>
     */
    private function release(Builder $query, UnitLinkReleaseReason $reason): Collection
    {
        /** @var Collection<int, UnitLink> $links */
        $links = $query->open()->orderBy('id')->lockForUpdate()->get();

        foreach ($links as $link) {
            $link->update(['released_at' => now(), 'release_reason' => $reason]);
        }

        return $links;
    }
}
