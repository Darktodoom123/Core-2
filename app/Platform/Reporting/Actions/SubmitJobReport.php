<?php

namespace App\Platform\Reporting\Actions;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Attachments\Actions\UploadAttachmentAction;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\DispatchCompletionNotification;
use App\Platform\Notifications\Jobs\SendQueuedNotificationJob;
use App\Platform\Reporting\Enums\JobReportStatus;
use App\Platform\Reporting\Models\JobReport;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

class SubmitJobReport
{
    public function __construct(
        private readonly UploadAttachmentAction $uploadAttachmentAction
    ) {}

    /**
     * @param  array{dispatch_job_id: int, started_at?: string|null, ended_at?: string|null, work_summary: string, remarks?: string|null, attachments?: array<int, mixed>}  $data
     */
    public function execute(User $author, array $data): JobReport
    {
        return DB::transaction(function () use ($author, $data): JobReport {
            $job = DispatchJob::query()->findOrFail($data['dispatch_job_id']);

            $report = JobReport::query()->create([
                'dispatch_job_id' => $job->id,
                'author_id' => $author->id,
                'started_at' => $data['started_at'] ?? null,
                'ended_at' => $data['ended_at'] ?? null,
                'work_summary' => $data['work_summary'],
                'remarks' => $data['remarks'] ?? null,
                'status' => JobReportStatus::Submitted,
                'submitted_at' => now(),
            ]);

            if (! empty($data['attachments'])) {
                foreach ($data['attachments'] as $file) {
                    if ($file instanceof UploadedFile) {
                        $this->uploadAttachmentAction->execute($author, $report, $file, 'report_attachment');
                    }
                }
            }

            AuditEvent::query()->create([
                'actor_id' => $author->id,
                'subject_type' => $report->getMorphClass(),
                'subject_id' => $report->id,
                'action' => 'job_report.submitted',
                'after_state' => [
                    'dispatch_job_id' => $job->id,
                    'status' => JobReportStatus::Submitted->value,
                    'submitted_at' => $report->submitted_at?->toIso8601String(),
                ],
                'request_id' => request()->header('X-Request-ID') ?? request()->ip(),
                'ip_address' => request()->ip(),
                'occurred_at' => now(),
            ]);

            // Notify dispatchers and managers
            $recipients = User::query()
                ->where('is_active', true)
                ->whereHas('roles', fn ($q) => $q->whereIn('name', ['Dispatcher', 'OperationsManager']))
                ->get();

            foreach ($recipients as $recipient) {
                SendQueuedNotificationJob::dispatch(
                    $recipient,
                    new DispatchCompletionNotification($job, $report)
                );
            }

            return $report;
        });
    }
}
