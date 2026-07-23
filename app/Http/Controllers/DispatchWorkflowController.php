<?php

namespace App\Http\Controllers;

use App\Actions\ActivateDispatchJob;
use App\Actions\AssignDispatchResources;
use App\Actions\TransitionDispatchJob;
use App\Enums\DispatchStatus;
use App\Http\Requests\AssignDispatchResourcesRequest;
use App\Http\Requests\TransitionDispatchJobRequest;
use App\Models\DispatchJob;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class DispatchWorkflowController extends Controller
{
    public function assign(AssignDispatchResourcesRequest $request, DispatchJob $dispatchJob, AssignDispatchResources $action): RedirectResponse
    {
        $action->handle(
            $request->user(),
            $dispatchJob,
            $request->validated('personnel', []),
            $request->validated('assets', []),
        );

        return to_route('dispatch-jobs.show', $dispatchJob)->with('flash', [
            'tone' => 'success',
            'message' => "Resources were assigned to {$dispatchJob->reference}.",
        ]);
    }

    public function activate(Request $request, DispatchJob $dispatchJob, ActivateDispatchJob $action): JsonResponse
    {
        $validated = $request->validate(['version' => ['required', 'integer', 'min:1']]);

        return response()->json(['data' => $action->handle($request->user(), $dispatchJob, $validated['version'])]);
    }

    public function transition(TransitionDispatchJobRequest $request, DispatchJob $dispatchJob, TransitionDispatchJob $action): JsonResponse
    {
        return response()->json(['data' => $action->handle($request->user(), $dispatchJob, DispatchStatus::from($request->validated('status')), $request->integer('version'))]);
    }
}
