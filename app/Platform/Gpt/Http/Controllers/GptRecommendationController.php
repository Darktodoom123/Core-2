<?php

namespace App\Platform\Gpt\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Gpt\Actions\AcceptGptRecommendation;
use App\Platform\Gpt\Actions\GenerateGptRecommendation;
use App\Platform\Gpt\Actions\RejectGptRecommendation;
use App\Platform\Gpt\Actions\RetryGptRecommendation;
use App\Platform\Gpt\Models\GptRecommendation;
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
}
