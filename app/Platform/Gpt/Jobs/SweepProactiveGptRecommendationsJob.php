<?php

namespace App\Platform\Gpt\Jobs;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Gpt\Actions\GenerateGptRecommendation;
use App\Platform\Gpt\Services\DispatchAdvisoryNeed;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

final class SweepProactiveGptRecommendationsJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 120;

    public int $uniqueFor = 300;

    public function __construct()
    {
        $this->queue = 'ai';
        $this->onQueue('ai');
    }

    public function handle(DispatchAdvisoryNeed $need, GenerateGptRecommendation $generate, OpenAiClientWrapper $openAi): void
    {
        if (! config('services.openai.proactive_enabled', true)
            || Cache::get('gpt_circuit_breaker_disabled', false)
            || (! OpenAiClientWrapper::isFaked() && ! config('services.openai.fake') && ! config('services.openai.key'))) {
            return;
        }

        $batchSize = max(1, min(100, (int) config('services.openai.proactive_batch_size', 10)));
        $jobs = DispatchJob::query()
            ->whereNotIn('status', [DispatchStatus::Completed, DispatchStatus::Cancelled])
            ->whereNotNull('scheduled_start')->whereNotNull('scheduled_end')
            ->where('id', '>', (int) Cache::get('gpt_proactive_dispatch_cursor', 0))
            ->with('creator')->orderBy('id')->limit($batchSize)->get();

        foreach ($jobs as $job) {
            try {
                $actor = $job->creator;
                if (! $actor instanceof User || ! $actor->is_active || $actor->suspended_at !== null
                    || ! $actor->can(PermissionName::GptUseDispatch->value)
                    || Gate::forUser($actor)->denies('view', $job)
                    || ! $openAi->checkRateLimits($actor)['allowed'] || ! $need->exists($job)) {
                    continue;
                }

                $generate->handle($actor, $job, automatic: true);
            } catch (AuthorizationException|ValidationException) {
                // Changed permissions or exhausted quota defer to the next sweep.
            } catch (Throwable $exception) {
                Log::warning('Automatic GPT advisory could not be prepared.', ['dispatch_job_id' => $job->id, 'error' => $exception::class]);
            }
        }

        Cache::put('gpt_proactive_dispatch_cursor', $jobs->count() < $batchSize ? 0 : $jobs->last()?->id, now()->addDay());
    }
}
