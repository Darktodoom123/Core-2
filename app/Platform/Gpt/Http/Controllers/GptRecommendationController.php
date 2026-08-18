<?php

namespace App\Platform\Gpt\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Gpt\Actions\AcceptGptRecommendation;
use App\Platform\Gpt\Actions\GenerateGptRecommendation;
use App\Platform\Gpt\Actions\RejectGptRecommendation;
use App\Platform\Gpt\Actions\RetryGptRecommendation;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Models\GptRecommendationMetric;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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
            'purpose' => ['nullable', 'string', 'max:48', Rule::in(['dispatch_assignment', 'operations_review', 'maintenance_advice'])],
        ]);

        $subjectType = $validated['subject_type'];
        $dispatchMorphClass = (new DispatchJob)->getMorphClass();
        if (! in_array($subjectType, [DispatchJob::class, $dispatchMorphClass], true)) {
            throw ValidationException::withMessages([
                'subject_type' => 'Invalid subject model type.',
            ]);
        }

        $subject = DispatchJob::query()->whereKey($validated['subject_id'])->firstOrFail();

        Gate::forUser($request->user())->authorize('view', $subject);

        $purpose = $validated['purpose'] ?? 'dispatch_assignment';
        $generateAction->handle($request->user(), $subject, $purpose);

        return redirect()->back()->with('flash', [
            'success' => 'GPT recommendation request queued for processing.',
        ]);
    }

    public function accept(Request $request, GptRecommendation $recommendation, AcceptGptRecommendation $acceptAction): RedirectResponse
    {
        $acceptAction->handle($request->user(), $recommendation);

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

    public function toggleCircuitBreaker(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->hasRole(RoleName::SystemAdministrator->value) || $actor->can(PermissionName::GptConfigure->value), 403);

        $currentState = (bool) Cache::get('gpt_circuit_breaker_disabled', false);
        $newState = ! $currentState;
        Cache::forever('gpt_circuit_breaker_disabled', $newState);

        return response()->json([
            'circuit_breaker_active' => $newState,
            'message' => $newState
                ? 'GPT Advisory circuit breaker activated. AI requests paused.'
                : 'GPT Advisory resumed successfully.',
        ]);
    }

    public function governanceTelemetry(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->hasRole(RoleName::SystemAdministrator->value) || $actor->can(PermissionName::GptConfigure->value), 403);

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
        $acceptanceRate = $totalDecided > 0 ? round(($accepted / $totalDecided) * 100, 1) : 100.0;

        return response()->json([
            'monthly_spend_usd' => $monthlySpend,
            'monthly_budget_ceiling_usd' => 250.0,
            'total_tokens' => $totalTokens,
            'avg_latency_ms' => $avgLatencyMs,
            'acceptance_rate' => $acceptanceRate,
            'accepted_count' => $accepted,
            'rejected_count' => $rejected,
            'circuit_breaker_active' => (bool) Cache::get('gpt_circuit_breaker_disabled', false),
        ]);
    }
}
