<?php

namespace App\Platform\Notifications;

use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DispatchDelayNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly DispatchJob $job,
        public readonly string $reason,
        public readonly ?string $context = null,
        public readonly ?int $estimatedMinutes = null,
        public readonly ?string $notes = null,
        public readonly ?string $assetCode = null,
        public readonly ?string $reporterName = null,
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
            'context' => $this->context,
            'estimated_minutes' => $this->estimatedMinutes,
            'notes' => $this->notes,
            'asset_code' => $this->assetCode,
            'reporter_name' => $this->reporterName,
            'message' => "Delay reported for dispatch {$this->job->reference}: {$this->reason}",
        ];
    }
}
