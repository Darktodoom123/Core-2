<?php

namespace App\Platform\Gpt\Jobs;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Services\BlockerResolutionContextBuilder;
use App\Platform\Gpt\Services\BoundedContextBuilder;
use App\Platform\Gpt\Services\DispatchAdvisoryNeed;
use App\Platform\Gpt\Services\GptRecommendationTransition;
use App\Platform\Gpt\Services\OpenAiClientWrapper;
use App\Platform\Gpt\Services\RecordGptOperationalMetric;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
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

        if (($this->automatic || $recommendation->purpose === 'dispatch_blocker_resolution') && ! $this->automaticRequestIsCurrent($recommendation)) {
            $transitions->compareAndSet($recommendation->id, GptRecommendationStatus::Processing, GptRecommendationStatus::Failed, [
                'error_message' => 'Automatic suggestion deferred because dispatch context or access changed. Request a fresh suggestion when ready.',
            ]);

            return;
        }

        $startedAt = microtime(true);
        $result = $openAi->withModel($recommendation->model)->generateRecommendation($this->boundedContext);
        $latencyMs = (int) round((microtime(true) - $startedAt) * 1000);

        if ($recommendation->purpose === 'dispatch_blocker_resolution' && ! $this->automaticRequestIsCurrent($recommendation)) {
            $transitions->compareAndSet($recommendation->id, GptRecommendationStatus::Processing, GptRecommendationStatus::Failed, [
                'error_message' => 'Dispatch resources changed while advice was generated. Request a fresh suggestion.',
            ]);

            return;
        }

        if ($result['success'] && $recommendation->purpose !== 'dispatch_blocker_resolution' && ! $this->proposedCandidatesAreEligible($result['recommendation'] ?? [])) {
            $result['success'] = false;
            $result['recommendation'] = null;
            $result['response_summary'] = null;
        }

        if ($result['success']) {
            $recPayload = $result['recommendation'] ?? [];
            $recPayload = $recommendation->purpose === 'dispatch_blocker_resolution'
                ? $this->blockerPayload($recPayload)
                : $this->hydrateRecommendationDetails($recPayload, $this->boundedContext);
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
                        'expires_at' => $recommendation->expires_at instanceof CarbonInterface ? $recommendation->expires_at->toIso8601String() : null,
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
                    'usage' => $result['usage'],
                    'cost_usd' => $result['cost_usd'],
                    'latency_ms' => $latencyMs,
                ],
            );

            if (! $updated) {
                return;
            }

            $this->recordMetric($metrics, $recommendation, 'failed', [
                'status' => GptRecommendationStatus::Failed->value,
                'usage' => $result['usage'],
                'cost_usd' => $result['cost_usd'],
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

        $isBlockerAdvice = $recommendation->purpose === 'dispatch_blocker_resolution';
        $context = $subject instanceof DispatchJob
            ? ($isBlockerAdvice
                ? app(BlockerResolutionContextBuilder::class)->buildForDispatchJob($subject)
                : app(BoundedContextBuilder::class)->buildForDispatchJob($subject))
            : null;

        return (! $this->automatic || (bool) config('services.openai.proactive_enabled', true))
            && (! $isBlockerAdvice || (bool) config('services.openai.blocker_resolution_enabled', false))
            && ! Cache::get('gpt_circuit_breaker_disabled', false)
            && $actor instanceof User && $actor->is_active && $actor->suspended_at === null
            && $actor->can(PermissionName::GptUseDispatch->value)
            && $subject instanceof DispatchJob
            && Gate::forUser($actor)->allows('view', $subject)
            && ($isBlockerAdvice || app(DispatchAdvisoryNeed::class)->exists($subject))
            && $context !== null
            && $recommendation->context_hash === $context['context_hash'];
    }

    /** @param array<string, mixed> $modelPayload
     * @return array<string, mixed>
     */
    private function blockerPayload(array $modelPayload): array
    {
        $approved = array_column($this->boundedContext['options'] ?? [], null, 'id');
        $options = [];
        foreach ($modelPayload['options'] ?? [] as $ranked) {
            $option = $approved[$ranked['id']];
            $focus = $ranked['focus'];
            $explanation = match ($focus) {
                'availability' => $option['evidence']['availability'] === 'not_recorded'
                    ? 'Availability is not recorded. Confirm it before assigning.'
                    : 'Recorded availability is '.str_replace('_', ' ', (string) $option['evidence']['availability']).'.',
                'credential' => $option['evidence']['credential'] === 'valid'
                    ? 'The required credential is valid at the scheduled start.'
                    : 'No role-specific credential is required for this assignment.',
                'readiness' => 'Recorded asset readiness is '.str_replace('_', ' ', (string) $option['evidence']['readiness']).'.',
                'schedule_conflicts' => 'No overlapping commitment was found for the scheduled window.',
                default => throw new \UnexpectedValueException('Unsupported blocker evidence key.'),
            };
            $options[] = [...$option, 'explanation' => $explanation];
        }

        return [
            'version' => 1,
            'job_version' => $this->boundedContext['job']['version'],
            'blocker' => $this->boundedContext['blocker'],
            'summary' => 'Review these eligible resources for the identified blocker. Other readiness checks still apply.',
            'options' => $options,
        ];
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

    /** @param array<string, mixed> $payload */
    private function proposedCandidatesAreEligible(array $payload): bool
    {
        $eligiblePersonnel = [];
        foreach ($this->boundedContext['personnel_candidates'] ?? [] as $candidate) {
            if (is_array($candidate) && ($candidate['eligible'] ?? false) === true) {
                $eligiblePersonnel[(int) ($candidate['user_id'] ?? 0)] = true;
            }
        }

        $eligibleAssets = [];
        foreach ($this->boundedContext['asset_candidates'] ?? [] as $candidate) {
            if (is_array($candidate) && ($candidate['eligible'] ?? false) === true) {
                $eligibleAssets[(int) ($candidate['asset_id'] ?? 0)] = true;
            }
        }

        $seenPersonnel = [];
        foreach ($payload['proposed_personnel'] ?? [] as $person) {
            $id = is_array($person) ? $person['user_id'] ?? null : null;
            if (! $this->isEligibleCandidateId($id, $eligiblePersonnel, $seenPersonnel)) {
                return false;
            }
        }

        $seenAssets = [];
        foreach ($payload['proposed_assets'] ?? [] as $asset) {
            $id = is_array($asset) ? ($asset['operational_asset_id'] ?? $asset['asset_id'] ?? null) : null;
            if (! $this->isEligibleCandidateId($id, $eligibleAssets, $seenAssets)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<int, true>  $eligible
     * @param  array<int, true>  $seen
     */
    private function isEligibleCandidateId(mixed $value, array $eligible, array &$seen): bool
    {
        if (! is_int($value) && (! is_string($value) || ! ctype_digit($value))) {
            return false;
        }

        $id = (int) $value;
        if ($id <= 0 || ! isset($eligible[$id]) || isset($seen[$id])) {
            return false;
        }

        $seen[$id] = true;

        return true;
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

                $name = $candidateName ?? $userName;
                $role = $candidateRole ?? $userRole;
                $assignmentType = $candidate['assignment_type'] ?? 'crew';

                return array_filter([
                    'user_id' => $userId,
                    'name' => $name,
                    'role' => $role,
                    'assignment_type' => $assignmentType,
                ], static fn ($v) => $v !== null);
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

                $name = $candidateName ?? $assetName;
                $code = $candidateCode ?? $assetCode;
                $kind = $candidateKind ?? $assetKind;
                $capacity = $candidateCapacity ?? $assetCapacity;
                $assignmentType = $kind ?? 'equipment';

                return array_filter([
                    'operational_asset_id' => $assetId,
                    'name' => $name,
                    'asset_code' => $code,
                    'kind' => $kind,
                    'capacity' => $capacity,
                    'assignment_type' => $assignmentType,
                ], static fn ($v) => $v !== null);
            }, $recPayload['proposed_assets'])));
        }

        return $recPayload;
    }
}
