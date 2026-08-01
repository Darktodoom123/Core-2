<?php

namespace App\Platform\Gpt\Actions;

use App\Modules\Assignment\Actions\AssignDispatchResources;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class AcceptGptRecommendation
{
    public function __construct(
        private AssignDispatchResources $assignAction,
        private BoundedContextBuilder $contextBuilder,
        private RecordAuditEvent $audit
    ) {}

    public function handle(User $actor, GptRecommendation $recommendation): DispatchJob
    {
        Gate::forUser($actor)->authorize('decide', $recommendation);

        if ($recommendation->status !== 'pending_review') {
            throw ValidationException::withMessages([
                'gpt' => "Recommendation cannot be accepted in status '{$recommendation->status}'.",
            ]);
        }

        if ($recommendation->isExpired()) {
            $recommendation->update(['status' => 'expired']);
            throw ValidationException::withMessages([
                'gpt' => 'This GPT recommendation has expired (valid for 15 minutes). Please generate a fresh recommendation.',
            ]);
        }

        $subject = $recommendation->subject;
        if (! $subject instanceof DispatchJob) {
            throw ValidationException::withMessages([
                'gpt' => 'Recommendation subject is not a dispatch job.',
            ]);
        }

        // Revalidate operational context hash to ensure no underlying changes occurred
        $currentContext = $this->contextBuilder->buildForDispatchJob($subject);
        if ($recommendation->isStale($currentContext['context_hash'])) {
            $recommendation->update(['status' => 'stale']);
            throw ValidationException::withMessages([
                'gpt' => 'The underlying dispatch context has changed since this recommendation was generated. Please generate a fresh recommendation.',
            ]);
        }

        return DB::transaction(function () use ($actor, $recommendation, $subject): DispatchJob {
            /** @var GptRecommendation $lockedRecommendation */
            $lockedRecommendation = GptRecommendation::query()->lockForUpdate()->findOrFail($recommendation->id);

            /** @var DispatchJob $job */
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($subject->id);

            $rawPayload = $lockedRecommendation->recommendation;
            if (! is_array($rawPayload)) {
                throw ValidationException::withMessages([
                    'gpt' => 'Recommendation payload contains invalid assignment structure.',
                ]);
            }

            /** @var list<array{user_id: int, assignment_type: string}> $personnel */
            $personnel = is_array($rawPayload['proposed_personnel'] ?? null) ? $rawPayload['proposed_personnel'] : [];

            /** @var list<array{operational_asset_id: int, assignment_type: string}> $assets */
            $assets = is_array($rawPayload['proposed_assets'] ?? null) ? $rawPayload['proposed_assets'] : [];

            // Revalidate and execute operational mutation via the normal domain action under human authority
            $updatedJob = $this->assignAction->handle($actor, $job, $personnel, $assets);

            $lockedRecommendation->update([
                'status' => 'accepted',
                'decided_by' => $actor->id,
                'decided_at' => now(),
            ]);

            $this->audit->handle(
                $actor,
                $job,
                'gpt.recommendation_accepted',
                null,
                [
                    'recommendation_id' => $lockedRecommendation->id,
                    'purpose' => $lockedRecommendation->purpose,
                    'model' => $lockedRecommendation->model,
                    'personnel_count' => count($personnel),
                    'assets_count' => count($assets),
                ]
            );

            return $updatedJob;
        });
    }
}
