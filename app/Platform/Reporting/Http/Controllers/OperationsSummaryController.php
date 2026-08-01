<?php

namespace App\Platform\Reporting\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Reporting\Actions\GenerateDailyOperationsSummary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OperationsSummaryController extends Controller
{
    public function dailySummary(Request $request, GenerateDailyOperationsSummary $action): JsonResponse
    {
        $user = $request->user();

        if (
            ! $user->can(PermissionName::ReportsViewAll->value)
            && ! $user->can(PermissionName::ReportsViewDispatch->value)
            && ! $user->can(PermissionName::ReportsViewOwn->value)
        ) {
            abort(403, 'Unauthorized to view operational summary.');
        }

        $summary = $action->execute($user);

        // Audit daily summary view
        AuditEvent::query()->create([
            'actor_id' => $user->id,
            'subject_type' => $user->getMorphClass(),
            'subject_id' => $user->id,
            'action' => 'reports.daily_summary_viewed',
            'after_state' => [
                'summary_date' => $summary['summary_date'],
            ],
            'request_id' => $request->header('X-Request-ID') ?? $request->ip(),
            'ip_address' => $request->ip(),
            'occurred_at' => now(),
        ]);

        return response()->json(['data' => $summary]);
    }
}
