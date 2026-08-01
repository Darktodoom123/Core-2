<?php

namespace App\Modules\Dispatch\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Actions\DecideApprovalRequest;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Http\Requests\DecideApprovalRequestRequest;
use App\Modules\Dispatch\Models\ApprovalRequest;
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
