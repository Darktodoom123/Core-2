<?php

namespace App\Modules\Dispatch\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Http\Resources\V1\DispatchJobResource;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchJobDelay;
use App\Modules\Dispatch\Queries\FieldJobHistoryQuery;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Models\JobReport;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Read-only record of one finished job for the operator who worked it:
 * the status steps the server recorded, delays, and their own report.
 */
final class FieldDispatchJobHistoryController extends Controller
{
    /** Status steps shown to the operator, in lifecycle order. */
    private const STEPS = ['accepted', 'en_route', 'arrived', 'working', 'completed', 'cancelled'];

    private const STATUS_ACTIONS = ['dispatch.status_updated', 'dispatch.cancelled', 'dispatch.v2.execution.progressed'];

    public function show(Request $request, DispatchJob $dispatchJob, FieldJobHistoryQuery $history): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($history->includes($user, $dispatchJob), 404);

        $dispatchJob->load([
            'assetAssignments.asset',
            'personnelAssignments' => fn ($query) => $query->where('user_id', $user->id),
        ]);

        return response()->json(['data' => [
            'job' => new DispatchJobResource($dispatchJob),
            'timeline' => $this->timeline($user, $dispatchJob),
            'delays' => $this->delays($dispatchJob),
            'report' => $this->report($user, $dispatchJob),
        ]]);
    }

    /**
     * The first recorded time of each step. Steps the server never recorded
     * are left out rather than guessed.
     *
     * @return list<array{status: string, label: string, at: string}>
     */
    private function timeline(User $user, DispatchJob $job): array
    {
        /** @var Collection<string, CarbonInterface> $firstAt */
        $firstAt = collect();
        $record = function (string $status, ?CarbonInterface $at) use (&$firstAt): void {
            if ($at !== null && in_array($status, self::STEPS, true)
                && (! $firstAt->has($status) || $at->lt($firstAt->get($status)))) {
                $firstAt->put($status, $at);
            }
        };

        $acceptedAt = DispatchPersonnelAssignment::query()
            ->where('dispatch_job_id', $job->id)
            ->where('user_id', $user->id)
            ->where('response_status', AssignmentResponse::Accepted->value)
            ->min('responded_at');
        $record('accepted', $acceptedAt !== null ? now()->parse($acceptedAt) : null);

        $attemptIds = DispatchExecutionAttempt::query()
            ->where('legacy_dispatch_job_id', $job->id)
            ->pluck('id');

        AuditEvent::query()
            ->whereIn('action', self::STATUS_ACTIONS)
            ->where(function ($query) use ($job, $attemptIds): void {
                $query->where(fn ($q) => $q->where('subject_type', $job->getMorphClass())->where('subject_id', $job->id))
                    ->orWhere(fn ($q) => $q->where('subject_type', (new DispatchExecutionAttempt)->getMorphClass())->whereIn('subject_id', $attemptIds));
            })
            ->orderBy('occurred_at')
            ->get(['after', 'occurred_at'])
            ->each(fn (AuditEvent $event) => $record((string) ($event->after['status'] ?? ''), $event->occurred_at));

        $record('completed', $job->completed_at);
        $record('cancelled', $job->cancelled_at);

        return array_values($firstAt
            ->sortBy(fn (CarbonInterface $at): int => $at->getTimestamp())
            ->map(fn (CarbonInterface $at, string $status): array => [
                'status' => $status,
                'label' => DispatchStatus::from($status)->label(),
                'at' => $at->toIso8601String(),
            ])
            ->all());
    }

    /** @return list<array<string, mixed>> */
    private function delays(DispatchJob $job): array
    {
        return array_values(DispatchJobDelay::query()
            ->where('dispatch_job_id', $job->id)
            ->orderBy('reported_at')
            ->get()
            ->map(fn (DispatchJobDelay $delay): array => [
                'id' => $delay->id,
                'context_label' => $delay->context->label(),
                'reason_label' => $delay->reason_label ?? $delay->reason->label(),
                'estimated_minutes' => $delay->estimated_minutes,
                'notes' => $delay->notes,
                'reported_at' => $delay->reported_at->toIso8601String(),
            ])
            ->all());
    }

    /** @return array<string, mixed>|null */
    private function report(User $user, DispatchJob $job): ?array
    {
        $report = JobReport::query()
            ->where('dispatch_job_id', $job->id)
            ->where('author_id', $user->id)
            ->latest('id')
            ->first();

        return $report === null ? null : [
            'id' => $report->id,
            'status' => $report->status->value,
            'status_label' => $report->status->label(),
            'work_summary' => $report->work_summary,
            'remarks' => $report->remarks,
            'rejection_reason' => $report->rejection_reason,
            'submitted_at' => $report->submitted_at?->toIso8601String(),
        ];
    }
}
