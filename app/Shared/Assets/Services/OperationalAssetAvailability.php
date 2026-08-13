<?php

namespace App\Shared\Assets\Services;

use App\Shared\Assets\Contracts\AssetUsageConflictChecker;
use App\Shared\Assets\Data\AssetUsageAssessment;
use App\Shared\Assets\Data\AssetUsageConflict;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

final class OperationalAssetAvailability
{
    /** @param iterable<AssetUsageConflictChecker> $checkers */
    public function __construct(private readonly iterable $checkers) {}

    public function assess(AssetUsageRequest $request): AssetUsageAssessment
    {
        $conflicts = [];
        $asset = OperationalAsset::query()->withTrashed()->find($request->assetId);

        if (! $asset instanceof OperationalAsset) {
            $conflicts[] = new AssetUsageConflict('asset.not_found', 'The selected asset no longer exists.');
        } elseif ($asset->trashed()) {
            $conflicts[] = new AssetUsageConflict('asset.deleted', 'The selected asset is no longer available.');
        } else {
            $conflicts = [...$conflicts, ...$this->safetyConflicts($asset, $request)];
        }

        foreach ($this->checkers as $checker) {
            foreach ($checker->conflicts($request) as $conflict) {
                $conflicts[] = $conflict;
            }
        }

        return new AssetUsageAssessment($conflicts);
    }

    public function assertNoConflict(AssetUsageRequest $request, string $validationKey = 'asset'): void
    {
        $assessment = $this->assess($request);
        if ($assessment->allowed()) {
            return;
        }

        throw ValidationException::withMessages([
            $validationKey => $assessment->conflicts[0]->message,
        ]);
    }

    /**
     * @param  array<int, int|string>  $assetIds
     * @return Collection<int, OperationalAsset>
     */
    public function lockAssetsForUpdate(array $assetIds): Collection
    {
        $assetIds = array_values(array_unique(array_map(static fn (int|string $id): int => (int) $id, $assetIds)));
        sort($assetIds);

        if ($assetIds === []) {
            /** @var Collection<int, OperationalAsset> $empty */
            $empty = new Collection;

            return $empty;
        }

        return OperationalAsset::query()
            ->withTrashed()
            ->whereIn('id', $assetIds)
            ->orderBy('id')
            ->lockForUpdate()
            ->get()
            ->keyBy('id');
    }

    /** @return list<AssetUsageConflict> */
    private function safetyConflicts(OperationalAsset $asset, AssetUsageRequest $request): array
    {
        if ($request->usageType === AssetUsageType::RentalReturn && $request->targetStatus?->dispatchable()) {
            return $this->rentalReturnRestoreConflicts($asset);
        }

        $targetRequiresReadiness = $request->targetStatus?->dispatchable() ?? false;
        if (! $request->usageType->requiresDispatchableAsset() && ! $targetRequiresReadiness) {
            return [];
        }

        $conflicts = [];
        if (! $asset->status->dispatchable()) {
            $conflicts[] = new AssetUsageConflict('asset.not_dispatchable', 'The asset is not currently dispatchable.');
        }

        $blockingMaintenanceCount = $asset->maintenanceWorkOrders()
            ->where('dispatch_blocking', true)
            ->whereNull('released_at')
            ->count();
        if ($blockingMaintenanceCount > 0) {
            $conflicts[] = new AssetUsageConflict(
                'asset.maintenance_block',
                'A blocking maintenance item prevents use of the asset.',
                details: ['count' => $blockingMaintenanceCount],
            );
        }

        $hasInspection = $asset->inspections()->exists();
        $hasPassingInspection = $asset->inspections()->where('result', 'passed')->whereNotNull('completed_at')->exists();
        if (($targetRequiresReadiness || $hasInspection) && ! $hasPassingInspection) {
            $conflicts[] = new AssetUsageConflict('asset.inspection_required', 'A completed passing inspection is required before using the asset.');
        }

        return $conflicts;
    }

    /** @return list<AssetUsageConflict> */
    private function rentalReturnRestoreConflicts(OperationalAsset $asset): array
    {
        $conflicts = [];

        if (! in_array($asset->status, [AssetStatus::Assigned, AssetStatus::Available, AssetStatus::ReadyForService], true)) {
            $conflicts[] = new AssetUsageConflict('asset.not_dispatchable', 'The asset is not currently dispatchable.');
        }

        $blockingMaintenanceCount = $asset->maintenanceWorkOrders()
            ->where('dispatch_blocking', true)
            ->whereNull('released_at')
            ->count();
        if ($blockingMaintenanceCount > 0) {
            $conflicts[] = new AssetUsageConflict(
                'asset.maintenance_block',
                'A blocking maintenance item prevents use of the asset.',
                details: ['count' => $blockingMaintenanceCount],
            );
        }

        return $conflicts;
    }
}
