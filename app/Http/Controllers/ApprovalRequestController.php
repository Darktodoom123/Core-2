<?php

namespace App\Http\Controllers;

use App\Actions\DecideApprovalRequest;
use App\Enums\ApprovalStatus;
use App\Http\Requests\DecideApprovalRequestRequest;
use App\Models\ApprovalRequest;
use Illuminate\Http\RedirectResponse;

final class ApprovalRequestController extends Controller
{
    public function decide(
        DecideApprovalRequestRequest $request,
        ApprovalRequest $approvalRequest,
        DecideApprovalRequest $action,
    ): RedirectResponse {
        $status = ApprovalStatus::from($request->validated('status'));
        $action->handle($request->user(), $approvalRequest, $status, $request->validated('reason'));

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Approval request was {$status->value}.",
        ]);
    }
}
