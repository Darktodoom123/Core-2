<?php

namespace App\Platform\Notifications;

use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Notifications\Data\PushPayload;
use Illuminate\Bus\Queueable;
use Illuminate\Database\Eloquent\Model;
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

    public function toPush(object $notifiable): PushPayload
    {
        $recipientId = $notifiable instanceof Model ? $notifiable->getKey() : null;

        return new PushPayload(
            title: 'New Dispatch Assignment',
            body: "You have been assigned to dispatch job {$this->job->reference}.",
            data: [
                'event' => 'dispatch.assigned',
                'recipient_id' => $recipientId,
                'job_id' => $this->job->id,
                'dispatch_job_id' => $this->job->id,
                'reference' => $this->job->reference,
                'assignment_type' => $this->assignmentType,
                'scheduled_start' => $this->job->scheduled_start?->toIso8601String(),
            ],
            channelId: 'dispatch-urgent',
            priority: 'high',
            ttl: 86400,
        );
    }
}
