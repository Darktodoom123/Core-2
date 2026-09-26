<?php

namespace App\Platform\Gpt\Services;

use App\Modules\Assignment\Queries\DispatchActivationReadinessQuery;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\Log;
use Throwable;

final class BlockerAdviceAttribution
{
    public function __construct(
        private readonly BlockerAdviceReview $review,
        private readonly GptRecommendationTransition $transitions,
        private readonly RecordGptOperationalMetric $metrics,
        private readonly BlockerResolutionContextBuilder $contexts,
        private readonly DispatchActivationReadinessQuery $readiness,
    ) {}

    /**
     * Capture the valid proposal before the domain command changes the job.
     * An invalid advice reference has no effect on a manual assignment.
     *
     * @return array<string, mixed>|null
     */
    public function before(User $actor, DispatchJob $job, ?int $adviceId, ?int $optionId): ?array
    {
        return $adviceId !== null && $optionId !== null
            ? $this->review->prefill($actor, $job, $adviceId, $optionId)
            : null;
    }

    /** @param array<string, mixed>|null $proposal
     * @param  list<array<string, mixed>>  $personnel
     * @param  list<array<string, mixed>>  $assets
     * @param  list<int>  $endedPersonnel
     * @param  list<int>  $endedAssets
     */
    public function after(User $actor, DispatchJob $job, ?array $proposal, string $action, array $personnel, array $assets, array $endedPersonnel = [], array $endedAssets = [], bool $applied = true): void
    {
        if ($proposal === null || $proposal['action'] !== $action) {
            return;
        }

        try {
            $candidate = $proposal['candidate'];
            $id = (int) $candidate['id'];
            $type = $candidate['assignment_type'];
            $matches = $proposal['resource_kind'] === 'personnel'
                ? collect($personnel)->contains(fn (array $row): bool => (int) ($row['user_id'] ?? 0) === $id && ($row['assignment_type'] ?? null) === $type)
                : collect($assets)->contains(fn (array $row): bool => (int) ($row['operational_asset_id'] ?? 0) === $id && ($row['assignment_type'] ?? null) === $type);
            if ($action === 'reassign') {
                $matches = $matches && in_array((int) $proposal['replace_assignment_id'], $proposal['resource_kind'] === 'personnel' ? $endedPersonnel : $endedAssets, true);
            }

            $to = $matches && $applied ? GptRecommendationStatus::Accepted : GptRecommendationStatus::Stale;
            if ($this->transitions->compareAndSet($proposal['advice_id'], GptRecommendationStatus::PendingReview, $to, [
                'decided_by' => $actor->id,
                'decided_at' => now(),
            ])) {
                $rec = GptRecommendation::query()->find((int) $proposal['advice_id']);
                if ($rec !== null) {
                    $this->metrics->handle($rec, ! $applied ? 'submitted_for_approval' : ($matches ? 'adopted' : 'edited_after_review'));
                    if ($applied) {
                        $current = $this->contexts->buildForDispatchJob($job);
                        $currentBlocker = $current['context']['blocker'] ?? null;
                        if ($currentBlocker === null
                            || $currentBlocker['code'] !== ($rec->recommendation['blocker']['code'] ?? null)
                            || $currentBlocker['replace_assignment_id'] !== $proposal['replace_assignment_id']) {
                            $this->metrics->handle($rec, 'blocker_resolved');
                        }
                        $freshJob = $job->fresh()?->load(['personnelAssignments.user', 'assetAssignments.asset', 'approvals']);
                        if ($freshJob !== null && $this->readiness->make($freshJob)['ready']) {
                            $this->metrics->handle($rec, 'job_ready');
                        }
                    }
                }
            }
        } catch (Throwable $exception) {
            Log::warning('Dispatch blocker advice attribution failed.', ['error' => $exception::class]);
        }
    }
}
