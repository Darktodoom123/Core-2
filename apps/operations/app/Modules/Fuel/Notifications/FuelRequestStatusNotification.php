<?php

namespace App\Modules\Fuel\Notifications;

use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Notifications\Data\PushPayload;
use Illuminate\Bus\Queueable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Notifications\Notification;

/**
 * Tells the requester their fuel request moved to a decision stage.
 * Deliberately carries no dispatch_job_id so mobile taps open Fuel, not Dispatch.
 */
final class FuelRequestStatusNotification extends Notification
{
    use Queueable;

    public function __construct(public readonly FuelRequest $fuel) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => 'fuel.status_changed',
            'fuel_request_id' => $this->fuel->id,
            'reference' => $this->fuel->reference,
            'status' => $this->fuel->status->value,
            'job_reference' => $this->fuel->job?->reference,
            'asset_code' => $this->fuel->asset?->code,
            'reason' => $this->fuel->decision_reason,
            'message' => $this->message(),
        ];
    }

    public function toPush(object $notifiable): PushPayload
    {
        return new PushPayload(
            title: $this->title(),
            body: $this->message(),
            data: [
                'event' => 'fuel.status_changed',
                'recipient_id' => $notifiable instanceof Model ? $notifiable->getKey() : null,
                'fuel_request_id' => $this->fuel->id,
                'reference' => $this->fuel->reference,
                'status' => $this->fuel->status->value,
            ],
            channelId: 'dispatch-updates',
            priority: $this->fuel->status === FuelRequestStatus::Rejected ? 'high' : 'default',
            ttl: 86400,
        );
    }

    private function title(): string
    {
        return match ($this->fuel->status) {
            FuelRequestStatus::Approved => 'Fuel request approved',
            FuelRequestStatus::Verified => 'Ready to refuel',
            FuelRequestStatus::Rejected => 'Fuel request declined',
            default => 'Fuel request updated',
        };
    }

    private function message(): string
    {
        $reference = $this->fuel->reference;

        return match ($this->fuel->status) {
            FuelRequestStatus::Approved => "{$reference} was approved. The office will confirm the allocation next.",
            FuelRequestStatus::Verified => "{$reference} is ready. Refuel, then capture the receipt in Fuel.",
            FuelRequestStatus::Rejected => $this->fuel->decision_reason !== null && $this->fuel->decision_reason !== ''
                ? "{$reference} was declined: {$this->fuel->decision_reason}"
                : "{$reference} was declined.",
            default => "{$reference} is now {$this->fuel->status->label()}.",
        };
    }
}
