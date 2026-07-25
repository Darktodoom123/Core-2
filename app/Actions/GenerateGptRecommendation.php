<?php

namespace App\Actions;

use App\Enums\PermissionName;
use App\Jobs\GenerateGptRecommendationJob;
use App\Models\DispatchJob;
use App\Models\GptRecommendation;
use App\Models\User;
use App\Services\Gpt\BoundedContextBuilder;
use App\Services\Gpt\OpenAiClientWrapper;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

final class GenerateGptRecommendation
{
    public function __construct(
        private BoundedContextBuilder $contextBuilder,
        private OpenAiClientWrapper $openAi
    ) {}

    public function handle(User $actor, Model $subject, string $purpose = 'dispatch_assignment'): GptRecommendation
    {
        $this->authorize($actor, $subject, $purpose);

        $rateLimitCheck = $this->openAi->checkRateLimits($actor);
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
            'subject_type' => get_class($subject),
            'subject_id' => $subject->id,
            'requested_by' => $actor->id,
            'purpose' => $purpose,
            'context_hash' => $contextData['context_hash'],
            'input_references' => $contextData['input_references'],
            'recommendation' => [],
            'conflicts' => [],
            'model' => config('services.openai.model', 'gpt-5-mini'),
            'status' => 'draft',
            'prompt_summary' => $contextData['prompt_summary'],
        ]);

        $this->openAi->incrementRateLimits($actor);

        GenerateGptRecommendationJob::dispatch($recommendation->id, $contextData['context']);

        return $recommendation->fresh() ?? $recommendation;
    }

    private function authorize(User $actor, Model $subject, string $purpose): void
    {
        $permission = match ($purpose) {
            'dispatch_assignment' => PermissionName::GptUseDispatch,
            'operations_review' => PermissionName::GptUseOperations,
            'maintenance_advice' => PermissionName::GptUseMaintenance,
            default => PermissionName::GptUseDispatch,
        };

        if (! $actor->can($permission->value)) {
            throw new AuthorizationException("You do not have permission to generate AI assistance ({$permission->value}).");
        }
    }
}
