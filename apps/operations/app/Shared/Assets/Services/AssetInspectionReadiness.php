<?php

namespace App\Shared\Assets\Services;

use App\Modules\Dvir\Models\DvirInspection;
use App\Shared\Assets\Models\Inspection;
use Illuminate\Support\Collection;

final class AssetInspectionReadiness
{
    /**
     * Dispatch requires a completed passing workshop inspection or DVIR. A later
     * failed/defective inspection invalidates prior clearance.
     *
     * @param  Collection<int, Inspection>  $inspections
     */
    public function lacksPassingClearance(Collection $inspections, ?DvirInspection $latestDvir): bool
    {
        $latestLegacy = $inspections
            ->filter(static fn (Inspection $inspection): bool => $inspection->completed_at !== null)
            ->sortByDesc('completed_at')
            ->first();

        if ($latestLegacy === null && $latestDvir === null) {
            return true;
        }

        if ($latestLegacy !== null && ($latestDvir === null || $latestLegacy->completed_at->greaterThanOrEqualTo($latestDvir->completed_at))) {
            return $latestLegacy->result !== 'passed';
        }

        return $latestDvir->has_defects || $latestDvir->critical_defects_count > 0;
    }
}
