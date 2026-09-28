<?php

namespace App\Shared\Assets\Services;

use App\Modules\Dvir\Models\DvirInspection;
use App\Shared\Assets\Models\Inspection;
use Illuminate\Support\Collection;

final class AssetInspectionReadiness
{
    /**
     * Activation requires a completed passing workshop inspection. A clean DVIR
     * cannot establish or restore workshop clearance, while a later defective
     * DVIR invalidates it until a subsequent passing workshop inspection.
     *
     * @param  Collection<int, Inspection>  $inspections
     */
    public function lacksPassingClearance(Collection $inspections, ?DvirInspection $latestDvir): bool
    {
        $latestLegacy = $inspections
            ->filter(static fn (Inspection $inspection): bool => $inspection->completed_at !== null)
            ->sortByDesc('completed_at')
            ->first();

        if ($latestLegacy === null || $latestLegacy->result !== 'passed') {
            return true;
        }

        return $latestDvir !== null
            && $latestDvir->completed_at->greaterThan($latestLegacy->completed_at)
            && ($latestDvir->has_defects || $latestDvir->critical_defects_count > 0);
    }

    /**
     * Planning can include an asset awaiting its first workshop inspection,
     * but must reject one with recorded failed or defective safety evidence.
     *
     * @param  Collection<int, Inspection>  $inspections
     */
    public function hasUnsafeEvidence(Collection $inspections, ?DvirInspection $latestDvir): bool
    {
        $latestLegacy = $inspections
            ->filter(static fn (Inspection $inspection): bool => $inspection->completed_at !== null)
            ->sortByDesc('completed_at')
            ->first();

        if ($latestLegacy !== null && $latestLegacy->result !== 'passed') {
            return true;
        }

        return $latestDvir !== null
            && ($latestLegacy === null || $latestDvir->completed_at->greaterThan($latestLegacy->completed_at))
            && ($latestDvir->has_defects || $latestDvir->critical_defects_count > 0);
    }
}
