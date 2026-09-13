<?php

namespace App\Platform\Gpt\Actions;

use App\Modules\Assignment\Actions\AssignDispatchResources;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Gpt\Services\GptRecommendationTransition;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class AcceptGptRecommendation
{
    public function __construct(
        private AssignDispatchResources $assignAction,
        private BoundedContextBuilder $contextBuilder,
        private RecordAuditEvent $audit,
        private GptRecommendationTransition $transitions,
    ) {}

    /**
     * @param  array<mixed>|null  $selectedPersonnel
     * @param  array<mixed>|null  $selectedAssets
     */
    public function handle(
        User $actor,
        GptRecommendation $recommendation,
        ?array $selectedPersonnel = null,
        ?array $selectedAssets = null,
    ): DispatchJob {
        Gate::forUser($actor)->authorize('decide', $recommendation);

        /** @var DispatchJob|array{message: string} $result */
        $result = DB::transaction(function () use ($actor, $recommendation, $selectedPersonnel, $selectedAssets): DispatchJob|array {
            /** @var GptRecommendation $lockedRecommendation */
            $lockedRecommendation = GptRecommendation::query()->lockForUpdate()->findOrFail($recommendation->id);

            if (! in_array($lockedRecommendation->subject_type, [DispatchJob::class, (new DispatchJob)->getMorphClass()], true)) {
                return ['message' => 'Recommendation subject is not a dispatch job.'];
            }

            $job = DispatchJob::query()->lockForUpdate()->find($lockedRecommendation->subject_id);
            if ($job === null) {
                return ['message' => 'Recommendation subject is not a dispatch job.'];
            }

            // All mutable preconditions are deliberately evaluated after both locks.
            // Reload the actor after the row locks. A privilege revoked while
            // this request waited must fail closed instead of relying on a
            // stale in-memory permission relationship.
            $lockedActor = User::query()->findOrFail($actor->id);
            Gate::forUser($lockedActor)->authorize('decide', $lockedRecommendation);

            if ($lockedRecommendation->status !== GptRecommendationStatus::PendingReview) {
                return ['message' => "Recommendation cannot be accepted in status '{$lockedRecommendation->status->value}'."];
            }

            if ($lockedRecommendation->isExpired()) {
                $this->transitions->transitionLocked($lockedRecommendation, GptRecommendationStatus::Expired);

                return ['message' => 'This GPT recommendation has expired (valid for 15 minutes). Please generate a fresh recommendation.'];
            }

            // Rebuild from the locked dispatch to verify context and version atomically.
            $currentContext = $this->contextBuilder->buildForDispatchJob($job);
            if ($lockedRecommendation->isStale($currentContext['context_hash'])) {
                $this->transitions->transitionLocked($lockedRecommendation, GptRecommendationStatus::Stale);

                return ['message' => 'The underlying dispatch context has changed since this recommendation was generated. Please generate a fresh recommendation.'];
            }

            $rawPayload = $lockedRecommendation->recommendation;
            if (! is_array($rawPayload)) {
                throw ValidationException::withMessages([
                    'gpt' => 'Recommendation payload contains invalid assignment structure.',
                ]);
            }

            $rawPersonnel = is_array($rawPayload['proposed_personnel'] ?? null) ? $rawPayload['proposed_personnel'] : [];
            /** @var list<array{user_id: int, assignment_type: string}> $personnel */
            $personnel = array_values(array_filter(array_map(static function (mixed $p): ?array {
                $id = is_array($p) ? (int) ($p['user_id'] ?? 0) : (is_numeric($p) ? (int) $p : 0);
                if ($id <= 0) {
                    return null;
                }

                return [
                    'user_id' => $id,
                    'assignment_type' => is_array($p) && ! empty($p['assignment_type']) ? (string) $p['assignment_type'] : 'crew',
                ];
            }, $rawPersonnel)));

            $rawAssets = is_array($rawPayload['proposed_assets'] ?? null) ? $rawPayload['proposed_assets'] : [];
            /** @var list<array{operational_asset_id: int, assignment_type: string}> $assets */
            $assets = array_values(array_filter(array_map(static function (mixed $a): ?array {
                $id = is_array($a) ? (int) ($a['operational_asset_id'] ?? $a['asset_id'] ?? 0) : (is_numeric($a) ? (int) $a : 0);
                if ($id <= 0) {
                    return null;
                }

                return [
                    'operational_asset_id' => $id,
                    'assignment_type' => is_array($a) && ! empty($a['assignment_type']) ? (string) $a['assignment_type'] : 'equipment',
                ];
            }, $rawAssets)));

            $proposedPersonnelIds = array_column($personnel, 'user_id');
            $proposedAssetIds = array_column($assets, 'operational_asset_id');

            if ($selectedPersonnel !== null) {
                $normalizedPersonnelIds = array_values(array_map(static function (mixed $p): int {
                    $id = is_array($p) ? ($p['user_id'] ?? 0) : $p;

                    return is_numeric($id) ? (int) $id : 0;
                }, $selectedPersonnel));

                foreach ($normalizedPersonnelIds as $id) {
                    if (! in_array($id, $proposedPersonnelIds, true)) {
                        throw ValidationException::withMessages([
                            'selected_personnel_ids' => "Personnel ID {$id} was not proposed in this recommendation.",
                        ]);
                    }
                }

                $personnel = array_values(array_filter(
                    $personnel,
                    static fn (array $p): bool => in_array($p['user_id'], $normalizedPersonnelIds, true)
                ));
            }

            if ($selectedAssets !== null) {
                $normalizedAssetIds = array_values(array_map(static function (mixed $a): int {
                    $id = is_array($a) ? ($a['operational_asset_id'] ?? $a['asset_id'] ?? 0) : $a;

                    return is_numeric($id) ? (int) $id : 0;
                }, $selectedAssets));

                foreach ($normalizedAssetIds as $id) {
                    if (! in_array($id, $proposedAssetIds, true)) {
                        throw ValidationException::withMessages([
                            'selected_asset_ids' => "Asset ID {$id} was not proposed in this recommendation.",
                        ]);
                    }
                }

                $assets = array_values(array_filter(
                    $assets,
                    static fn (array $a): bool => in_array($a['operational_asset_id'], $normalizedAssetIds, true)
                ));
            }

            $selectedCount = count($personnel) + count($assets);
            if (($selectedPersonnel !== null || $selectedAssets !== null)
                && ($proposedPersonnelIds !== [] || $proposedAssetIds !== [])
                && $selectedCount === 0) {
                throw ValidationException::withMessages([
                    'resources' => 'At least one proposed resource must be selected.',
                ]);
            }

            // Execute operational mutation via the normal domain action under human authority if resources are proposed
            if ($selectedCount > 0) {
                $this->assignAction->handle($lockedActor, $job, $personnel, $assets, $job->version);
            }

            $this->transitions->transitionLocked($lockedRecommendation, GptRecommendationStatus::Accepted, [
                'decided_by' => $lockedActor->id,
                'decided_at' => now(),
            ]);

            $this->audit->handle(
                $lockedActor,
                $job,
                'gpt.recommendation_accepted',
                null,
                [
                    'recommendation_id' => $lockedRecommendation->id,
                    'purpose' => $lockedRecommendation->purpose,
                    'model' => $lockedRecommendation->model,
                    'personnel_count' => count($personnel),
                    'assets_count' => count($assets),
                    'assigned_user_ids' => array_column($personnel, 'user_id'),
                    'assigned_asset_ids' => array_column($assets, 'operational_asset_id'),
                ]
            );

            return $job->fresh() ?? $job;
        });

        if (is_array($result)) {
            throw ValidationException::withMessages(['gpt' => $result['message']]);
        }

        return $result;
    }
}
