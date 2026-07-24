<?php

namespace App\Notifications;

use App\Models\DispatchJob;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DispatchDelayNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly DispatchJob $job,
        public readonly string $reason
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
            'event' => 'dispatch.delayed',
            'dispatch_job_id' => $this->job->id,
            'reference' => $this->job->reference,
            'title' => $this->job->title,
            'reason' => $this->reason,
            'message' => "Delay reported for dispatch {$this->job->reference}: {$this->reason}",
        ];
    }
}
