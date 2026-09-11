<?php

namespace App\Platform\Reporting\Http\Controllers\Api\V1;

use App\Platform\Reporting\Actions\SaveJobReportDraft;
use App\Platform\Reporting\Actions\SubmitJobReport;
use App\Platform\Reporting\Http\Controllers\JobReportController as BaseJobReportController;
use App\Platform\Reporting\Http\Requests\StoreJobReportRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

class JobReportController extends BaseJobReportController
{
    public function store(StoreJobReportRequest $request, SubmitJobReport $submitAction, SaveJobReportDraft $draftAction): RedirectResponse|JsonResponse
    {
        /** @var array{dispatch_job_id: int, started_at?: string|null, ended_at?: string|null, ending_meter_value?: float|int|null, meter_type?: string|null, latitude?: float|null, longitude?: float|null, work_summary: string, remarks?: string|null, is_draft?: bool|null, signer_name?: string|null, signer_role?: string|null, signed_at?: string|null, attachments?: array<int, mixed>} $validated */
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

        if ($request->is('api/*') || $request->wantsJson()) {
            return response()->json(['data' => $report->load(['job', 'author', 'attachments'])], 201);
        }

        return redirect()->back()->with('flash', [
            'type' => 'success',
            'message' => $message,
        ]);
    }
}
