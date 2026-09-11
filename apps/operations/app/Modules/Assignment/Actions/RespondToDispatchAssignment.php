<?php

namespace App\Modules\Assignment\Actions;

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class RespondToDispatchAssignment
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(
        User $actor,
        DispatchJob $job,
        DispatchPersonnelAssignment $assignment,
        AssignmentResponse $response,
        ?string $reason,
        int $version,
    ): DispatchPersonnelAssignment {
        return DB::transaction(function () use ($actor, $job, $assignment, $response, $reason, $version): DispatchPersonnelAssignment {
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($job->id);

            if ($job->version !== $version) {
                throw ValidationException::withMessages([
                    'version' => 'This dispatch changed on another device. Refresh and review it again.',
                ]);
            }

            /** @var DispatchPersonnelAssignment $assignment */
            $assignment = $job->personnelAssignments()
                ->where('id', $assignment->id)
                ->lockForUpdate()
                ->firstOrFail();

            Gate::forUser($actor)->authorize('respond', $assignment);

            if ($assignment->user_id !== $actor->id) {
                throw ValidationException::withMessages([
                    'response' => 'Only the assigned active worker can respond to this assignment.',
                ]);
            }

            if ($assignment->active_until !== null || $assignment->response_status !== AssignmentResponse::Pending) {
                throw ValidationException::withMessages([
                    'response' => 'This assignment has already been responded to or closed.',
                ]);
            }

            $trimmedReason = $reason !== null ? trim($reason) : null;

            if ($response === AssignmentResponse::Rejected && ($trimmedReason === null || $trimmedReason === '')) {
                throw ValidationException::withMessages([
                    'reason' => 'A reason is required when rejecting an assignment.',
                ]);
            }

            $before = $assignment->only(['response_status', 'responded_at', 'response_reason', 'active_until']);
            $now = now();

            if ($response === AssignmentResponse::Accepted) {
                $assignment->update([
                    'response_status' => AssignmentResponse::Accepted,
                    'responded_at' => $now,
                    'response_reason' => null,
                ]);
            } else {
                $assignment->update([
                    'response_status' => AssignmentResponse::Rejected,
                    'responded_at' => $now,
                    'response_reason' => $trimmedReason,
                    'active_until' => $now,
                ]);
            }

            $job->update(['version' => $job->version + 1]);

            $actionName = $response === AssignmentResponse::Accepted
                ? 'dispatch.assignment_accepted'
                : 'dispatch.assignment_rejected';

            $this->audit->handle(
                $actor,
                $assignment,
                $actionName,
                $before,
                $assignment->only(['response_status', 'responded_at', 'response_reason', 'active_until']),
                $trimmedReason,
            );

            return $assignment->refresh();
        });
    }
}
