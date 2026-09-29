<?php

namespace App\Platform\Gpt\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Gpt\Actions\AcceptGptRecommendation;
use App\Platform\Gpt\Actions\GenerateGptRecommendation;
use App\Platform\Gpt\Actions\RejectGptRecommendation;
use App\Platform\Gpt\Actions\RetryGptRecommendation;
use App\Platform\Gpt\Actions\SetGptCircuitBreaker;
use App\Platform\Gpt\Enums\GptRecommendationStatus;
use App\Platform\Gpt\Http\Requests\AcceptGptRecommendationRequest;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Models\GptRecommendationMetric;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class GptRecommendationController extends Controller
{
    public function store(Request $request, GenerateGptRecommendation $generateAction): RedirectResponse
    {
        $validated = $request->validate([
            'subject_type' => ['required', 'string'],
            'subject_id' => ['required', 'integer'],
            'purpose' => ['nullable', 'string', 'max:48', Rule::in(['dispatch_assignment', 'dispatch_blocker_resolution', 'operations_review', 'maintenance_advice'])],
            'refresh' => ['sometimes', 'boolean'],
        ]);

        $subjectType = $validated['subject_type'];
        $dispatchMorphClass = (new DispatchJob)->getMorphClass();
        if (! in_array($subjectType, ['dispatch_job', DispatchJob::class, $dispatchMorphClass], true)) {
            throw ValidationException::withMessages([
                'subject_type' => 'Invalid subject model type.',
            ]);
        }

        $subject = DispatchJob::query()->whereKey($validated['subject_id'])->firstOrFail();

        Gate::forUser($request->user())->authorize('view', $subject);

        $purpose = $validated['purpose'] ?? (config('services.openai.blocker_resolution_enabled', false) ? 'dispatch_blocker_resolution' : 'dispatch_assignment');
        if ($purpose === 'dispatch_blocker_resolution' && ! config('services.openai.blocker_resolution_enabled', false)) {
            throw ValidationException::withMessages(['gpt' => 'Blocker assistance is not enabled.']);
        }
        $generateAction->handle($request->user(), $subject, $purpose, refresh: $purpose === 'dispatch_blocker_resolution' && (bool) ($validated['refresh'] ?? false));

        return redirect()->back()->with('flash', [
            'success' => 'GPT recommendation request queued for processing.',
        ]);
    }

    public function accept(AcceptGptRecommendationRequest $request, GptRecommendation $recommendation, AcceptGptRecommendation $acceptAction): RedirectResponse
    {
        if ($recommendation->purpose === 'dispatch_blocker_resolution') {
            throw ValidationException::withMessages(['gpt' => 'Review a blocker option in the assignment workspace.']);
        }
        $acceptAction->handle(
            $request->user(),
            $recommendation,
            $request->selectedPersonnel(),
            $request->selectedAssets(),
        );

        return redirect()->back()->with('flash', [
            'success' => 'GPT recommendation accepted. Resource plan confirmed.',
        ]);
    }

    public function reject(Request $request, GptRecommendation $recommendation, RejectGptRecommendation $rejectAction): RedirectResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $rejectAction->handle($request->user(), $recommendation, $validated['reason'] ?? null);

        return redirect()->back()->with('flash', [
            'info' => 'GPT recommendation rejected.',
        ]);
    }

    public function retry(Request $request, GptRecommendation $recommendation, RetryGptRecommendation $retryAction): RedirectResponse
    {
        $retryAction->handle($request->user(), $recommendation);

        return redirect()->back()->with('flash', [
            'success' => 'A fresh GPT recommendation request was queued.',
        ]);
    }

    /** Kept for older clients; flips the current state through the same audited action. */
    public function toggleCircuitBreaker(Request $request, SetGptCircuitBreaker $breaker): JsonResponse
    {
        $actor = $request->user();
        $this->authorizeGovernance($actor);

        return $this->circuitBreakerResponse($breaker->handle($actor, ! SetGptCircuitBreaker::isPaused()));
    }

    public function setCircuitBreaker(Request $request, SetGptCircuitBreaker $breaker): JsonResponse
    {
        $actor = $request->user();
        $this->authorizeGovernance($actor);

        $validated = $request->validate([
            'paused' => ['required', 'boolean'],
            'reason' => ['required_if:paused,true', 'nullable', 'string', 'max:255'],
        ]);

        return $this->circuitBreakerResponse($breaker->handle($actor, (bool) $validated['paused'], $validated['reason'] ?? null));
    }

    public function governanceTelemetry(Request $request): JsonResponse
    {
        $this->authorizeGovernance($request->user());

        $monthlyMetrics = GptRecommendationMetric::query()
            ->where('occurred_at', '>=', now()->startOfMonth())
            ->get();

        $monthlySpend = (float) $monthlyMetrics->sum('cost_usd');
        $totalTokens = (int) $monthlyMetrics->sum('total_tokens');
        $avgLatencyMs = (int) ($monthlyMetrics->avg('latency_ms') ?? 0);

        $recommendations = GptRecommendation::query()
            ->where('created_at', '>=', now()->startOfMonth())
            ->get();

        $accepted = $recommendations->where('status', 'accepted')->count();
        $rejected = $recommendations->where('status', 'rejected')->count();
        $totalDecided = $accepted + $rejected;
        $acceptanceRate = $totalDecided > 0 ? round(($accepted / $totalDecided) * 100, 1) : null;

        $blockerRecommendations = $recommendations->where('purpose', 'dispatch_blocker_resolution')->keyBy('id');
        $blockerMetrics = $monthlyMetrics->whereIn('recommendation_id', $blockerRecommendations->keys());
        $resolvedMetrics = $blockerMetrics->where('event', 'blocker_resolved');
        $resolutionSeconds = $resolvedMetrics->map(static function (GptRecommendationMetric $metric) use ($blockerRecommendations): ?float {
            $recommendation = $blockerRecommendations->get($metric->recommendation_id);

            return $recommendation?->generated_at === null
                ? null
                : $recommendation->generated_at->diffInSeconds($metric->occurred_at);
        })->filter(static fn (?float $seconds): bool => $seconds !== null);

        return response()->json([
            'monthly_spend_usd' => $monthlySpend,
            'monthly_budget_ceiling_usd' => (float) config('services.openai.monthly_budget_usd'),
            'total_tokens' => $totalTokens,
            'avg_latency_ms' => $avgLatencyMs,
            'acceptance_rate' => $acceptanceRate,
            'accepted_count' => $accepted,
            'rejected_count' => $rejected,
            'blocker_advice' => [
                'generated' => $blockerRecommendations->count(),
                'no_eligible_option' => $blockerMetrics->where('event', 'no_eligible_option')->count(),
                'failed' => $blockerRecommendations->where('status', GptRecommendationStatus::Failed)->count(),
                'stale' => $blockerRecommendations->where('status', GptRecommendationStatus::Stale)->count(),
                'opened' => $blockerMetrics->where('event', 'review_opened')->count(),
                'adopted' => $blockerMetrics->where('event', 'adopted')->count(),
                'edited' => $blockerMetrics->where('event', 'edited_after_review')->count(),
                'resolved' => $resolvedMetrics->count(),
                'ready_after_save' => $blockerMetrics->where('event', 'job_ready')->count(),
                'average_seconds_to_resolution' => $resolutionSeconds->isEmpty() ? null : (int) round($resolutionSeconds->avg()),
            ],
            'circuit_breaker_active' => SetGptCircuitBreaker::isPaused(),
        ]);
    }

    private function authorizeGovernance(User $actor): void
    {
        abort_unless($actor->hasRole(RoleName::SystemAdministrator->value) || $actor->can(PermissionName::GptConfigure->value), 403);
    }

    private function circuitBreakerResponse(bool $paused): JsonResponse
    {
        return response()->json([
            'circuit_breaker_active' => $paused,
            'message' => $paused
                ? 'GPT advice is paused. No new AI requests will be sent.'
                : 'GPT advice resumed.',
        ]);
    }
}
