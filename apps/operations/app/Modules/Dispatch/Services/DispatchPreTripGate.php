<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dvir\Enums\DvirInspectionType;
use App\Modules\Dvir\Models\DvirInspection;
use App\Shared\Assets\Models\OperationalAsset;

final class DispatchPreTripGate
{
    /** @return list<string> */
    public function missingAssetCodes(DispatchJob $job): array
    {
        $assignments = $job->assetAssignments()
            ->whereNull('active_until')
            ->orderBy('id')
            ->get();
        $assetCodes = OperationalAsset::query()
            ->withTrashed()
            ->whereIn('id', $assignments->pluck('operational_asset_id'))
            ->pluck('code', 'id');
        $missing = [];

        foreach ($assignments as $assignment) {
            $inspection = DvirInspection::query()
                ->where('dispatch_job_id', $job->id)
                ->where('operational_asset_id', $assignment->operational_asset_id)
                ->where('inspection_type', DvirInspectionType::PRE_TRIP->value)
                ->whereNotNull('completed_at')
                ->when($job->activated_at !== null, fn ($query) => $query
                    ->where('completed_at', '>=', $job->activated_at)
                    ->where('created_at', '>=', $job->activated_at))
                ->orderByDesc('completed_at')
                ->orderByDesc('id')
                ->first();

            if ($inspection === null || ! $inspection->signature_captured || $inspection->has_defects || $inspection->critical_defects_count > 0) {
                $missing[] = $assetCodes->get($assignment->operational_asset_id) ?? "Asset #{$assignment->operational_asset_id}";
            }
        }

        return $missing;
    }
}
