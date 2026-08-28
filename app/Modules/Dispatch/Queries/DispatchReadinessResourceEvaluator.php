<?php

namespace App\Modules\Dispatch\Queries;

use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Data\DispatchReadinessBlocker;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchReadinessBlockerCode;
use App\Modules\Dispatch\Enums\DispatchReadinessSeverity;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchPlanRequirementSlot;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\PersonnelProfile;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Data\AssetUsageRequest;
use App\Shared\Assets\Data\AssetUsageSource;
use App\Shared\Assets\Enums\AssetUsageType;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Services\OperationalAssetAvailability;
use Illuminate\Database\Eloquent\Collection;

final class DispatchReadinessResourceEvaluator
{
    public function __construct(private readonly OperationalAssetAvailability $availability) {}

    /**
     * @param  Collection<int, DispatchAssignmentOffer>  $offers
     * @return list<DispatchReadinessBlocker>
     */
    public function evaluate(
        DispatchExecutionAttempt $attempt,
        ?DispatchPlanVersion $plan,
        Collection $offers,
        bool $lock = false,
    ): array {
        if ($plan === null || ! (bool) config('dispatch.phase3_commands_enabled', true)) {
            return [];
        }

        $blockers = [];
        $requirements = $this->personnelRequirements($plan);
        $acceptedOffers = $offers->filter(static fn (DispatchAssignmentOffer $offer): bool => $offer->status === DispatchAssignmentOfferStatus::Accepted);
        $relevantOffers = $acceptedOffers->values();

        $missingRequirements = [];
        $pendingOfferIds = [];
        foreach ($requirements as $requirement) {
            if (! $requirement['mandatory']) {
                continue;
            }

            $matching = $offers->filter(function (DispatchAssignmentOffer $offer) use ($requirement): bool {
                if ($offer->assignment_type !== $requirement['assignment_type']) {
                    return false;
                }

                return $requirement['user_id'] === null || (int) $offer->user_id === $requirement['user_id'];
            });

            if ($matching->isEmpty()) {
                $missingRequirements[] = [
                    'slot' => $requirement['slot_key'],
                    'assignment_type' => $requirement['assignment_type'],
                ];
            } elseif (! $matching->contains(static fn (DispatchAssignmentOffer $offer): bool => $offer->status === DispatchAssignmentOfferStatus::Accepted)) {
                $pendingOfferIds = [...$pendingOfferIds, ...$matching->modelKeys()];
            }
        }

        foreach ($offers->where('is_mandatory', true) as $offer) {
            if ($this->hasMatchingRequirement($offer, $requirements)) {
                continue;
            }

            if ($offer->status !== DispatchAssignmentOfferStatus::Accepted) {
                $pendingOfferIds[] = $offer->id;
            }
        }

        if ($missingRequirements !== []) {
            $blockers[] = $this->blocking(DispatchReadinessBlockerCode::MissingMandatoryAssignment, ['requirements' => $missingRequirements], $plan->version, $attempt->version);
        }
        if ($pendingOfferIds !== []) {
            $blockers[] = $this->blocking(DispatchReadinessBlockerCode::PendingMandatoryAcceptance, ['offer_ids' => array_values(array_unique($pendingOfferIds))], $plan->version, $attempt->version);
        }

        $blockers = [...$blockers, ...$this->personnelBlockers($attempt, $plan, $relevantOffers, $lock)];
        $blockers = [...$blockers, ...$this->assetBlockers($attempt, $plan, $lock)];

        return $blockers;
    }

    /**
     * @return list<array{slot_key: string, assignment_type: string, mandatory: bool, user_id: int|null}>
     */
    private function personnelRequirements(DispatchPlanVersion $plan): array
    {
        $slots = $plan->requirementSlots()
            ->where('kind', 'personnel')
            ->orderBy('id')
            ->get();

        if ($slots->isNotEmpty()) {
            return array_values($slots->map(static fn (DispatchPlanRequirementSlot $slot): array => [
                'slot_key' => (string) $slot->slot_key,
                'assignment_type' => (string) $slot->assignment_type,
                'mandatory' => (bool) $slot->is_mandatory,
                'user_id' => $slot->user_id === null ? null : (int) $slot->user_id,
            ])->all());
        }

        $raw = $plan->snapshot['mandatory_assignments'] ?? [];
        if (! is_array($raw)) {
            return [];
        }

        $requirements = [];
        foreach ($raw as $key => $value) {
            if (is_string($value)) {
                $requirements[] = ['slot_key' => $value, 'assignment_type' => $value, 'mandatory' => true, 'user_id' => null];

                continue;
            }
            if (! is_array($value)) {
                continue;
            }

            $assignmentType = $value['assignment_type'] ?? $value['type'] ?? $value['slot'] ?? null;
            if (! is_string($assignmentType) || $assignmentType === '') {
                continue;
            }
            $requirements[] = [
                'slot_key' => is_string($value['slot'] ?? null) ? $value['slot'] : (string) $key,
                'assignment_type' => $assignmentType,
                'mandatory' => (bool) ($value['is_mandatory'] ?? true),
                'user_id' => is_numeric($value['user_id'] ?? null) ? (int) $value['user_id'] : null,
            ];
        }

        return $requirements;
    }

    /** @param list<array{slot_key: string, assignment_type: string, mandatory: bool, user_id: int|null}> $requirements */
    private function hasMatchingRequirement(DispatchAssignmentOffer $offer, array $requirements): bool
    {
        foreach ($requirements as $requirement) {
            if ($requirement['assignment_type'] === $offer->assignment_type
                && ($requirement['user_id'] === null || $requirement['user_id'] === (int) $offer->user_id)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  Collection<int, DispatchAssignmentOffer>  $offers
     * @return list<DispatchReadinessBlocker>
     */
    private function personnelBlockers(
        DispatchExecutionAttempt $attempt,
        DispatchPlanVersion $plan,
        Collection $offers,
        bool $lock,
    ): array {
        if ($offers->isEmpty()) {
            return [];
        }

        $userIds = $offers->pluck('user_id')->map(static fn (mixed $id): int => (int) $id)->unique()->sort()->values()->all();
        $query = User::query()->whereIn('id', $userIds)->orderBy('id');
        if ($lock) {
            $query->lockForUpdate();
        }
        $users = $query->with([
            'roles:id,name',
            'personnelProfile',
            'personnelCredentials',
            'dispatchAssignments' => fn ($assignmentQuery) => $assignmentQuery->whereNull('active_until')->with('job'),
        ])->get()->keyBy('id');

        $blockers = [];
        foreach ($offers as $offer) {
            $user = $users->get($offer->user_id);
            if (! $user instanceof User) {
                $blockers[] = $this->personnelBlocker(DispatchReadinessBlockerCode::PersonnelAccountInactive, $offer, ['user_id' => $offer->user_id, 'missing' => true], $plan, $attempt);

                continue;
            }

            $assignmentType = (string) $offer->assignment_type;
            if (! $this->hasRequiredRole($user, $assignmentType)) {
                $blockers[] = $this->personnelBlocker(DispatchReadinessBlockerCode::PersonnelRoleIneligible, $offer, ['user_id' => $user->id, 'assignment_type' => $assignmentType], $plan, $attempt);
            }
            if (! $user->is_active) {
                $blockers[] = $this->personnelBlocker(DispatchReadinessBlockerCode::PersonnelAccountInactive, $offer, ['user_id' => $user->id], $plan, $attempt);
            }
            if ($user->suspended_at !== null) {
                $blockers[] = $this->personnelBlocker(DispatchReadinessBlockerCode::PersonnelSuspended, $offer, ['user_id' => $user->id], $plan, $attempt);
            }

            $profile = $user->getRelationValue('personnelProfile');
            if ($profile instanceof PersonnelProfile && in_array($profile->availability_status, ['unavailable', 'on_leave'], true)) {
                $blockers[] = $this->personnelBlocker(DispatchReadinessBlockerCode::PersonnelUnavailable, $offer, ['user_id' => $user->id, 'availability' => $profile->availability_status], $plan, $attempt);
            }

            $credentialKind = $this->credentialKind($user, $assignmentType);
            if ($credentialKind !== null) {
                $credentials = $user->personnelCredentials->where('kind', $credentialKind);
                $at = $plan->scheduled_start ?? $attempt->scheduled_start ?? now();
                $valid = $credentials->first(static fn (PersonnelCredential $credential): bool => $credential->status === 'active'
                    && ($credential->issued_at === null || $credential->issued_at->lte($at))
                    && ($credential->expires_at === null || $credential->expires_at->gte($at->toDateString())));
                if (! $valid instanceof PersonnelCredential) {
                    $code = $credentials->isEmpty()
                        ? DispatchReadinessBlockerCode::PersonnelCredentialMissing
                        : DispatchReadinessBlockerCode::PersonnelCredentialInvalid;
                    $blockers[] = $this->personnelBlocker($code, $offer, ['user_id' => $user->id, 'credential_kind' => $credentialKind], $plan, $attempt);
                }
            }

            foreach ($user->dispatchAssignments as $assignment) {
                if ($this->assignmentConflicts($assignment, $attempt)) {
                    $blockers[] = $this->personnelBlocker(
                        DispatchReadinessBlockerCode::PersonnelConflict,
                        $offer,
                        ['user_id' => $user->id, 'conflicting_assignment_id' => $assignment->id],
                        $plan,
                        $attempt,
                    );
                    break;
                }
            }
        }

        return $blockers;
    }

    private function hasRequiredRole(User $user, string $assignmentType): bool
    {
        return match ($assignmentType) {
            'crane_operator', 'operator', 'lead', 'driver' => $user->hasRole(RoleName::CraneOperator->value),
            default => false,
        };
    }

    private function credentialKind(User $user, string $assignmentType): ?string
    {
        return match ($assignmentType) {
            'driver' => 'driver_license',
            'crane_operator' => 'operator_certification',
            'lead' => null,
            default => null,
        };
    }

    private function assignmentConflicts(DispatchPersonnelAssignment $assignment, DispatchExecutionAttempt $attempt): bool
    {
        $job = $assignment->job;
        if ($job->id === $attempt->legacy_dispatch_job_id) {
            return false;
        }
        if ($attempt->scheduled_start === null || $attempt->scheduled_end === null || $job->scheduled_start === null || $job->scheduled_end === null) {
            return true;
        }

        return $job->scheduled_start->lt($attempt->scheduled_end) && $job->scheduled_end->gt($attempt->scheduled_start);
    }

    /** @return list<DispatchReadinessBlocker> */
    private function assetBlockers(DispatchExecutionAttempt $attempt, DispatchPlanVersion $plan, bool $lock): array
    {
        $requirements = $this->assetRequirements($plan);
        if ($requirements === []) {
            return [];
        }

        $blockers = [];
        $assetIds = collect($requirements)
            ->filter(static fn (array $requirement): bool => $requirement['mandatory'] && $requirement['asset_id'] !== null)
            ->pluck('asset_id')
            ->map(static fn (mixed $id): int => (int) $id)
            ->unique()
            ->sort()
            ->values()
            ->all();
        $assets = new Collection;
        if ($assetIds !== []) {
            $query = OperationalAsset::query()->withTrashed()->whereIn('id', $assetIds)->orderBy('id');
            if ($lock) {
                $query->lockForUpdate();
            }
            $assets = $query->with(['maintenanceWorkOrders', 'inspections'])->get()->keyBy('id');
        }

        foreach ($requirements as $requirement) {
            if (! $requirement['mandatory']) {
                continue;
            }
            $id = $requirement['asset_id'];
            if ($id === null) {
                if ($requirement['available'] === false) {
                    $blockers[] = $this->assetBlocker(DispatchReadinessBlockerCode::AssetUnavailable, $requirement, ['available' => false], $plan, $attempt);
                }
                if ($requirement['safe'] === false) {
                    $blockers[] = $this->assetBlocker(DispatchReadinessBlockerCode::AssetUnsafe, $requirement, ['safe' => false], $plan, $attempt);
                }

                continue;
            }

            $asset = $assets->get($id);
            if (! $asset instanceof OperationalAsset || $asset->trashed()) {
                $blockers[] = $this->assetBlocker(DispatchReadinessBlockerCode::AssetUnavailable, $requirement, ['asset_id' => $id, 'missing' => true], $plan, $attempt);

                continue;
            }
            if (! $asset->status->dispatchable()) {
                $blockers[] = $this->assetBlocker(DispatchReadinessBlockerCode::AssetUnsafe, $requirement, ['asset_id' => $id, 'status' => $asset->status->value], $plan, $attempt);
            }
            if ($asset->maintenanceWorkOrders->contains(static fn ($workOrder): bool => (bool) $workOrder->dispatch_blocking && $workOrder->released_at === null)) {
                $blockers[] = $this->assetBlocker(DispatchReadinessBlockerCode::AssetUnsafe, $requirement, ['asset_id' => $id, 'reason' => 'maintenance_block'], $plan, $attempt);
            }
            if ($asset->inspections->isNotEmpty() && ! $asset->inspections->contains(static fn ($inspection): bool => $inspection->result === 'passed' && $inspection->completed_at !== null)) {
                $blockers[] = $this->assetBlocker(DispatchReadinessBlockerCode::AssetUnsafe, $requirement, ['asset_id' => $id, 'reason' => 'inspection_required'], $plan, $attempt);
            }
        }

        foreach ($assetIds as $assetId) {
            $request = AssetUsageRequest::dispatch(
                $assetId,
                AssetUsageType::DispatchActivate,
                $attempt->scheduled_start !== null && $attempt->scheduled_end !== null ? $attempt->scheduled_start->toImmutable() : null,
                $attempt->scheduled_start !== null && $attempt->scheduled_end !== null ? $attempt->scheduled_end->toImmutable() : null,
                $attempt->legacy_dispatch_job_id === null ? null : new AssetUsageSource('dispatch_job', (int) $attempt->legacy_dispatch_job_id),
            );
            foreach ($this->availability->assess($request)->conflicts as $conflict) {
                if (in_array($conflict->code, ['asset.not_found', 'asset.deleted', 'asset.not_dispatchable', 'asset.maintenance_block', 'asset.inspection_required'], true)) {
                    continue;
                }
                $blockers[] = $this->assetBlocker(
                    str_contains($conflict->code, 'overlap') || str_contains($conflict->code, 'committed')
                        ? DispatchReadinessBlockerCode::AssetConflict
                        : DispatchReadinessBlockerCode::AssetUnavailable,
                    ['asset_id' => $assetId, 'mandatory' => true],
                    ['asset_id' => $assetId, 'conflict_code' => $conflict->code, 'source' => $conflict->source?->aggregateType],
                    $plan,
                    $attempt,
                );
            }
        }

        return $blockers;
    }

    /** @return list<array{asset_id: int|null, mandatory: bool, available: bool|null, safe: bool|null}> */
    private function assetRequirements(DispatchPlanVersion $plan): array
    {
        $slots = $plan->requirementSlots()->where('kind', 'asset')->orderBy('id')->get();
        if ($slots->isNotEmpty()) {
            return array_values($slots->map(static fn (DispatchPlanRequirementSlot $slot): array => [
                'asset_id' => $slot->operational_asset_id === null ? null : (int) $slot->operational_asset_id,
                'mandatory' => (bool) $slot->is_mandatory,
                'available' => null,
                'safe' => null,
            ])->all());
        }

        $raw = $plan->snapshot['assets'] ?? [];
        if (! is_array($raw)) {
            return [];
        }
        $requirements = [];
        foreach ($raw as $value) {
            if (! is_array($value)) {
                continue;
            }
            $requirements[] = [
                'asset_id' => is_numeric($value['asset_id'] ?? $value['operational_asset_id'] ?? $value['id'] ?? null)
                    ? (int) ($value['asset_id'] ?? $value['operational_asset_id'] ?? $value['id'])
                    : null,
                'mandatory' => (bool) ($value['is_mandatory'] ?? true),
                'available' => array_key_exists('available', $value) ? (bool) $value['available'] : null,
                'safe' => array_key_exists('safe', $value) ? (bool) $value['safe'] : null,
            ];
        }

        return $requirements;
    }

    /** @param array<string, mixed> $evidence */
    private function personnelBlocker(DispatchReadinessBlockerCode $code, DispatchAssignmentOffer $offer, array $evidence, DispatchPlanVersion $plan, DispatchExecutionAttempt $attempt): DispatchReadinessBlocker
    {
        return $this->blocking($code, [...$evidence, 'offer_id' => $offer->id, 'assignment_type' => $offer->assignment_type], $plan->version, $attempt->version);
    }

    /**
     * @param  array<string, mixed>  $requirement
     * @param  array<string, mixed>  $evidence
     */
    private function assetBlocker(DispatchReadinessBlockerCode $code, array $requirement, array $evidence, DispatchPlanVersion $plan, DispatchExecutionAttempt $attempt): DispatchReadinessBlocker
    {
        return $this->blocking($code, [...$evidence, 'asset_id' => $requirement['asset_id'] ?? null], $plan->version, $attempt->version);
    }

    /** @param array<string, mixed> $evidence */
    private function blocking(DispatchReadinessBlockerCode $code, array $evidence, int $planVersion, int $attemptVersion): DispatchReadinessBlocker
    {
        return new DispatchReadinessBlocker($code, DispatchReadinessSeverity::Blocking, 'dispatch.readiness.'.$code->value, $evidence, $planVersion, $attemptVersion);
    }
}
