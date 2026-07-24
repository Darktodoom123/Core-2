<?php

namespace App\Jobs;

use App\Models\Notification as NotificationModel;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Notifications\Notification;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

class SendQueuedNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [10, 30, 60];

    public function __construct(
        public readonly User $recipient,
        public readonly Notification $notification,
        public readonly ?string $customDeduplicationKey = null
    ) {}

    public function handle(): void
    {
        if (! $this->recipient->exists || ! $this->recipient->is_active) {
            return;
        }

        $type = get_class($this->notification);
        /** @var array<string, mixed> $data */
        $data = is_callable([$this->notification, 'toArray'])
            ? (array) call_user_func([$this->notification, 'toArray'], $this->recipient)
            : (is_callable([$this->notification, 'toDatabase'])
                ? (array) call_user_func([$this->notification, 'toDatabase'], $this->recipient)
                : []);
        $dispatchJobId = isset($data['dispatch_job_id']) && is_numeric($data['dispatch_job_id']) ? (int) $data['dispatch_job_id'] : null;

        $jsonPayload = json_encode($data) ?: '';
        $dataHash = md5($jsonPayload);

        $dedupKey = $this->customDeduplicationKey ?? sprintf(
            '%s:%s:%s:%s',
            $type,
            $this->recipient->id,
            $dispatchJobId ?? 'none',
            $dataHash
        );

        // Idempotency check: prevent duplicate notifications
        $existing = NotificationModel::query()
            ->where('notifiable_type', $this->recipient->getMorphClass())
            ->where('notifiable_id', $this->recipient->id)
            ->where('type', $type)
            ->get();

        foreach ($existing as $item) {
            $itemData = (array) $item->data;
            if (md5(json_encode($itemData) ?: '') === $dataHash) {
                // Duplicate notification already exists; skip creating duplicate
                return;
            }
        }

        NotificationModel::query()->create([
            'id' => (string) Str::uuid(),
            'type' => $type,
            'notifiable_type' => $this->recipient->getMorphClass(),
            'notifiable_id' => $this->recipient->id,
            'dispatch_job_id' => $dispatchJobId,
            'status' => 'unread',
            'data' => $data,
        ]);
    }
}
