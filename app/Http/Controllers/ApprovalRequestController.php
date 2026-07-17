<?php

namespace App\Http\Controllers;

use App\Actions\DecideApprovalRequest;
use App\Enums\ApprovalStatus;
use App\Models\ApprovalRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class ApprovalRequestController extends Controller
{
    public function decide(Request $request, ApprovalRequest $approvalRequest, DecideApprovalRequest $action): JsonResponse
    {
        $validated = $request->validate(['status' => ['required', Rule::enum(ApprovalStatus::class), 'not_in:pending'], 'reason' => ['nullable', 'string', 'max:2000']]);

        return response()->json(['data' => $action->handle($request->user(), $approvalRequest, ApprovalStatus::from($validated['status']), $validated['reason'] ?? null)]);
    }
}
