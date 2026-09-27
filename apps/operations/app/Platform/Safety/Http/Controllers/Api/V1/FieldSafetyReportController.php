<?php

namespace App\Platform\Safety\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\SiteHazardTicket;
use App\Platform\Safety\Models\WorkStoppageNotice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A field operator's own safety reports and what became of them: hazards
 * they reported (open or rectified) and stoppages they issued (active or
 * lifted). Only the caller's records are returned; no other people's names.
 */
final class FieldSafetyReportController extends Controller
{
    private const DEFAULT_DAYS = 30;

    private const MAX_DAYS = 90;

    private const LIMIT = 50;

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $filters = $request->validate([
            'days' => ['sometimes', 'integer', 'min:1', 'max:'.self::MAX_DAYS],
        ]);
        $since = now()->subDays((int) ($filters['days'] ?? self::DEFAULT_DAYS));

        $hazards = SiteHazardTicket::query()
            ->where('reporter_id', $user->id)
            ->where('created_at', '>=', $since)
            ->latest()
            ->orderByDesc('id')
            ->limit(self::LIMIT)
            ->get()
            ->map(fn (SiteHazardTicket $ticket): array => [
                'id' => $ticket->id,
                'ticket_code' => $ticket->ticket_code,
                'project_site' => $ticket->project_site,
                'category' => $ticket->category,
                'severity' => $ticket->severity,
                'status' => $ticket->status,
                'work_stoppage_issued' => $ticket->work_stoppage_issued,
                'reported_at' => $ticket->created_at->toIso8601String(),
                'rectified_at' => $ticket->rectified_at?->toIso8601String(),
                'rectification_notes' => $ticket->rectification_notes,
            ]);

        $stoppages = WorkStoppageNotice::query()
            ->where('issued_by', $user->id)
            ->where('created_at', '>=', $since)
            ->latest()
            ->orderByDesc('id')
            ->limit(self::LIMIT)
            ->get()
            ->map(fn (WorkStoppageNotice $notice): array => [
                'id' => $notice->id,
                'notice_number' => $notice->notice_number,
                'project_site' => $notice->project_site,
                'reason' => $notice->reason,
                'affected_area' => $notice->affected_area,
                'is_active' => $notice->is_active,
                'issued_at' => $notice->created_at->toIso8601String(),
                'lifted_at' => $notice->lifted_at?->toIso8601String(),
                'lift_reason' => $notice->lift_reason,
            ]);

        return response()->json(['data' => [
            'hazards' => array_values($hazards->all()),
            'work_stoppages' => array_values($stoppages->all()),
        ]]);
    }
}
