<?php

namespace App\Platform\Notifications;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Notifications\Data\PushPayload;
use Illuminate\Bus\Queueable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notification;

class DispatchCancellationNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly DispatchJob $job,
        public readonly string $reason,
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
            'event' => 'dispatch.cancelled',
            'dispatch_job_id' => $this->job->id,
            'reference' => $this->job->reference,
            'title' => $this->job->title,
            'reason' => $this->reason,
            'message' => "Dispatch job {$this->job->reference} has been cancelled: {$this->reason}",
        ];
    }

    public function toPush(object $notifiable): PushPayload
    {
        $recipientId = $notifiable instanceof Model ? $notifiable->getKey() : null;

        return new PushPayload(
            title: 'Dispatch Job Cancelled',
            body: "Dispatch job {$this->job->reference} has been cancelled.",
            data: [
                'event' => 'dispatch.cancelled',
                'recipient_id' => $recipientId,
                'job_id' => $this->job->id,
                'dispatch_job_id' => $this->job->id,
                'reference' => $this->job->reference,
                'reason' => $this->reason,
            ],
            channelId: 'dispatch-updates',
            priority: 'high',
            ttl: 43200,
        );
    }
}
