<?php

namespace App\Platform\Tracking\Services;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Models\LocationUpdate;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class DatabaseTrackingClient implements TrackingClientInterface
{
    public function ingestLocation(LocationSampleDto $sample): LatestLocationDto
    {
        $update = LocationUpdate::query()->create([
            'user_id' => $sample->userId,
            'operational_asset_id' => $sample->operationalAssetId,
            'dispatch_job_id' => $sample->dispatchJobId,
            'latitude' => $sample->latitude,
            'longitude' => $sample->longitude,
            'accuracy_metres' => $sample->accuracyMetres,
            'speed' => $sample->speed,
            'remarks' => $sample->remarks,
            'source' => $sample->source,
            'sharing_enabled' => $sample->sharingEnabled,
            'captured_at' => $sample->capturedAt ?? now(),
            'received_at' => $sample->receivedAt ?? now(),
        ]);

        return LatestLocationDto::fromLocationUpdate($update);
    }

    public function getLatestLocations(?User $user = null): Collection
    {
        if ($user !== null) {
            $canView = $user->can(PermissionName::TrackingViewAll->value)
                || $user->can(PermissionName::TrackingShareOwn->value);

            if (! $canView) {
                return collect();
            }
        }

        $subQuery = LocationUpdate::query();
        if ($user !== null) {
            $subQuery->visibleTo($user);
        }
        $latestIds = $subQuery->selectRaw('MAX(id)')
            ->groupBy('user_id', 'operational_asset_id');

        $updatesQuery = LocationUpdate::query()
            ->whereIn('id', $latestIds);

        if ($user !== null) {
            $updatesQuery->visibleTo($user);
        }

        /** @var Collection<int, LocationUpdate> $updates */
        $updates = $updatesQuery
            ->latest('received_at')
            ->latest('id')
            ->limit(100)
            ->get();

        return $updates
            ->map(static fn (LocationUpdate $u): LatestLocationDto => LatestLocationDto::fromLocationUpdate($u))
            ->values();
    }

    public function getLatestLocationForUser(int $userId): ?LatestLocationDto
    {
        $update = LocationUpdate::query()
            ->where('user_id', $userId)
            ->latest('received_at')
            ->latest('id')
            ->first();

        return $update !== null ? LatestLocationDto::fromLocationUpdate($update) : null;
    }

    public function getLatestLocationForAsset(int $assetId): ?LatestLocationDto
    {
        $update = LocationUpdate::query()
            ->where('operational_asset_id', $assetId)
            ->latest('received_at')
            ->latest('id')
            ->first();

        return $update !== null ? LatestLocationDto::fromLocationUpdate($update) : null;
    }

    public function getLatestLocationForJob(int $jobId, ?User $user = null): ?LatestLocationDto
    {
        $query = LocationUpdate::query()
            ->where('dispatch_job_id', $jobId);

        if ($user !== null) {
            $query->visibleTo($user);
        }

        $update = $query
            ->latest('received_at')
            ->latest('id')
            ->first();

        return $update !== null ? LatestLocationDto::fromLocationUpdate($update) : null;
    }

    public function queryLocationHistory(array $filters = []): Collection
    {
        $query = LocationUpdate::query();

        if (! empty($filters['user_id'])) {
            $query->where('user_id', $filters['user_id']);
        }
        if (! empty($filters['operational_asset_id'])) {
            $query->where('operational_asset_id', $filters['operational_asset_id']);
        }
        if (! empty($filters['dispatch_job_id'])) {
            $query->where('dispatch_job_id', $filters['dispatch_job_id']);
        }
        $from = $filters['from'] ?? $filters['date_from'] ?? null;
        if (! empty($from)) {
            $query->where('captured_at', '>=', $from);
        }
        $to = $filters['to'] ?? $filters['date_to'] ?? null;
        if (! empty($to)) {
            $query->where('captured_at', '<=', $to);
        }

        $orderDirection = strtolower((string) ($filters['order_direction'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $orderBy = (string) ($filters['order_by'] ?? 'captured_at');
        $query->orderBy($orderBy, $orderDirection);

        if (isset($filters['limit']) && (int) $filters['limit'] > 0) {
            $query->limit((int) $filters['limit']);
        }

        /** @var Collection<int, LocationUpdate> $records */
        $records = $query->get();

        return $records->map(static fn (LocationUpdate $u): LocationSampleDto => LocationSampleDto::fromArray($u->toArray()));
    }

    public function getTrackingFreshness(User $user, CarbonImmutable $refreshedAt, int $staleAfterSeconds = 120): array
    {
        $canViewTracking = $user->can(PermissionName::TrackingViewAll->value)
            || $user->can(PermissionName::TrackingShareOwn->value);

        if (! $canViewTracking) {
            return [
                'refreshed_at' => $refreshedAt->toIso8601String(),
                'stale_after_seconds' => $staleAfterSeconds,
                'latest_received_at' => null,
                'current_user' => null,
            ];
        }

        $latestVisibleLocation = LocationUpdate::query()
            ->visibleTo($user)
            ->latest('received_at')
            ->latest('id')
            ->first(['received_at']);

        $latestOwnLocation = LocationUpdate::query()
            ->where('user_id', $user->id)
            ->latest('received_at')
            ->latest('id')
            ->first(['sharing_enabled', 'captured_at', 'received_at']);

        return [
            'refreshed_at' => $refreshedAt->toIso8601String(),
            'stale_after_seconds' => $staleAfterSeconds,
            'latest_received_at' => $latestVisibleLocation?->received_at?->toIso8601String(),
            'current_user' => [
                'sharing_enabled' => $latestOwnLocation?->sharing_enabled,
                'captured_at' => $latestOwnLocation?->captured_at?->toIso8601String(),
                'received_at' => $latestOwnLocation?->received_at?->toIso8601String(),
            ],
        ];
    }
}
