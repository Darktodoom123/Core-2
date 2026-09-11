<?php

namespace App\Platform\Tracking\Facades;

use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Testing\FakeTrackingClient;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Facade;

/**
 * @method static LatestLocationDto ingestLocation(LocationSampleDto $sample)
 * @method static Collection<int, LatestLocationDto> getLatestLocations(?User $user = null)
 * @method static ?LatestLocationDto getLatestLocationForUser(int $userId)
 * @method static ?LatestLocationDto getLatestLocationForAsset(int $assetId)
 * @method static ?LatestLocationDto getLatestLocationForJob(int $jobId, ?User $user = null)
 * @method static Collection<int, LocationSampleDto> queryLocationHistory(array<string, mixed> $filters = [])
 * @method static array<string, mixed> getTrackingFreshness(User $user, CarbonImmutable $refreshedAt, int $staleAfterSeconds = 120)
 *
 * @see TrackingClientInterface
 */
class TrackingClient extends Facade
{
    /**
     * Swap the client with a fresh FakeTrackingClient.
     */
    public static function fake(): FakeTrackingClient
    {
        $fake = new FakeTrackingClient;
        static::swap($fake);
        app()->instance(TrackingClientInterface::class, $fake);

        return $fake;
    }

    protected static function getFacadeAccessor(): string
    {
        return TrackingClientInterface::class;
    }
}
