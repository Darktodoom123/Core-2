<?php

namespace App\Platform\Safety\Services;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\ModelNotFoundException;

final class SosIncidentContextResolver
{
    /** @return array{job: DispatchJob|null, asset: OperationalAsset|null} */
    public function resolve(User $worker, ?int $jobId = null, ?int $assetId = null): array
    {
        $job = $jobId === null
            ? $this->latestAssignedJob($worker, $assetId)
            : DispatchJob::query()
                ->whereKey($jobId)
                ->whereIn('id', DispatchPersonnelAssignment::query()->active()->where('user_id', $worker->id)->select('dispatch_job_id'))
                ->first();

        if ($jobId !== null && $job === null) {
            throw (new ModelNotFoundException)->setModel(DispatchJob::class, [$jobId]);
        }

        $asset = null;
        if ($assetId !== null) {
            if ($job === null || ! $job->assetAssignments()->active()->where('operational_asset_id', $assetId)->exists()) {
                throw (new ModelNotFoundException)->setModel(OperationalAsset::class, [$assetId]);
            }

            $asset = OperationalAsset::query()->find($assetId);
            if ($asset === null) {
                throw (new ModelNotFoundException)->setModel(OperationalAsset::class, [$assetId]);
            }
        }

        return ['job' => $job, 'asset' => $asset];
    }

    private function latestAssignedJob(User $worker, ?int $assetId): ?DispatchJob
    {
        $query = DispatchPersonnelAssignment::query()
            ->active()
            ->where('user_id', $worker->id)
            ->when($assetId !== null, function ($query) use ($assetId): void {
                $query->whereIn('dispatch_job_id', DispatchAssetAssignment::query()
                    ->active()
                    ->where('operational_asset_id', $assetId)
                    ->select('dispatch_job_id'));
            })
            ->latest('id');

        $assignment = $query->first();

        return $assignment?->job;
    }
}
