<?php

namespace App\Actions;

use App\Enums\JobReportStatus;
use App\Jobs\SendQueuedNotificationJob;
use App\Models\AuditEvent;
use App\Models\JobReport;
use App\Models\User;
use App\Notifications\DispatchCompletionNotification;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ReviewJobReport
{
    public function execute(User $reviewer, JobReport $report, string $status, ?string $reason = null): JobReport
    {
        if ($reviewer->id === $report->author_id) {
            throw new AuthorizationException('Authors cannot review or approve their own job reports.');
        }

        return DB::transaction(function () use ($reviewer, $report, $status, $reason): JobReport {
            $report->refresh();
            if ($report->status !== JobReportStatus::Submitted) {
                throw ValidationException::withMessages(['status' => 'Only submitted job reports can be reviewed.']);
            }

            $newStatus = match ($status) {
                'approved' => JobReportStatus::Approved,
                'rejected' => JobReportStatus::Rejected,
                default => throw new \InvalidArgumentException("Invalid report review status: {$status}"),
            };

            $beforeState = [
                'status' => $report->status->value,
                'remarks' => $report->remarks,
            ];

            $remarks = $report->remarks;
            if ($reason) {
                $remarks = trim(($remarks ? $remarks."\n" : '').'Review Note: '.$reason);
            }

            $report->update([
                'status' => $newStatus,
                'remarks' => $remarks,
            ]);

            AuditEvent::query()->create([
                'actor_id' => $reviewer->id,
                'subject_type' => JobReport::class,
                'subject_id' => $report->id,
                'action' => 'job_report.reviewed',
                'before_state' => $beforeState,
                'after_state' => [
                    'status' => $newStatus->value,
                    'reason' => $reason,
                    'remarks' => $report->remarks,
                ],
                'request_id' => request()->header('X-Request-ID') ?? request()->ip(),
                'ip_address' => request()->ip(),
                'occurred_at' => now(),
            ]);

            // Notify author of review decision
            if ($report->author && $report->author->is_active) {
                SendQueuedNotificationJob::dispatch(
                    $report->author,
                    new DispatchCompletionNotification($report->job, $report)
                );
            }

            return $report;
        });
    }
}
