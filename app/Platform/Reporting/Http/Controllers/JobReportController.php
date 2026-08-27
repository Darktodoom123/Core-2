<?php

namespace App\Platform\Reporting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Reporting\Actions\ResubmitJobReport;
use App\Platform\Reporting\Actions\ReviewJobReport;
use App\Platform\Reporting\Actions\SaveJobReportDraft;
use App\Platform\Reporting\Actions\SubmitJobReport;
use App\Platform\Reporting\Http\Requests\ResubmitJobReportRequest;
use App\Platform\Reporting\Http\Requests\ReviewJobReportRequest;
use App\Platform\Reporting\Http\Requests\StoreJobReportRequest;
use App\Platform\Reporting\Models\JobReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class JobReportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $reports = JobReport::query()
            ->visibleTo($request->user())
            ->with(['job', 'author', 'attachments'])
            ->latest('submitted_at')
            ->paginate(25);

        return response()->json($reports);
    }

    public function show(JobReport $jobReport, Request $request): JsonResponse
    {
        Gate::authorize('view', $jobReport);

        $jobReport->load(['job', 'author', 'attachments']);

        return response()->json(['data' => $jobReport]);
    }

    public function store(StoreJobReportRequest $request, SubmitJobReport $submitAction, SaveJobReportDraft $draftAction): RedirectResponse|JsonResponse
    {
        /** @var array{dispatch_job_id: int, started_at?: string|null, ended_at?: string|null, ending_meter_value?: float|int|null, meter_type?: string|null, latitude?: float|null, longitude?: float|null, work_summary: string, remarks?: string|null, is_draft?: bool|null, attachments?: array<int, mixed>} $validated */
        $validated = $request->validated();
        try {
            if (! empty($validated['is_draft'])) {
                $report = $draftAction->execute($request->user(), $validated);
                $message = "Job report draft saved for dispatch #{$report->dispatch_job_id}.";
            } else {
                $report = $submitAction->execute($request->user(), $validated);
                $message = "Job report submitted for dispatch #{$report->dispatch_job_id}.";
            }
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages(['attachments' => $exception->getMessage()]);
        }

        if ($request->wantsJson()) {
            return response()->json(['data' => $report->load(['job', 'author', 'attachments'])], 201);
        }

        return redirect()->back()->with('flash', [
            'type' => 'success',
            'message' => $message,
        ]);
    }

    public function resubmit(JobReport $jobReport, ResubmitJobReportRequest $request, ResubmitJobReport $action): RedirectResponse|JsonResponse
    {
        /** @var array{started_at?: string|null, ended_at?: string|null, ending_meter_value?: float|int|null, meter_type?: string|null, latitude?: float|null, longitude?: float|null, work_summary: string, remarks?: string|null, attachments?: array<int, mixed>} $validated */
        $validated = $request->validated();
        try {
            $report = $action->execute($request->user(), $jobReport, $validated);
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages(['attachments' => $exception->getMessage()]);
        }

        if ($request->wantsJson()) {
            return response()->json(['data' => $report->load(['job', 'author', 'attachments'])]);
        }

        return redirect()->back()->with('flash', [
            'type' => 'success',
            'message' => "Job report resubmitted for dispatch #{$report->dispatch_job_id}.",
        ]);
    }

    public function review(JobReport $jobReport, ReviewJobReportRequest $request, ReviewJobReport $action): RedirectResponse|JsonResponse
    {
        $report = $action->execute(
            $request->user(),
            $jobReport,
            (string) $request->validated('status'),
            $request->validated('reason')
        );

        if ($request->wantsJson()) {
            return response()->json(['data' => $report]);
        }

        return redirect()->back()->with('flash', [
            'type' => 'success',
            'message' => "Job report review completed ({$report->status->value}).",
        ]);
    }
}
