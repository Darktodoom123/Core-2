<?php

namespace App\Notifications;

use App\Enums\JobReportStatus;
use App\Models\DispatchJob;
use App\Models\JobReport;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DispatchCompletionNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly DispatchJob $job,
        public readonly ?JobReport $report = null
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => 'dispatch.completed',
            'dispatch_job_id' => $this->job->id,
            'job_report_id' => $this->report?->id,
            'reference' => $this->job->reference,
            'title' => $this->job->title,
            'report_status' => $this->report?->status instanceof JobReportStatus ? $this->report->status->value : (string) $this->report?->status,
            'message' => "Dispatch job {$this->job->reference} has been completed/reported.",
        ];
    }
}
