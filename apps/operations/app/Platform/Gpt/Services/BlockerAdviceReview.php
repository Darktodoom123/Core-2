<?php

namespace App\Platform\Gpt\Services;

use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Throwable;

final class BlockerAdviceReview
{
    public function __construct(
        private readonly BlockerResolutionContextBuilder $contexts,
        private readonly DispatchResourceEligibility $eligibility,
        private readonly RecordGptOperationalMetric $metrics,
    ) {}

    /** @return array<string, mixed>|null */
    public function prefill(User $actor, DispatchJob $job, int $adviceId, int $optionId): ?array
    {
        $rec = GptRecommendation::query()->find($adviceId);
        if ($rec === null || $rec->purpose !== 'dispatch_blocker_resolution'
            || $rec->subject_id !== $job->id || $rec->status !== GptRecommendationStatus::PendingReview
            || $rec->isExpired() || Gate::forUser($actor)->denies('view', $rec)) {
            return null;
        }
        $context = $this->contexts->buildForDispatchJob($job);
        if ($context === null || $rec->context_hash !== $context['context_hash']) {
            return null;
        }
        $option = null;
        foreach ($context['context']['options'] as $candidateOption) {
            if (is_array($candidateOption) && ($candidateOption['id'] ?? null) === $optionId) {
                $option = $candidateOption;
                break;
            }
        }
        $blocker = $context['context']['blocker'];
        if (! is_array($option) || Gate::forUser($actor)->denies($blocker['action'] === 'reassign' ? 'reassignResources' : 'assignResources', $job)) {
            return null;
        }

        if ($option['resource_kind'] === 'personnel') {
            $candidate = User::query()->with(['roles:id,name', 'personnelProfile', 'personnelCredentials', 'dispatchAssignments.job'])->find($option['candidate_id']);
            if (! $candidate instanceof User) {
                return null;
            }
            $assessment = $this->eligibility->personnel($candidate, $option['assignment_type'], $job);
            if (! $assessment['eligible']) {
                return null;
            }
            $preview = [
                'id' => (int) $candidate->id,
                'name' => $candidate->name,
                'assignment_type' => $option['assignment_type'],
                'assignment_label' => $this->eligibility->personnelAssignmentLabel($option['assignment_type']),
                ...$assessment,
            ];
        } else {
            $candidate = OperationalAsset::query()->with(['maintenanceWorkOrders', 'inspections'])->find($option['candidate_id']);
            if (! $candidate instanceof OperationalAsset) {
                return null;
            }
            $assessment = $this->eligibility->asset($candidate, $option['assignment_type'], $job, $blocker['replace_assignment_id'] === null ? [] : [$blocker['replace_assignment_id']]);
            if (! $assessment['eligible']) {
                return null;
            }
            $preview = [
                'id' => (int) $candidate->id,
                'code' => $candidate->code,
                'name' => $candidate->name,
                'assignment_type' => $option['assignment_type'],
                'assignment_label' => $this->eligibility->assetAssignmentLabel($option['assignment_type']),
                ...$assessment,
            ];
        }

        try {
            if (Cache::add("gpt_blocker_review:{$rec->id}:{$actor->id}:{$optionId}", true, now()->addMinutes(15))) {
                $this->metrics->handle($rec, 'review_opened');
            }
        } catch (Throwable $exception) {
            Log::warning('Dispatch blocker review metric failed.', ['error' => $exception::class]);
        }

        return [
            'advice_id' => (int) $rec->id,
            'option_id' => $optionId,
            'action' => $blocker['action'],
            'resource_kind' => $option['resource_kind'],
            'replace_assignment_id' => $blocker['replace_assignment_id'],
            'candidate' => $preview,
        ];
    }
}
