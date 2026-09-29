<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Support\Collection;

final class DispatchResourceRequirements
{
    public const PERSONNEL_TYPES = ['driver', 'crane_operator'];

    public const ASSET_TYPES = ['truck', 'vehicle', 'crane', 'mobile_crane', 'tower_crane', 'equipment'];

    /**
     * @param  Collection<int, mixed>  $personnelAssignments
     * @param  Collection<int, mixed>  $assetAssignments
     * @return list<string>
     */
    public function blockers(DispatchJob $job, Collection $personnelAssignments, Collection $assetAssignments): array
    {
        // Project shifts use their approved plan's requirement slots and readiness checks.
        if ($job->projectShift()->exists()) {
            return [];
        }

        $requirements = $job->resource_requirements;
        if ($requirements === null) {
            return $job->source_type === null
                && $job->canonicalHandoff()->where('source_type', 'manual')->exists()
                    ? ['Record required crew roles and equipment types before activation.']
                    : [];
        }

        return [
            ...$this->groupBlockers($requirements['personnel'] ?? null, $personnelAssignments, self::PERSONNEL_TYPES, 'crew'),
            ...$this->groupBlockers($requirements['assets'] ?? null, $assetAssignments, self::ASSET_TYPES, 'equipment'),
        ];
    }

    /**
     * @param  Collection<int, mixed>  $assignments
     * @param  list<string>  $types
     * @return list<string>
     */
    private function groupBlockers(mixed $quantities, Collection $assignments, array $types, string $label): array
    {
        if (! is_array($quantities)) {
            return ["Record required {$label} types before activation."];
        }
        if (array_diff(array_keys($quantities), $types) !== []) {
            return ['The recorded resource requirements are invalid. Review them before activation.'];
        }

        $blockers = [];
        $total = 0;
        foreach ($types as $type) {
            $quantity = $quantities[$type] ?? 0;
            if (! is_int($quantity) || $quantity < 0 || $quantity > 50) {
                return ['The recorded resource requirements are invalid. Review them before activation.'];
            }

            $total += $quantity;
            if ($quantity === 0) {
                continue;
            }

            $assigned = $assignments->where('assignment_type', $type)->count();
            if ($assigned < $quantity) {
                $name = str_replace('_', ' ', $type);
                $blockers[] = "Requires {$quantity} {$name} {$label}; {$assigned} assigned.";
            }
        }

        if ($total === 0) {
            $blockers[] = "Record at least one required {$label} type before activation.";
        }

        return $blockers;
    }
}
