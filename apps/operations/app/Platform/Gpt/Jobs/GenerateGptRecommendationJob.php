<?php

namespace App\Platform\Gpt\Jobs;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Gpt\Services\DispatchAdvisoryNeed;
use App\Platform\Gpt\Services\GptRecommendationTransition;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Gpt\Services\RecordGptOperationalMetric;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Throwable;

final class GenerateGptRecommendationJob implements ShouldQueue
{
    use InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    /** @var list<int> */
    public array $backoff = [10, 30];

    public int $timeout = 120;

    /** @param array<string, mixed> $boundedContext */
    public function __construct(
        public int $recommendationId,
        public array $boundedContext,
        public bool $automatic = false,
    ) {
        $this->queue = 'ai';
        $this->onQueue('ai');
    }

    public function handle(
        OpenAiClientWrapper $openAi,
        RecordAuditEvent $audit,
        ?GptRecommendationTransition $transitions = null,
        ?RecordGptOperationalMetric $metrics = null,
    ): void {
        $transitions ??= app(GptRecommendationTransition::class);
        $metrics ??= app(RecordGptOperationalMetric::class);

        $claimed = $transitions->compareAndSet(
            $this->recommendationId,
            GptRecommendationStatus::Draft,
            GptRecommendationStatus::Processing,
        );

        if (! $claimed) {
            return;
        }

        $recommendation = GptRecommendation::query()->find($this->recommendationId);
        if (! $recommendation instanceof GptRecommendation) {
            return;
        }

        if ($this->automatic && ! $this->automaticRequestIsCurrent($recommendation)) {
            $transitions->compareAndSet($recommendation->id, GptRecommendationStatus::Processing, GptRecommendationStatus::Failed, [
                'error_message' => 'Automatic suggestion deferred because dispatch context or access changed. Request a fresh suggestion when ready.',
            ]);

            return;
        }

        $startedAt = microtime(true);
        $result = $openAi->generateRecommendation($this->boundedContext);
        $latencyMs = (int) round((microtime(true) - $startedAt) * 1000);

        if ($result['success']) {
            $recPayload = $result['recommendation'] ?? [];
            $recPayload = $this->hydrateRecommendationDetails($recPayload, $this->boundedContext);
            $updated = $transitions->compareAndSet(
                $recommendation->id,
                GptRecommendationStatus::Processing,
                GptRecommendationStatus::PendingReview,
                [
                    'recommendation' => $recPayload,
                    'conflicts' => $recPayload['conflicts'] ?? [],
                    'response_summary' => $result['response_summary'],
                    'usage' => $result['usage'],
                    'cost_usd' => $result['cost_usd'],
                    'expires_at' => now()->addMinutes(15),
                    'generated_at' => now(),
                    'latency_ms' => $latencyMs,
                    'error_message' => null,
                ],
            );

            if (! $updated) {
                return;
            }

            $this->recordMetric($metrics, $recommendation, 'generated', [
                'status' => GptRecommendationStatus::PendingReview->value,
                'usage' => $result['usage'],
                'cost_usd' => $result['cost_usd'],
                'latency_ms' => $latencyMs,
            ]);

            $recommendation->refresh();

            $requestedBy = $recommendation->requestedBy;
            if ($requestedBy !== null && $recommendation->subject !== null) {
                $audit->handle(
                    $requestedBy,
                    $recommendation->subject,
                    'gpt.recommendation_generated',
                    null,
                    [
                        'recommendation_id' => $recommendation->id,
                        'purpose' => $recommendation->purpose,
                        'model' => $recommendation->model,
                        'cost_usd' => $result['cost_usd'],
                        'expires_at' => $recommendation->expires_at instanceof Carbon ? $recommendation->expires_at->toIso8601String() : null,
                    ]
                );
            }
        } else {
            $updated = $transitions->compareAndSet(
                $recommendation->id,
                GptRecommendationStatus::Processing,
                GptRecommendationStatus::Failed,
                [
                    'error_message' => $result['is_timeout'] ? 'GPT generation timed out. Please retry.' : 'GPT generation failed. Please retry.',
                    'response_summary' => null,
                    'latency_ms' => $latencyMs,
                ],
            );

            if (! $updated) {
                return;
            }

            $this->recordMetric($metrics, $recommendation, 'failed', [
                'status' => GptRecommendationStatus::Failed->value,
                'latency_ms' => $latencyMs,
            ]);

            Log::warning('GPT recommendation generation failed.', [
                'recommendation_id' => $recommendation->id,
                'reason' => $result['is_timeout'] ? 'timeout' : 'provider_or_schema_failure',
            ]);
        }
    }

    private function automaticRequestIsCurrent(GptRecommendation $recommendation): bool
    {
        $actor = $recommendation->requestedBy;
        $subject = $recommendation->subject;

        return (bool) config('services.openai.proactive_enabled', true)
            && ! Cache::get('gpt_circuit_breaker_disabled', false)
            && $actor instanceof User && $actor->is_active && $actor->suspended_at === null
            && $actor->can(PermissionName::GptUseDispatch->value)
            && $subject instanceof DispatchJob
            && Gate::forUser($actor)->allows('view', $subject)
            && app(DispatchAdvisoryNeed::class)->exists($subject)
            && $recommendation->context_hash === app(BoundedContextBuilder::class)->buildForDispatchJob($subject)['context_hash'];
    }

    /** @param array<string, mixed> $values */
    private function recordMetric(RecordGptOperationalMetric $metrics, GptRecommendation $recommendation, string $event, array $values): void
    {
        try {
            $metrics->handle($recommendation, $event, $values);
        } catch (Throwable $exception) {
            Log::warning('GPT operational metric could not be recorded.', [
                'recommendation_id' => $recommendation->id,
                'event' => $event,
                'error' => $exception::class,
            ]);
        }
    }

    public function failed(Throwable $exception): void
    {
        $recommendation = GptRecommendation::query()->find($this->recommendationId);
        if ($recommendation instanceof GptRecommendation) {
            $transitions = app(GptRecommendationTransition::class);
            $attributes = ['error_message' => 'GPT generation failed. Retry to create a fresh recommendation.'];

            if ($recommendation->status === GptRecommendationStatus::Draft) {
                $transitions->compareAndSet($recommendation->id, GptRecommendationStatus::Draft, GptRecommendationStatus::Failed, $attributes);
            } elseif ($recommendation->status === GptRecommendationStatus::Processing) {
                $transitions->compareAndSet($recommendation->id, GptRecommendationStatus::Processing, GptRecommendationStatus::Failed, $attributes);
            }
        }
    }

    /**
     * @param  array<string, mixed>  $recPayload
     * @param  array<string, mixed>  $boundedContext
     * @return array<string, mixed>
     */
    private function hydrateRecommendationDetails(array $recPayload, array $boundedContext): array
    {
        $personnelCandidates = [];
        if (isset($boundedContext['personnel_candidates']) && is_iterable($boundedContext['personnel_candidates'])) {
            foreach ($boundedContext['personnel_candidates'] as $candidate) {
                if (is_array($candidate) && isset($candidate['user_id'])) {
                    $personnelCandidates[(int) $candidate['user_id']] = $candidate;
                }
            }
        }

        $assetCandidates = [];
        if (isset($boundedContext['asset_candidates']) && is_iterable($boundedContext['asset_candidates'])) {
            foreach ($boundedContext['asset_candidates'] as $candidate) {
                if (is_array($candidate)) {
                    $cId = (int) ($candidate['asset_id'] ?? $candidate['operational_asset_id'] ?? 0);
                    if ($cId > 0) {
                        $assetCandidates[$cId] = $candidate;
                    }
                }
            }
        }

        $missingUserIds = [];
        if (isset($recPayload['proposed_personnel']) && is_array($recPayload['proposed_personnel'])) {
            foreach ($recPayload['proposed_personnel'] as $person) {
                $userId = is_array($person)
                    ? (int) ($person['user_id'] ?? 0)
                    : (is_numeric($person) ? (int) $person : 0);

                if ($userId > 0 && (! isset($personnelCandidates[$userId]) || empty($person['name']) || empty($person['role']))) {
                    $missingUserIds[] = $userId;
                }
            }
        }

        $missingAssetIds = [];
        if (isset($recPayload['proposed_assets']) && is_array($recPayload['proposed_assets'])) {
            foreach ($recPayload['proposed_assets'] as $asset) {
                $assetId = is_array($asset)
                    ? (int) ($asset['operational_asset_id'] ?? $asset['asset_id'] ?? 0)
                    : (is_numeric($asset) ? (int) $asset : 0);

                if ($assetId > 0 && (! isset($assetCandidates[$assetId]) || empty($asset['name']) || empty($asset['asset_code']))) {
                    $missingAssetIds[] = $assetId;
                }
            }
        }

        $dbUsers = $missingUserIds !== []
            ? User::query()->whereIn('id', array_unique($missingUserIds))->get()->keyBy('id')
            : collect();

        $dbAssets = $missingAssetIds !== []
            ? OperationalAsset::query()->withTrashed()->whereIn('id', array_unique($missingAssetIds))->get()->keyBy('id')
            : collect();

        if (isset($recPayload['proposed_personnel']) && is_array($recPayload['proposed_personnel'])) {
            $recPayload['proposed_personnel'] = array_values(array_filter(array_map(function ($person) use ($personnelCandidates, $dbUsers) {
                $userId = is_array($person)
                    ? (int) ($person['user_id'] ?? 0)
                    : (is_numeric($person) ? (int) $person : 0);

                if ($userId <= 0) {
                    return null;
                }

                $candidate = $personnelCandidates[$userId] ?? null;
                $userModel = $dbUsers->get($userId);

                $userName = $userModel instanceof User ? $userModel->name : null;
                $userRole = ($userModel instanceof User && $userModel->operationalRole() !== null)
                    ? $userModel->operationalRole()->value
                    : null;

                $candidateName = (isset($candidate['name']) && is_string($candidate['name'])) ? $candidate['name'] : null;
                $candidateRole = (isset($candidate['role']) && is_string($candidate['role'])) ? $candidate['role'] : null;

                $name = (is_array($person) && ! empty($person['name']) && is_string($person['name']))
                    ? $person['name']
                    : ($candidateName ?? $userName);

                $role = (is_array($person) && ! empty($person['role']) && is_string($person['role']))
                    ? $person['role']
                    : ($candidateRole ?? $userRole);

                $assignmentType = (is_array($person) && ! empty($person['assignment_type']) && is_string($person['assignment_type']))
                    ? $person['assignment_type']
                    : ($candidate['assignment_type'] ?? 'crew');

                $base = is_array($person) ? $person : [];

                return array_merge($base, array_filter([
                    'user_id' => $userId,
                    'name' => $name,
                    'role' => $role,
                    'assignment_type' => $assignmentType,
                ], static fn ($v) => $v !== null));
            }, $recPayload['proposed_personnel'])));
        }

        if (isset($recPayload['proposed_assets']) && is_array($recPayload['proposed_assets'])) {
            $recPayload['proposed_assets'] = array_values(array_filter(array_map(function ($asset) use ($assetCandidates, $dbAssets) {
                $assetId = is_array($asset)
                    ? (int) ($asset['operational_asset_id'] ?? $asset['asset_id'] ?? 0)
                    : (is_numeric($asset) ? (int) $asset : 0);

                if ($assetId <= 0) {
                    return null;
                }

                $candidate = $assetCandidates[$assetId] ?? null;
                $assetModel = $dbAssets->get($assetId);

                $assetName = $assetModel instanceof OperationalAsset ? $assetModel->name : null;
                $assetCode = $assetModel instanceof OperationalAsset ? $assetModel->code : null;
                $assetKind = $assetModel instanceof OperationalAsset ? $assetModel->kind : null;
                $assetCapacity = ($assetModel instanceof OperationalAsset && $assetModel->rated_capacity !== null)
                    ? trim(((float) $assetModel->rated_capacity).' '.$assetModel->capacity_unit)
                    : null;

                $candidateName = (isset($candidate['name']) && is_string($candidate['name'])) ? $candidate['name'] : null;
                $candidateCode = (isset($candidate['code']) && is_string($candidate['code']))
                    ? $candidate['code']
                    : ((isset($candidate['asset_code']) && is_string($candidate['asset_code'])) ? $candidate['asset_code'] : null);
                $candidateKind = (isset($candidate['kind']) && is_string($candidate['kind'])) ? $candidate['kind'] : null;
                $candidateCapacity = isset($candidate['rated_capacity'])
                    ? trim(((float) $candidate['rated_capacity']).' '.($candidate['capacity_unit'] ?? ''))
                    : null;

                $name = (is_array($asset) && ! empty($asset['name']) && is_string($asset['name']))
                    ? $asset['name']
                    : ($candidateName ?? $assetName);

                $code = (is_array($asset) && ! empty($asset['asset_code']) && is_string($asset['asset_code']))
                    ? $asset['asset_code']
                    : ((is_array($asset) && ! empty($asset['code']) && is_string($asset['code']))
                        ? $asset['code']
                        : ($candidateCode ?? $assetCode));

                $kind = (is_array($asset) && ! empty($asset['kind']) && is_string($asset['kind']))
                    ? $asset['kind']
                    : ($candidateKind ?? $assetKind);

                $capacity = (is_array($asset) && ! empty($asset['capacity']) && is_string($asset['capacity']))
                    ? $asset['capacity']
                    : ($candidateCapacity ?? $assetCapacity);

                $assignmentType = (is_array($asset) && ! empty($asset['assignment_type']) && is_string($asset['assignment_type']))
                    ? $asset['assignment_type']
                    : ($kind ?? 'equipment');

                $base = is_array($asset) ? $asset : [];

                return array_merge($base, array_filter([
                    'operational_asset_id' => $assetId,
                    'name' => $name,
                    'asset_code' => $code,
                    'kind' => $kind,
                    'capacity' => $capacity,
                    'assignment_type' => $assignmentType,
                ], static fn ($v) => $v !== null));
            }, $recPayload['proposed_assets'])));
        }

        return $recPayload;
    }
}
