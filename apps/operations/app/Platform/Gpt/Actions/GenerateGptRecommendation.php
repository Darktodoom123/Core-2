<?php

namespace App\Platform\Gpt\Actions;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Jobs\GenerateGptRecommendationJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BlockerAdviceFormatter;
use App\Platform\Gpt\Services\BlockerResolutionContextBuilder;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Gpt\Services\GptRecommendationTransition;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Gpt\Services\RecordGptOperationalMetric;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class GenerateGptRecommendation
{
    public function __construct(
        private BoundedContextBuilder $contextBuilder,
        private BlockerResolutionContextBuilder $blockerContextBuilder,
        private OpenAiClientWrapper $openAi
    ) {}

    public function handle(User $actor, Model $subject, string $purpose = 'dispatch_assignment', ?int $retryOfId = null, bool $automatic = false, bool $refresh = false): GptRecommendation
    {
        $this->authorize($actor, $subject, $purpose);

        if (! $subject instanceof DispatchJob) {
            throw ValidationException::withMessages(['gpt' => 'Unsupported subject for GPT recommendation.']);
        }

        return DB::transaction(function () use ($actor, $subject, $purpose, $retryOfId, $automatic, $refresh): GptRecommendation {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($subject->id);
            $actor = User::query()->findOrFail($actor->id);
            $this->authorize($actor, $job, $purpose);
            $contextData = $purpose === 'dispatch_blocker_resolution'
                ? $this->blockerContextBuilder->buildForDispatchJob($job)
                : $this->contextBuilder->buildForDispatchJob($job);
            if ($contextData === null) {
                throw ValidationException::withMessages(['gpt' => 'This job has no actionable resource blocker. Review the readiness panel instead.']);
            }
            $existing = GptRecommendation::query()
                ->where('subject_type', $job->getMorphClass())
                ->where('subject_id', $job->id)
                ->where('purpose', $purpose)
                ->latest('id')->first();

            if ($existing instanceof GptRecommendation && (
                in_array($existing->status, [GptRecommendationStatus::Draft, GptRecommendationStatus::Processing], true)
                || (! $refresh && $this->shouldReuse($existing, $contextData, $automatic))
            )) {
                return $existing;
            }

            if ($refresh && $purpose === 'dispatch_blocker_resolution' && $existing?->status === GptRecommendationStatus::PendingReview) {
                app(GptRecommendationTransition::class)->transitionLocked($existing, GptRecommendationStatus::Stale);
            }

            return $this->create($actor, $job, $purpose, $retryOfId, $contextData, $automatic);
        });
    }

    /** @param array{context: array<string, mixed>, context_hash: string, automation_hash: string} $context */
    private function shouldReuse(GptRecommendation $existing, array $context, bool $automatic): bool
    {
        if (in_array($existing->status, [GptRecommendationStatus::Draft, GptRecommendationStatus::Processing], true)) {
            return true;
        }

        if (($context['context']['purpose'] ?? null) === 'dispatch_blocker_resolution' && $automatic) {
            if ($existing->automation_hash !== $context['automation_hash']) {
                return false;
            }

            return $existing->status !== GptRecommendationStatus::Failed
                || $existing->created_at?->gt(now()->subMinutes((int) config('services.openai.proactive_cooldown_minutes', 5)));
        }

        if ($automatic && ($existing->automation_hash === $context['automation_hash']
            || $existing->context_hash === $context['context_hash']
            || $existing->created_at?->gt(now()->subMinutes((int) config('services.openai.proactive_cooldown_minutes', 5))))) {
            return true;
        }

        return $existing->status === GptRecommendationStatus::PendingReview
            && ! $existing->isStale($context['context_hash']);
    }

    /**
     * @param  array{context: array<string, mixed>, context_hash: string, automation_hash: string, input_references: array{user_ids: list<int>, asset_ids: list<int>}, prompt_summary: string}  $contextData
     */
    private function create(User $actor, DispatchJob $subject, string $purpose, ?int $retryOfId, array $contextData, bool $automatic): GptRecommendation
    {
        $options = $contextData['context']['options'] ?? [];
        $ruleBased = $purpose === 'dispatch_blocker_resolution' && count($options) <= 1;
        if (! $ruleBased) {
            $rateLimitCheck = $this->openAi->reserveRateLimit($actor);
            if (! $rateLimitCheck['allowed']) {
                throw ValidationException::withMessages([
                    'gpt' => $rateLimitCheck['reason'] ?? 'Rate limit exceeded.',
                ]);
            }
        }

        $ruleBasedPayload = null;
        if ($ruleBased) {
            $ranked = $options === [] ? [] : [[
                'id' => $options[0]['id'],
                'focus' => $options[0]['resource_kind'] === 'asset' ? 'readiness' : 'availability',
            ]];
            $ruleBasedPayload = app(BlockerAdviceFormatter::class)->build($contextData['context'], $ranked);
        }

        $recommendation = GptRecommendation::query()->create([
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->id,
            'requested_by' => $actor->id,
            'retry_of_id' => $retryOfId,
            'purpose' => $purpose,
            'context_hash' => $contextData['context_hash'],
            'automation_hash' => $contextData['automation_hash'],
            'input_references' => $contextData['input_references'],
            'recommendation' => $ruleBasedPayload ?? [],
            'conflicts' => [],
            'model' => $ruleBased ? 'rules' : config('services.openai.model', 'gpt-6-luna'),
            'status' => $ruleBased ? GptRecommendationStatus::PendingReview : GptRecommendationStatus::Draft,
            'prompt_summary' => $automatic ? 'Automatically prepared. '.$contextData['prompt_summary'] : $contextData['prompt_summary'],
            'generated_at' => $ruleBased ? now() : null,
            'expires_at' => $ruleBased ? now()->addMinutes(15) : null,
            'purge_at' => now()->addDays(90),
        ]);

        if ($ruleBased) {
            app(RecordGptOperationalMetric::class)->handle($recommendation, $options === [] ? 'no_eligible_option' : 'single_eligible_option');

            return $recommendation;
        }

        DB::afterCommit(function () use ($recommendation, $contextData, $automatic, $actor): void {
            try {
                GenerateGptRecommendationJob::dispatch($recommendation->id, $contextData['context'], $automatic)->onQueue('ai');
            } catch (\Throwable $exception) {
                // This callback runs after commit; a surrounding transaction can
                // no longer roll back the persisted draft or its quota slot.
                $failedBeforeClaim = app(GptRecommendationTransition::class)->compareAndSet(
                    $recommendation->id,
                    GptRecommendationStatus::Draft,
                    GptRecommendationStatus::Failed,
                    ['error_message' => 'Suggestion could not be queued. Please retry.'],
                );
                if ($failedBeforeClaim) {
                    $this->openAi->releaseRateLimit($actor);
                }

                throw $exception;
            }
        });

        return $recommendation->fresh() ?? $recommendation;
    }

    private function authorize(User $actor, Model $subject, string $purpose): void
    {
        if ($purpose === 'dispatch_blocker_resolution' && ! config('services.openai.blocker_resolution_enabled', false)) {
            throw ValidationException::withMessages(['gpt' => 'Blocker assistance is not enabled.']);
        }
        if ($purpose === 'dispatch_assignment' && config('services.openai.blocker_resolution_enabled', false)) {
            throw ValidationException::withMessages(['gpt' => 'Use blocker assistance for new dispatch suggestions.']);
        }
        if (! $actor->is_active || $actor->suspended_at !== null) {
            throw new AuthorizationException('AI assistance requires an active account.');
        }

        $permission = match ($purpose) {
            'dispatch_assignment', 'dispatch_blocker_resolution' => PermissionName::GptUseDispatch,
            'operations_review' => PermissionName::GptUseOperations,
            'maintenance_advice' => PermissionName::GptUseMaintenance,
            default => null,
        };

        if ($permission === null) {
            throw ValidationException::withMessages([
                'purpose' => 'Unsupported GPT recommendation purpose.',
            ]);
        }

        Gate::forUser($actor)->authorize('view', $subject);

        if (! $actor->can($permission->value)) {
            throw new AuthorizationException("You do not have permission to generate AI assistance ({$permission->value}).");
        }
    }
}
