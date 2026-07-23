<?php

namespace App\Http\Controllers;

use App\Actions\DecideApprovalRequest;
use App\Enums\ApprovalStatus;
use App\Models\ApprovalRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class ApprovalRequestController extends Controller
{
    public function decide(Request $request, ApprovalRequest $approvalRequest, DecideApprovalRequest $action): RedirectResponse
    {
        $validated = $request->validate(['status' => ['required', Rule::enum(ApprovalStatus::class), 'not_in:pending'], 'reason' => ['nullable', 'string', 'max:2000']]);
        $status = ApprovalStatus::from($validated['status']);
        $action->handle($request->user(), $approvalRequest, $status, $validated['reason'] ?? null);

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Approval request was {$status->value}.",
        ]);
    }
}
