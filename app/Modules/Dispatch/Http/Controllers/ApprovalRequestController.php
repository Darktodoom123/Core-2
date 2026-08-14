<?php

namespace App\Modules\Dispatch\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Actions\DecideApprovalRequest;
use App\Modules\Dispatch\Commands\DispatchV2Commands;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Http\Requests\DecideApprovalRequestRequest;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Http\RedirectResponse;

final class ApprovalRequestController extends Controller
{
    public function decide(
        DecideApprovalRequestRequest $request,
        ApprovalRequest $approvalRequest,
        DecideApprovalRequest $action,
        DispatchV2Commands $commands,
    ): RedirectResponse {
        $status = ApprovalStatus::from($request->validated('status'));
        $reason = $request->validated('reason');

        if (config('dispatch.v2_commands_enabled') && $approvalRequest->subject instanceof DispatchJob) {
            $job = $approvalRequest->subject;
            $attempt = $job->canonicalHandoff?->attempts()->latest('attempt_number')->first()
                ?? $job->currentAttempt;

            if ($attempt !== null) {
                $mutation = DispatchV2Mutation::forVersion(
                    expectedVersion: $attempt->version,
                    reason: $reason,
                );

                try {
                    if ($status === ApprovalStatus::Approved) {
                        $commands->approvePlan($request->user(), $attempt, $mutation);
                    } else {
                        $commands->rejectPlan($request->user(), $attempt, $mutation);
                    }
                } catch (\Throwable) {
                    // Fallback to legacy action if V2 command is not applicable
                }
            }
        }

        $action->handle($request->user(), $approvalRequest, $status, $reason);

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Approval request was {$status->value}.",
        ]);
    }
}
