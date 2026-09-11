<?php

namespace App\Platform\Tracking\Contracts;

use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Data\LocationSampleDto;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

interface TrackingClientInterface
{
    /**
     * Ingest a location sample and return the updated latest position projection.
     */
    public function ingestLocation(LocationSampleDto $sample): LatestLocationDto;

    /**
     * Query the latest positions visible to an authorized user, or all latest positions.
     *
     * @return Collection<int, LatestLocationDto>
     */
    public function getLatestLocations(?User $user = null): Collection;

    /**
     * Query the latest position for a specific user.
     */
    public function getLatestLocationForUser(int $userId): ?LatestLocationDto;

    /**
     * Query the latest position for a specific asset.
     */
    public function getLatestLocationForAsset(int $assetId): ?LatestLocationDto;

    /**
     * Query the latest position for a specific dispatch job, optionally scoped to an authorized user.
     */
    public function getLatestLocationForJob(int $jobId, ?User $user = null): ?LatestLocationDto;

    /**
     * Query location history/audit records by filters.
     *
     * @param  array<string, mixed>  $filters
     * @return Collection<int, LocationSampleDto>
     */
    public function queryLocationHistory(array $filters = []): Collection;

    /**
     * Get tracking freshness summary for workspace.
     *
     * @return array{
     *     refreshed_at: string,
     *     stale_after_seconds: int,
     *     latest_received_at: ?string,
     *     current_user: ?array{
     *         sharing_enabled: ?bool,
     *         captured_at: ?string,
     *         received_at: ?string
     *     }
     * }
     */
    public function getTrackingFreshness(User $user, CarbonImmutable $refreshedAt, int $staleAfterSeconds = 120): array;
}
