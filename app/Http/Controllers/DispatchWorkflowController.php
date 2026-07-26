<?php

namespace App\Http\Controllers;

use App\Actions\ActivateDispatchJob;
use App\Actions\ArchiveDispatchJob;
use App\Actions\AssignDispatchResources;
use App\Actions\CancelDispatchJob;
use App\Actions\ReassignDispatchResources;
use App\Actions\ReopenDispatchJob;
use App\Actions\RespondToDispatchAssignment;
use App\Actions\RestoreDispatchJob;
use App\Actions\TransitionDispatchJob;
use App\Enums\AssignmentResponse;
use App\Enums\DispatchStatus;
use App\Http\Requests\ActivateDispatchJobRequest;
use App\Http\Requests\ArchiveDispatchJobRequest;
use App\Http\Requests\AssignDispatchResourcesRequest;
use App\Http\Requests\CancelDispatchJobRequest;
use App\Http\Requests\ReassignDispatchResourcesRequest;
use App\Http\Requests\ReopenDispatchJobRequest;
use App\Http\Requests\RespondToDispatchAssignmentRequest;
use App\Http\Requests\RestoreDispatchJobRequest;
use App\Http\Requests\TransitionDispatchJobRequest;
use App\Models\DispatchJob;
use App\Models\DispatchPersonnelAssignment;
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

    public function reassign(
        ReassignDispatchResourcesRequest $request,
        DispatchJob $dispatchJob,
        ReassignDispatchResources $action,
    ): RedirectResponse {
        $result = $action->handle(
            $request->user(),
            $dispatchJob,
            $request->validated('end_personnel_assignment_ids', []),
            $request->validated('end_asset_assignment_ids', []),
            $request->validated('personnel', []),
            $request->validated('assets', []),
            $request->validated('reason'),
            (int) $request->validated('version'),
        );

        return to_route('dispatch-jobs.show', $dispatchJob)->with('flash', [
            'tone' => 'success',
            'message' => $result->approvalRequested()
                ? "The reassignment for {$dispatchJob->reference} was sent for independent approval."
                : "Assignments were updated for {$dispatchJob->reference}.",
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

    public function cancel(
        CancelDispatchJobRequest $request,
        DispatchJob $dispatchJob,
        CancelDispatchJob $action,
    ): RedirectResponse {
        $job = $action->handle(
            $request->user(),
            $dispatchJob,
            $request->validated('reason'),
            (int) $request->validated('version'),
        );

        return to_route('dispatch-jobs.show', $job)->with('flash', [
            'tone' => 'warning',
            'message' => "Dispatch {$job->reference} was cancelled.",
        ]);
    }

    public function reopen(
        ReopenDispatchJobRequest $request,
        DispatchJob $dispatchJob,
        ReopenDispatchJob $action,
    ): RedirectResponse {
        $job = $action->handle(
            $request->user(),
            $dispatchJob,
            $request->validated('reason'),
            (int) $request->validated('version'),
        );

        return to_route('dispatch-jobs.show', $job)->with('flash', [
            'tone' => 'success',
            'message' => "Dispatch {$job->reference} was reopened as draft.",
        ]);
    }

    public function archive(
        ArchiveDispatchJobRequest $request,
        DispatchJob $dispatchJob,
        ArchiveDispatchJob $action,
    ): RedirectResponse {
        $action->handle(
            $request->user(),
            $dispatchJob,
            $request->validated('reason'),
        );

        return to_route('home')->with('flash', [
            'tone' => 'info',
            'message' => "Dispatch {$dispatchJob->reference} was archived.",
        ]);
    }

    public function restore(
        RestoreDispatchJobRequest $request,
        int $dispatchJob,
        RestoreDispatchJob $action,
    ): RedirectResponse {
        $job = $action->handle(
            $request->user(),
            $dispatchJob,
            $request->validated('reason'),
        );

        return to_route('dispatch-jobs.show', $job)->with('flash', [
            'tone' => 'success',
            'message' => "Dispatch {$job->reference} was restored.",
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

    public function respondAssignment(
        RespondToDispatchAssignmentRequest $request,
        DispatchJob $dispatchJob,
        DispatchPersonnelAssignment $assignment,
        RespondToDispatchAssignment $action,
    ): RedirectResponse {
        $response = AssignmentResponse::from($request->validated('response'));
        $action->handle(
            $request->user(),
            $dispatchJob,
            $assignment,
            $response,
            $request->validated('reason'),
            (int) $request->validated('version'),
        );

        $actionLabel = strtolower($response->label());
        $redirect = $response === AssignmentResponse::Rejected
            && ! $dispatchJob->personnelAssignments()
                ->where('user_id', $request->user()->id)
                ->whereNull('active_until')
                ->exists()
            ? to_route('home')
            : to_route('dispatch-jobs.show', $dispatchJob);

        return $redirect->with('flash', [
            'tone' => 'success',
            'message' => "Assignment was {$actionLabel} for {$dispatchJob->reference}.",
        ]);
    }
}
