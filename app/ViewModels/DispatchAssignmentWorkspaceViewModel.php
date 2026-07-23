<?php

namespace App\ViewModels;

use App\Models\DispatchJob;
use App\Models\OperationalAsset;
use App\Models\User;
use App\Services\DispatchResourceEligibility;
use Illuminate\Support\Collection;

final class DispatchAssignmentWorkspaceViewModel
{
    /**
     * @param  Collection<int, User>  $users
     * @return list<array<string, mixed>>
     */
    public static function personnelCandidates(
        Collection $users,
        DispatchJob $job,
        DispatchResourceEligibility $eligibility,
    ): array {
        return array_values($users
            ->map(static function (User $user) use ($job, $eligibility): ?array {
                $assignmentType = $eligibility->personnelAssignmentType($user);
                if ($assignmentType === null) {
                    return null;
                }

                return [
                    'id' => (int) $user->getKey(),
                    'name' => $user->name,
                    'assignment_type' => $assignmentType,
                    'assignment_label' => $eligibility->personnelAssignmentLabel($assignmentType),
                    ...$eligibility->personnel($user, $assignmentType, $job),
                ];
            })
            ->filter()
            ->values()
            ->all());
    }

    /**
     * @param  Collection<int, OperationalAsset>  $assets
     * @return list<array<string, mixed>>
     */
    public static function assetCandidates(
        Collection $assets,
        DispatchJob $job,
        DispatchResourceEligibility $eligibility,
    ): array {
        return array_values($assets
            ->map(static fn (OperationalAsset $asset): array => [
                'id' => (int) $asset->getKey(),
                'code' => $asset->code,
                'name' => $asset->name,
                'assignment_type' => $asset->kind,
                'assignment_label' => $eligibility->assetAssignmentLabel($asset->kind),
                ...$eligibility->asset($asset, $asset->kind, $job),
            ])
            ->values()
            ->all());
    }
}
