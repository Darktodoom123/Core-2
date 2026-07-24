<?php

namespace App\Http\Controllers;

use App\Actions\ActivateDispatchJob;
use App\Actions\AssignDispatchResources;
use App\Actions\TransitionDispatchJob;
use App\Enums\DispatchStatus;
use App\Http\Requests\ActivateDispatchJobRequest;
use App\Http\Requests\AssignDispatchResourcesRequest;
use App\Http\Requests\TransitionDispatchJobRequest;
use App\Models\DispatchJob;
use Illuminate\Http\RedirectResponse;

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

    public function activate(
        ActivateDispatchJobRequest $request,
        DispatchJob $dispatchJob,
        ActivateDispatchJob $action,
    ): RedirectResponse {
        $action->handle($request->user(), $dispatchJob, (int) $request->validated('version'));

        return to_route('dispatch-jobs.show', $dispatchJob)->with('flash', [
            'tone' => 'success',
            'message' => "Dispatch {$dispatchJob->reference} was activated.",
        ]);
    }

    public function transition(
        TransitionDispatchJobRequest $request,
        DispatchJob $dispatchJob,
        TransitionDispatchJob $action,
    ): RedirectResponse {
        $job = $action->handle(
            $request->user(),
            $dispatchJob,
            DispatchStatus::from($request->validated('status')),
            $request->integer('version'),
        );

        return to_route('dispatch-jobs.show', $job)->with('flash', [
            'tone' => 'success',
            'message' => "{$job->reference} is now {$job->status->label()}.",
        ]);
    }
}
