<?php

namespace App\Platform\Notifications;

use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DispatchScheduleChangeNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly DispatchJob $job,
        public readonly string $changeDescription
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
            'event' => 'dispatch.schedule_changed',
            'dispatch_job_id' => $this->job->id,
            'reference' => $this->job->reference,
            'title' => $this->job->title,
            'description' => $this->changeDescription,
            'scheduled_start' => $this->job->scheduled_start?->toIso8601String(),
            'scheduled_end' => $this->job->scheduled_end?->toIso8601String(),
            'message' => "Schedule update for dispatch {$this->job->reference}: {$this->changeDescription}",
        ];
    }
}
