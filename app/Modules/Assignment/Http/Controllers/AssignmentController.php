<?php

namespace App\Modules\Assignment\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Actions\AssignDispatchResources;
use App\Modules\Assignment\Actions\ReassignDispatchResources;
use App\Modules\Assignment\Actions\RespondToDispatchAssignment;
use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Http\Requests\AssignDispatchResourcesRequest;
use App\Modules\Assignment\Http\Requests\ReassignDispatchResourcesRequest;
use App\Modules\Assignment\Http\Requests\RespondToDispatchAssignmentRequest;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Http\RedirectResponse;

final class AssignmentController extends Controller
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
                : 'Assignments were updated for '.$dispatchJob->reference.'.',
        ]);
    }

    public function respond(
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
