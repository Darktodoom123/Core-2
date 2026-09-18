<?php

namespace App\Platform\Notifications;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Notifications\Data\PushPayload;
use Illuminate\Bus\Queueable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notification;

class DispatchReassignmentNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly DispatchJob $job,
        public readonly string $action, // 'assigned' | 'released'
        public readonly ?string $reason = null,
    ) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        $actionText = $this->action === 'released' ? 'released from' : 'reassigned to';

        return [
            'event' => 'dispatch.reassigned',
            'action' => $this->action,
            'dispatch_job_id' => $this->job->id,
            'reference' => $this->job->reference,
            'title' => $this->job->title,
            'reason' => $this->reason,
            'message' => "You have been {$actionText} dispatch job {$this->job->reference}.",
        ];
    }

    public function toPush(object $notifiable): PushPayload
    {
        $recipientId = $notifiable instanceof Model ? $notifiable->getKey() : null;

        $title = $this->action === 'released'
            ? 'Dispatch Assignment Updated'
            : 'New Dispatch Assignment';
        $body = $this->action === 'released'
            ? "You have been released from dispatch job {$this->job->reference}."
            : "You have been assigned to dispatch job {$this->job->reference}.";

        return new PushPayload(
            title: $title,
            body: $body,
            data: [
                'event' => 'dispatch.reassigned',
                'recipient_id' => $recipientId,
                'action' => $this->action,
                'job_id' => $this->job->id,
                'dispatch_job_id' => $this->job->id,
                'reference' => $this->job->reference,
            ],
            channelId: 'dispatch-urgent',
            priority: 'high',
            ttl: 86400,
        );
    }
}
