<?php

namespace App\Platform\Tracking\Testing;

use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LatestLocationDto;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Models\LocationUpdate;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use PHPUnit\Framework\Assert;

class FakeTrackingClient implements TrackingClientInterface
{
    /** @var Collection<int, LocationSampleDto> */
    protected Collection $samples;

    /** @var Collection<string, LatestLocationDto> */
    protected Collection $latestLocations;

    protected int $nextId = 1;

    public function __construct()
    {
        $this->samples = collect();
        $this->latestLocations = collect();
    }

    public function ingestLocation(LocationSampleDto $sample): LatestLocationDto
    {
        $id = $sample->id ?? $this->nextId++;
        $capturedAt = $sample->capturedAt ?? CarbonImmutable::now();
        $receivedAt = $sample->receivedAt ?? CarbonImmutable::now();

        $freshnessStatus = LatestLocationDto::computeFreshness($receivedAt, $sample->sharingEnabled);

        $dto = new LatestLocationDto(
            id: $id,
            userId: $sample->userId,
            operationalAssetId: $sample->operationalAssetId,
            dispatchJobId: $sample->dispatchJobId,
            latitude: $sample->latitude,
            longitude: $sample->longitude,
            accuracyMetres: $sample->accuracyMetres,
            speed: $sample->speed,
            remarks: $sample->remarks,
            source: $sample->source,
            sharingEnabled: $sample->sharingEnabled,
            capturedAt: $capturedAt,
            receivedAt: $receivedAt,
            freshnessStatus: $freshnessStatus,
        );

        $key = "{$sample->userId}-".($sample->operationalAssetId ?? 'none');
        $this->latestLocations->put($key, $dto);

        // Also record a copy in samples
        $sampleWithId = new LocationSampleDto(
            userId: $sample->userId,
            operationalAssetId: $sample->operationalAssetId,
            dispatchJobId: $sample->dispatchJobId,
            latitude: $sample->latitude,
            longitude: $sample->longitude,
            accuracyMetres: $sample->accuracyMetres,
            speed: $sample->speed,
            remarks: $sample->remarks,
            source: $sample->source,
            sharingEnabled: $sample->sharingEnabled,
            capturedAt: $capturedAt,
            receivedAt: $receivedAt,
            commandId: $sample->commandId,
            id: $id,
        );
        $this->samples->push($sampleWithId);

        return $dto;
    }

    /** @param array<string, mixed> $attributes */
    public function fakeLocation(array $attributes): LatestLocationDto
    {
        return $this->ingestLocation(LocationSampleDto::fromArray($attributes));
    }

    public function recordExistingModel(LocationUpdate $update): LatestLocationDto
    {
        $dto = LatestLocationDto::fromLocationUpdate($update);
        $key = "{$update->user_id}-".($update->operational_asset_id ?? 'none');
        $this->latestLocations->put($key, $dto);

        $this->samples->push(LocationSampleDto::fromArray([
            'id' => $update->id,
            'user_id' => $update->user_id,
            'operational_asset_id' => $update->operational_asset_id,
            'dispatch_job_id' => $update->dispatch_job_id,
            'latitude' => $update->latitude,
            'longitude' => $update->longitude,
            'accuracy_metres' => $update->accuracy_metres,
            'speed' => $update->speed,
            'remarks' => $update->remarks,
            'source' => $update->source ?? 'mobile',
            'sharing_enabled' => (bool) $update->sharing_enabled,
            'captured_at' => $update->captured_at,
            'received_at' => $update->received_at,
        ]));

        $this->nextId = max($this->nextId, (int) $update->id + 1);

        return $dto;
    }

    public function syncFromDatabase(): void
    {
        try {
            $records = LocationUpdate::query()->orderBy('id')->get();
            foreach ($records as $record) {
                $this->recordExistingModel($record);
            }
        } catch (\Throwable) {
            // Database may not be migrated in some unit test contexts
        }
    }

    protected function ensureSynchronized(): void
    {
        if ($this->latestLocations->isEmpty()) {
            $this->syncFromDatabase();
        }
    }

    public function getLatestLocations(?User $user = null): Collection
    {
        $this->ensureSynchronized();

        if ($user !== null) {
            $canView = $user->can(PermissionName::TrackingViewAll->value)
                || $user->can(PermissionName::TrackingShareOwn->value);

            if (! $canView) {
                return collect();
            }

            if (! $user->can(PermissionName::TrackingViewAll->value)) {
                return $this->latestLocations
                    ->filter(static fn (LatestLocationDto $l): bool => $l->userId === $user->id)
                    ->sortByDesc(static fn (LatestLocationDto $l): ?string => $l->receivedAt?->toIso8601String())
                    ->take(100)
                    ->values();
            }
        }

        return $this->latestLocations
            ->sortByDesc(static fn (LatestLocationDto $l): ?string => $l->receivedAt?->toIso8601String())
            ->take(100)
            ->values();
    }

    public function getLatestLocationForUser(int $userId): ?LatestLocationDto
    {
        $this->ensureSynchronized();

        return $this->latestLocations
            ->filter(static fn (LatestLocationDto $l): bool => $l->userId === $userId)
            ->sortByDesc(static fn (LatestLocationDto $l): ?string => $l->receivedAt?->toIso8601String())
            ->first();
    }

    public function getLatestLocationForAsset(int $assetId): ?LatestLocationDto
    {
        $this->ensureSynchronized();

        return $this->latestLocations
            ->filter(static fn (LatestLocationDto $l): bool => $l->operationalAssetId === $assetId)
            ->sortByDesc(static fn (LatestLocationDto $l): ?string => $l->receivedAt?->toIso8601String())
            ->first();
    }

    public function getLatestLocationForJob(int $jobId, ?User $user = null): ?LatestLocationDto
    {
        $this->ensureSynchronized();

        $filtered = $this->latestLocations
            ->filter(static fn (LatestLocationDto $l): bool => $l->dispatchJobId === $jobId);

        if ($user !== null && ! $user->can(PermissionName::TrackingViewAll->value)) {
            $filtered = $filtered->filter(static fn (LatestLocationDto $l): bool => $l->userId === $user->id);
        }

        return $filtered
            ->sortByDesc(static fn (LatestLocationDto $l): ?string => $l->receivedAt?->toIso8601String())
            ->first();
    }

    public function queryLocationHistory(array $filters = []): Collection
    {
        $this->ensureSynchronized();

        $filtered = $this->samples;

        if (! empty($filters['user_id'])) {
            $filtered = $filtered->filter(static fn (LocationSampleDto $s): bool => $s->userId === (int) $filters['user_id']);
        }
        if (! empty($filters['operational_asset_id'])) {
            $filtered = $filtered->filter(static fn (LocationSampleDto $s): bool => $s->operationalAssetId === (int) $filters['operational_asset_id']);
        }
        if (! empty($filters['dispatch_job_id'])) {
            $filtered = $filtered->filter(static fn (LocationSampleDto $s): bool => $s->dispatchJobId === (int) $filters['dispatch_job_id']);
        }
        $fromValue = $filters['from'] ?? $filters['date_from'] ?? null;
        if (! empty($fromValue)) {
            $from = CarbonImmutable::parse($fromValue);
            $filtered = $filtered->filter(static fn (LocationSampleDto $s): bool => $s->capturedAt !== null && $s->capturedAt->greaterThanOrEqualTo($from));
        }
        $toValue = $filters['to'] ?? $filters['date_to'] ?? null;
        if (! empty($toValue)) {
            $to = CarbonImmutable::parse($toValue);
            $filtered = $filtered->filter(static fn (LocationSampleDto $s): bool => $s->capturedAt !== null && $s->capturedAt->lessThanOrEqualTo($to));
        }

        $orderDirection = strtolower((string) ($filters['order_direction'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';
        $orderBy = (string) ($filters['order_by'] ?? 'captured_at');

        if ($orderBy === 'id') {
            $filtered = $orderDirection === 'asc'
                ? $filtered->sortBy(static fn (LocationSampleDto $s): int => $s->id ?? 0)
                : $filtered->sortByDesc(static fn (LocationSampleDto $s): int => $s->id ?? 0);
        } else {
            $filtered = $orderDirection === 'asc'
                ? $filtered->sortBy(static fn (LocationSampleDto $s): ?string => $s->capturedAt?->toIso8601String())
                : $filtered->sortByDesc(static fn (LocationSampleDto $s): ?string => $s->capturedAt?->toIso8601String());
        }

        if (isset($filters['limit']) && (int) $filters['limit'] > 0) {
            $filtered = $filtered->take((int) $filters['limit']);
        }

        return $filtered->values();
    }

    public function getTrackingFreshness(User $user, CarbonImmutable $refreshedAt, int $staleAfterSeconds = 120): array
    {
        $this->ensureSynchronized();

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

        $visibleLocations = $user->can(PermissionName::TrackingViewAll->value)
            ? $this->latestLocations
            : $this->latestLocations->filter(static fn (LatestLocationDto $l): bool => $l->userId === $user->id);

        /** @var LatestLocationDto|null $latestVisible */
        $latestVisible = $visibleLocations
            ->sortByDesc(static fn (LatestLocationDto $l): ?string => $l->receivedAt?->toIso8601String())
            ->first();

        /** @var LatestLocationDto|null $latestOwn */
        $latestOwn = $this->latestLocations
            ->filter(static fn (LatestLocationDto $l): bool => $l->userId === $user->id)
            ->sortByDesc(static fn (LatestLocationDto $l): ?string => $l->receivedAt?->toIso8601String())
            ->first();

        return [
            'refreshed_at' => $refreshedAt->toIso8601String(),
            'stale_after_seconds' => $staleAfterSeconds,
            'latest_received_at' => $latestVisible?->receivedAt?->toIso8601String(),
            'current_user' => [
                'sharing_enabled' => $latestOwn?->sharingEnabled,
                'captured_at' => $latestOwn?->capturedAt?->toIso8601String(),
                'received_at' => $latestOwn?->receivedAt?->toIso8601String(),
            ],
        ];
    }

    /**
     * Assert that a location matching the truth-test callback was ingested.
     *
     * @param  callable(LocationSampleDto): bool  $callback
     */
    public function assertIngested(callable $callback): void
    {
        $matched = $this->samples->first($callback);
        Assert::assertNotNull(
            $matched,
            'Expected location sample was not ingested.'
        );
    }

    /**
     * Assert the total number of location samples ingested.
     */
    public function assertIngestedCount(int $expectedCount): void
    {
        Assert::assertCount(
            $expectedCount,
            $this->samples,
            "Expected {$expectedCount} location samples to be ingested, but found {$this->samples->count()}."
        );
    }

    /**
     * Assert that no location samples were ingested.
     */
    public function assertNothingIngested(): void
    {
        $this->assertIngestedCount(0);
    }

    public function reset(): void
    {
        $this->samples = collect();
        $this->latestLocations = collect();
        $this->nextId = 1;
    }
}
