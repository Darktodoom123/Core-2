<?php

namespace App\Notifications;

use App\Models\DispatchJob;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DispatchAssignmentNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly DispatchJob $job,
        public readonly string $assignmentType
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
            'event' => 'dispatch.assigned',
            'dispatch_job_id' => $this->job->id,
            'reference' => $this->job->reference,
            'title' => $this->job->title,
            'assignment_type' => $this->assignmentType,
            'scheduled_start' => $this->job->scheduled_start?->toIso8601String(),
            'message' => "You have been assigned to dispatch job {$this->job->reference}: {$this->job->title}.",
        ];
    }
}
