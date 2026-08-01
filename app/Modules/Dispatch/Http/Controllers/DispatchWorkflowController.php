<?php

namespace App\Modules\Dispatch\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Actions\ActivateDispatchJob;
use App\Modules\Dispatch\Actions\ArchiveDispatchJob;
use App\Modules\Dispatch\Actions\CancelDispatchJob;
use App\Modules\Dispatch\Actions\ReopenDispatchJob;
use App\Modules\Dispatch\Actions\RestoreDispatchJob;
use App\Modules\Dispatch\Actions\TransitionDispatchJob;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Http\Requests\ActivateDispatchJobRequest;
use App\Modules\Dispatch\Http\Requests\ArchiveDispatchJobRequest;
use App\Modules\Dispatch\Http\Requests\CancelDispatchJobRequest;
use App\Modules\Dispatch\Http\Requests\ReopenDispatchJobRequest;
use App\Modules\Dispatch\Http\Requests\RestoreDispatchJobRequest;
use App\Modules\Dispatch\Http\Requests\TransitionDispatchJobRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Http\RedirectResponse;

final class DispatchWorkflowController extends Controller
{
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
}
