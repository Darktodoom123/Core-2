<?php

namespace App\Platform\Gpt\Actions;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Jobs\GenerateGptRecommendationJob;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class GenerateGptRecommendation
{
    public function __construct(
        private BoundedContextBuilder $contextBuilder,
        private OpenAiClientWrapper $openAi
    ) {}

    public function handle(User $actor, Model $subject, string $purpose = 'dispatch_assignment', ?int $retryOfId = null): GptRecommendation
    {
        $this->authorize($actor, $subject, $purpose);

        $rateLimitCheck = $this->openAi->reserveRateLimit($actor);
        if (! $rateLimitCheck['allowed']) {
            throw ValidationException::withMessages([
                'gpt' => $rateLimitCheck['reason'] ?? 'Rate limit exceeded.',
            ]);
        }

        if ($subject instanceof DispatchJob) {
            $contextData = $this->contextBuilder->buildForDispatchJob($subject);
        } else {
            throw ValidationException::withMessages([
                'gpt' => 'Unsupported subject for GPT recommendation.',
            ]);
        }

        $recommendation = GptRecommendation::query()->create([
            'subject_type' => $subject->getMorphClass(),
            'subject_id' => $subject->id,
            'requested_by' => $actor->id,
            'retry_of_id' => $retryOfId,
            'purpose' => $purpose,
            'context_hash' => $contextData['context_hash'],
            'input_references' => $contextData['input_references'],
            'recommendation' => [],
            'conflicts' => [],
            'model' => config('services.openai.model', 'gpt-5-mini'),
            'status' => GptRecommendationStatus::Draft,
            'prompt_summary' => $contextData['prompt_summary'],
            'purge_at' => now()->addDays(90),
        ]);

        try {
            GenerateGptRecommendationJob::dispatch($recommendation->id, $contextData['context'])->afterCommit();
        } catch (\Throwable $exception) {
            $recommendation->delete();
            $this->openAi->releaseRateLimit($actor);

            throw $exception;
        }

        return $recommendation->fresh() ?? $recommendation;
    }

    private function authorize(User $actor, Model $subject, string $purpose): void
    {
        $permission = match ($purpose) {
            'dispatch_assignment' => PermissionName::GptUseDispatch,
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
