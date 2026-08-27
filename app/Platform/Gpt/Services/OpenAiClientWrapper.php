<?php

namespace App\Platform\Gpt\Services;

use App\Platform\Identity\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

final class OpenAiClientWrapper
{
    private static ?self $fakeInstance = null;

    /** @var list<array{model: string, messages: list<array{role: string, content: string}>, context: array<string, mixed>}> */
    private static array $recordedRequests = [];

    /** @var (callable(array<string, mixed>): array<string, mixed>)|array<string, mixed>|null */
    private static mixed $fakeResponseResolver = null;

    public function __construct(
        private string $apiKey = '',
        private string $model = 'gpt-5-mini',
        private string $baseUrl = 'https://api.openai.com/v1'
    ) {
        $this->apiKey = (string) config('services.openai.key', '');
        $this->model = (string) config('services.openai.model', 'gpt-5-mini');
    }

    public static function fake(mixed $responseResolver = null): void
    {
        self::$fakeInstance = new self('fake-key', 'gpt-5-mini', 'https://api.openai.fake');
        self::$fakeResponseResolver = $responseResolver;
        self::$recordedRequests = [];
    }

    public static function isFaked(): bool
    {
        return self::$fakeInstance !== null;
    }

    public static function resetFakes(): void
    {
        self::$fakeInstance = null;
        self::$fakeResponseResolver = null;
        self::$recordedRequests = [];
    }

    /** @return list<array{model: string, messages: list<array{role: string, content: string}>, context: array<string, mixed>}> */
    public static function recordedRequests(): array
    {
        return self::$recordedRequests;
    }

    /**
     * Check if user or system limits are exceeded.
     * User limit: 10 requests / hour
     * System limit: 100 requests / day
     *
     * @return array{allowed: bool, reason: string|null}
     */
    public function checkRateLimits(User $user): array
    {
        if (Cache::get('gpt_circuit_breaker_disabled', false)) {
            return [
                'allowed' => false,
                'reason' => 'AI Advisory is currently paused by System Administrator (Circuit Breaker active).',
            ];
        }

        $userKey = "gpt_rate_limit:user:{$user->id}:".now()->format('Y-m-d-H');
        $systemKey = 'gpt_rate_limit:system:'.now()->format('Y-m-d');

        $userCount = (int) Cache::get($userKey, 0);
        $systemCount = (int) Cache::get($systemKey, 0);

        if ($userCount >= 10) {
            return [
                'allowed' => false,
                'reason' => 'User rate limit exceeded (maximum 10 GPT recommendations per hour).',
            ];
        }

        if ($systemCount >= 100) {
            return [
                'allowed' => false,
                'reason' => 'System rate limit exceeded (maximum 100 GPT recommendations per day).',
            ];
        }

        return ['allowed' => true, 'reason' => null];
    }

    /**
     * Reserve a user/system quota slot atomically before dispatching work.
     *
     * @return array{allowed: bool, reason: string|null}
     */
    public function reserveRateLimit(User $user): array
    {
        return Cache::lock('gpt_rate_limit_lock:global', 5)->block(3, function () use ($user): array {
            $result = $this->checkRateLimits($user);
            if ($result['allowed']) {
                $this->incrementRateLimits($user);
            }

            return $result;
        });
    }

    public function incrementRateLimits(User $user): void
    {
        $userKey = "gpt_rate_limit:user:{$user->id}:".now()->format('Y-m-d-H');
        $systemKey = 'gpt_rate_limit:system:'.now()->format('Y-m-d');

        Cache::add($userKey, 0, 3600);
        Cache::increment($userKey);

        Cache::add($systemKey, 0, 86400);
        Cache::increment($systemKey);
    }

    public function releaseRateLimit(User $user): void
    {
        Cache::lock('gpt_rate_limit_lock:global', 5)->block(3, function () use ($user): void {
            $userKey = "gpt_rate_limit:user:{$user->id}:".now()->format('Y-m-d-H');
            $systemKey = 'gpt_rate_limit:system:'.now()->format('Y-m-d');

            if ((int) Cache::get($userKey, 0) > 0) {
                Cache::decrement($userKey);
            }
            if ((int) Cache::get($systemKey, 0) > 0) {
                Cache::decrement($systemKey);
            }
        });
    }

    /**
     * @param  array<string, mixed>  $boundedContext
     * @return array{
     *     success: bool,
     *     recommendation: array<string, mixed>|null,
     *     usage: array{prompt_tokens: int, completion_tokens: int, total_tokens: int}|null,
     *     cost_usd: float|null,
     *     error_message: string|null,
     *     response_summary: string|null,
     *     is_refusal: bool,
     *     is_timeout: bool
     * }
     */
    public function generateRecommendation(array $boundedContext): array
    {
        $contextJson = json_encode($boundedContext, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
        $estimatedInputTokens = (int) ceil((strlen($this->getSystemPrompt()) + strlen($contextJson)) / 4);
        $maxInputTokens = (int) config('services.openai.max_input_tokens', 32000);

        if ($estimatedInputTokens > $maxInputTokens) {
            return [
                'success' => false,
                'recommendation' => null,
                'usage' => null,
                'cost_usd' => null,
                'error_message' => 'The GPT context exceeds the maximum input size.',
                'response_summary' => null,
                'is_refusal' => false,
                'is_timeout' => false,
            ];
        }

        if (self::$fakeInstance !== null) {
            return self::$fakeInstance->handleFakeCall($boundedContext);
        }

        if ((bool) config('services.openai.fake', false)) {
            return $this->handleFakeCall($boundedContext);
        }

        if (empty($this->apiKey)) {
            return [
                'success' => false,
                'recommendation' => null,
                'usage' => null,
                'cost_usd' => null,
                'error_message' => 'OpenAI API key is not configured.',
                'response_summary' => null,
                'is_refusal' => false,
                'is_timeout' => false,
            ];
        }

        $systemPrompt = $this->getSystemPrompt();
        $userMessage = $contextJson;

        $payload = [
            'model' => $this->model,
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => $userMessage],
            ],
            'max_completion_tokens' => 2000,
            'response_format' => ['type' => 'json_object'],
        ];

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer '.$this->apiKey,
                'Content-Type' => 'application/json',
            ])->timeout(30)->post("{$this->baseUrl}/chat/completions", $payload);

            if ($response->failed()) {
                $status = $response->status();
                Log::warning('OpenAI API request failed.', ['status' => $status]);

                return [
                    'success' => false,
                    'recommendation' => null,
                    'usage' => null,
                    'cost_usd' => null,
                    'error_message' => "OpenAI API service unavailable (HTTP {$status}).",
                    'response_summary' => null,
                    'is_refusal' => false,
                    'is_timeout' => false,
                ];
            }

            $responseData = $response->json();
            $choice = $responseData['choices'][0] ?? null;

            if ($choice === null) {
                return [
                    'success' => false,
                    'recommendation' => null,
                    'usage' => null,
                    'cost_usd' => null,
                    'error_message' => 'Invalid or empty response from OpenAI API.',
                    'response_summary' => null,
                    'is_refusal' => false,
                    'is_timeout' => false,
                ];
            }

            if (($choice['finish_reason'] ?? null) === 'content_filter' || ! empty($choice['message']['refusal'])) {
                return [
                    'success' => false,
                    'recommendation' => null,
                    'usage' => null,
                    'cost_usd' => null,
                    'error_message' => 'The provider refused to generate a recommendation.',
                    'response_summary' => null,
                    'is_refusal' => true,
                    'is_timeout' => false,
                ];
            }

            $content = $choice['message']['content'] ?? '';
            $parsedJson = json_decode($content, true);

            if (! is_array($parsedJson) || ! $this->validateRecommendationStructure($parsedJson)) {
                return [
                    'success' => false,
                    'recommendation' => null,
                    'usage' => null,
                    'cost_usd' => null,
                    'error_message' => 'Model output failed schema validation.',
                    'response_summary' => null,
                    'is_refusal' => false,
                    'is_timeout' => false,
                ];
            }

            $promptTokens = (int) ($responseData['usage']['prompt_tokens'] ?? 0);
            $completionTokens = (int) ($responseData['usage']['completion_tokens'] ?? 0);
            $totalTokens = (int) ($responseData['usage']['total_tokens'] ?? ($promptTokens + $completionTokens));

            // Estimate cost based on standard gpt-5-mini rates ($0.15/1M input, $0.60/1M output)
            $costUsd = round(($promptTokens * 0.00000015) + ($completionTokens * 0.00000060), 4);

            if ($costUsd > (float) config('services.openai.max_cost_usd', 0.05)) {
                return [
                    'success' => false,
                    'recommendation' => null,
                    'usage' => [
                        'prompt_tokens' => $promptTokens,
                        'completion_tokens' => $completionTokens,
                        'total_tokens' => $totalTokens,
                    ],
                    'cost_usd' => $costUsd,
                    'error_message' => 'The estimated GPT cost exceeds the configured ceiling.',
                    'response_summary' => null,
                    'is_refusal' => false,
                    'is_timeout' => false,
                ];
            }

            $safeRecommendation = $this->sanitizeRecommendation($parsedJson, $boundedContext);

            return [
                'success' => true,
                'recommendation' => $safeRecommendation,
                'usage' => [
                    'prompt_tokens' => $promptTokens,
                    'completion_tokens' => $completionTokens,
                    'total_tokens' => $totalTokens,
                ],
                'cost_usd' => $costUsd,
                'error_message' => null,
                'response_summary' => $safeRecommendation['summary'] ?? 'Generated recommendation',
                'is_refusal' => false,
                'is_timeout' => false,
            ];
        } catch (ConnectionException $e) {
            return [
                'success' => false,
                'recommendation' => null,
                'usage' => null,
                'cost_usd' => null,
                'error_message' => 'OpenAI API connection timed out.',
                'response_summary' => null,
                'is_refusal' => false,
                'is_timeout' => true,
            ];
        } catch (\Throwable $e) {
            Log::error('OpenAI client exception.', ['exception' => $e::class]);

            return [
                'success' => false,
                'recommendation' => null,
                'usage' => null,
                'cost_usd' => null,
                'error_message' => 'OpenAI API request failed.',
                'response_summary' => null,
                'is_refusal' => false,
                'is_timeout' => false,
            ];
        }
    }

    /**
     * @param  array<string, mixed>  $boundedContext
     * @return array{
     *     success: bool,
     *     recommendation: array<string, mixed>|null,
     *     usage: array{prompt_tokens: int, completion_tokens: int, total_tokens: int}|null,
     *     cost_usd: float|null,
     *     error_message: string|null,
     *     response_summary: string|null,
     *     is_refusal: bool,
     *     is_timeout: bool
     * }
     */
    private function handleFakeCall(array $boundedContext): array
    {
        self::$recordedRequests[] = [
            'model' => $this->model,
            'messages' => [
                ['role' => 'system', 'content' => $this->getSystemPrompt()],
                ['role' => 'user', 'content' => (string) json_encode($boundedContext)],
            ],
            'context' => $boundedContext,
        ];

        if (is_callable(self::$fakeResponseResolver)) {
            $resolved = (self::$fakeResponseResolver)($boundedContext);
        } elseif (is_array(self::$fakeResponseResolver)) {
            $resolved = self::$fakeResponseResolver;
        } else {
            $resolved = $this->defaultFakeRecommendation($boundedContext);
        }

        if (isset($resolved['success']) && $resolved['success'] === false) {
            return [
                'success' => false,
                'recommendation' => null,
                'usage' => $resolved['usage'] ?? null,
                'cost_usd' => $resolved['cost_usd'] ?? null,
                'error_message' => $resolved['error_message'] ?? 'Fake model error',
                'response_summary' => $resolved['response_summary'] ?? null,
                'is_refusal' => $resolved['is_refusal'] ?? false,
                'is_timeout' => $resolved['is_timeout'] ?? false,
            ];
        }

        $recommendation = $resolved['recommendation'] ?? $resolved;
        if (! $this->validateRecommendationStructure($recommendation)) {
            return [
                'success' => false,
                'recommendation' => null,
                'usage' => null,
                'cost_usd' => null,
                'error_message' => 'Model output failed schema validation.',
                'response_summary' => 'Invalid fake response structure',
                'is_refusal' => false,
                'is_timeout' => false,
            ];
        }

        $recommendation = $this->sanitizeRecommendation($recommendation, $boundedContext);

        return [
            'success' => true,
            'recommendation' => $recommendation,
            'usage' => $resolved['usage'] ?? ['prompt_tokens' => 250, 'completion_tokens' => 150, 'total_tokens' => 400],
            'cost_usd' => $resolved['cost_usd'] ?? 0.0002,
            'error_message' => null,
            'response_summary' => $recommendation['summary'] ?? 'Generated recommendation',
            'is_refusal' => false,
            'is_timeout' => false,
        ];
    }

    /** @param array<string, mixed> $data */
    private function validateRecommendationStructure(array $data): bool
    {
        return isset($data['summary']) && is_string($data['summary'])
            && isset($data['proposed_personnel']) && is_array($data['proposed_personnel'])
            && isset($data['proposed_assets']) && is_array($data['proposed_assets'])
            && isset($data['reasons']) && is_array($data['reasons'])
            && isset($data['assumptions']) && is_array($data['assumptions']);
    }

    /**
     * @param  array<string, mixed>  $recommendation
     * @param  array<string, mixed>  $boundedContext
     * @return array<string, mixed>
     */
    private function sanitizeRecommendation(array $recommendation, array $boundedContext): array
    {
        $sensitive = [];
        $job = $boundedContext['job'] ?? [];
        if (is_array($job)) {
            foreach (['reference', 'title', 'site', 'site_name', 'client'] as $key) {
                $value = $job[$key] ?? null;
                if (is_string($value) && mb_strlen($value) >= 3) {
                    $sensitive[] = $value;
                }
            }
        }

        $redact = function (mixed $value) use (&$redact, $sensitive): mixed {
            if (is_array($value)) {
                return array_map($redact, $value);
            }

            if (! is_string($value)) {
                return $value;
            }

            foreach ($sensitive as $secret) {
                $value = (string) preg_replace('/'.preg_quote($secret, '/').'/i', '[REDACTED]', $value);
            }

            $value = (string) preg_replace('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', '[REDACTED_EMAIL]', $value);
            $value = (string) preg_replace('/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/', '[REDACTED_PHONE]', $value);
            $value = (string) preg_replace('/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/', '[REDACTED_GPS]', $value);
            $value = (string) preg_replace('/\b(?:sk|pk|token|bearer)[-_:\s]*[A-Za-z0-9._-]{8,}\b/i', '[REDACTED_SECRET]', $value);

            return mb_substr($value, 0, 500);
        };

        /** @var array<string, mixed> $safe */
        $safe = $redact($recommendation);

        return $safe;
    }

    /** @param array<string, mixed> $boundedContext
     * @return array<string, mixed>
     */
    private function defaultFakeRecommendation(array $boundedContext): array
    {
        $personnelCandidates = is_array($boundedContext['personnel_candidates'] ?? null) ? $boundedContext['personnel_candidates'] : [];
        $assetCandidates = is_array($boundedContext['asset_candidates'] ?? null) ? $boundedContext['asset_candidates'] : [];

        $eligibleUser = null;
        foreach ($personnelCandidates as $candidate) {
            if (is_array($candidate) && ! empty($candidate['eligible'])) {
                $eligibleUser = $candidate;
                break;
            }
        }

        $eligibleAsset = null;
        foreach ($assetCandidates as $candidate) {
            if (is_array($candidate) && ! empty($candidate['eligible'])) {
                $eligibleAsset = $candidate;
                break;
            }
        }

        $proposedPersonnel = [];
        if (is_array($eligibleUser)) {
            $proposedPersonnel[] = [
                'user_id' => $eligibleUser['user_id'],
                'assignment_type' => $eligibleUser['assignment_type'],
            ];
        }

        $proposedAssets = [];
        if (is_array($eligibleAsset)) {
            $proposedAssets[] = [
                'operational_asset_id' => $eligibleAsset['asset_id'],
                'assignment_type' => $eligibleAsset['kind'],
            ];
        }

        return [
            'summary' => 'Recommend assigning eligible personnel and equipment for scheduled job window.',
            'proposed_personnel' => $proposedPersonnel,
            'proposed_assets' => $proposedAssets,
            'proposed_schedule' => [
                ['07:00', 'Check equipment & depart yard'],
                ['08:00', 'Arrive at site'],
                ['16:00', 'Complete operations'],
            ],
            'reasons' => [
                'Assigned candidates hold valid credentials and pass availability checks.',
                'Assets meet readiness and safety inspection standards.',
            ],
            'assumptions' => [
                'Site access and weather conditions remain clear during operations.',
            ],
            'conflicts' => [],
        ];
    }

    private function getSystemPrompt(): string
    {
        return <<<'PROMPT'
You are an advisory operational assistant for a industrial fleet and crane dispatch platform.
Your task is to analyze the provided bounded dispatch job requirements, eligible personnel candidates, and eligible asset candidates, and output an explainable recommendation.

STRICT CONSTRAINTS:
1. You are strictly ADVISORY. You CANNOT execute operational changes or approve exceptional work.
2. Select ONLY personnel and assets marked as "eligible: true" in the context, unless noting explicit conflicts.
3. Respond ONLY in valid JSON matching this exact structure:
{
  "summary": "String concise summary of recommendation",
  "proposed_personnel": [
    { "user_id": 123, "assignment_type": "driver|crane_operator" }
  ],
  "proposed_assets": [
    { "operational_asset_id": 456, "assignment_type": "truck|crane|equipment" }
  ],
  "proposed_schedule": [
    ["08:00", "Event description"]
  ],
  "reasons": [
    "String reason 1",
    "String reason 2"
  ],
  "assumptions": [
    "String assumption 1"
  ],
  "conflicts": [
    "String conflict 1"
  ]
}
PROMPT;
    }
}
