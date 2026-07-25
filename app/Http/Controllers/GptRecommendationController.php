<?php

namespace App\Http\Controllers;

use App\Actions\AcceptGptRecommendation;
use App\Actions\GenerateGptRecommendation;
use App\Actions\RejectGptRecommendation;
use App\Models\DispatchJob;
use App\Models\GptRecommendation;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class GptRecommendationController extends Controller
{
    public function store(Request $request, GenerateGptRecommendation $generateAction): RedirectResponse
    {
        $validated = $request->validate([
            'subject_type' => ['required', 'string'],
            'subject_id' => ['required', 'integer'],
            'purpose' => ['nullable', 'string', 'max:48'],
        ]);

        $subjectType = $validated['subject_type'];
        if (! class_exists($subjectType)) {
            throw ValidationException::withMessages([
                'subject_type' => 'Invalid subject model type.',
            ]);
        }

        $subject = match ($subjectType) {
            DispatchJob::class => DispatchJob::query()->where('id', $validated['subject_id'])->firstOrFail(),
            default => throw ValidationException::withMessages([
                'subject_type' => 'Unsupported subject model.',
            ]),
        };

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
}
