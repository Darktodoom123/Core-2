<?php

namespace App\Platform\Safety\Services;

use App\Platform\Notifications\Data\PushPayload;
use App\Platform\Notifications\Jobs\SendPushNotificationJob;
use App\Platform\Notifications\Models\Notification;
use App\Platform\Safety\Contracts\SosResponderDelivery;
use App\Platform\Safety\Enums\SosDeliveryAttemptStatus;
use App\Platform\Safety\Models\SosDeliveryAttempt;
use App\Platform\Safety\Models\SosIncidentRecipient;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use Illuminate\Support\Str;

final class DatabaseSosResponderDelivery implements SosResponderDelivery
{
    public function deliver(SosIncidentRecipient $recipient): void
    {
        $incident = $recipient->incident()->with(['reporter', 'dispatchJob', 'operationalAsset'])->firstOrFail();
        $recipient->loadMissing('user');

        $notification = Notification::query()->firstOrCreate(
            [
                'notifiable_type' => $recipient->user->getMorphClass(),
                'notifiable_id' => $recipient->user_id,
                'type' => 'sos.incident',
                'sos_incident_id' => $incident->id,
            ],
            [
                'id' => (string) Str::uuid(),
                'dispatch_job_id' => $incident->dispatch_job_id,
                'status' => 'unread',
                'data' => [
                    'event' => 'safety.sos_received',
                    'incident_id' => $incident->id,
                    'status' => $incident->status->value,
                    'category' => $incident->category->value,
                    'received_at' => $incident->received_at->toIso8601String(),
                    'dispatch_reference' => $incident->dispatchJob?->reference,
                    'reporter_name' => $incident->reporter->name,
                ],
            ],
        );

        $attempt = SosDeliveryAttempt::query()->firstOrCreate(
            [
                'sos_incident_id' => $incident->id,
                'channel' => 'database',
                'target_type' => 'user',
                'target_id' => (string) $recipient->user_id,
            ],
            [
                'attempt_status' => SosDeliveryAttemptStatus::Delivered,
                'attempted_at' => now(),
                'delivered_at' => now(),
                'retry_count' => 0,
            ],
        );

        if ($attempt->wasRecentlyCreated) {
            $recipient->forceFill(['notified_at' => now()])->save();
            WorkspaceUpdated::dispatch('sos', 'received');

            $pushPayload = new PushPayload(
                title: 'EMERGENCY SOS ALERT',
                body: 'Emergency SOS alert received for active operations.',
                data: [
                    'event' => 'safety.sos_received',
                    'incident_id' => $incident->id,
                    'recipient_id' => $recipient->user_id,
                    'dispatch_job_id' => $incident->dispatch_job_id,
                    'status' => $incident->status->value,
                ],
                channelId: 'sos-emergency',
                priority: 'high',
                sound: 'emergency',
                ttl: 1800,
            );

            SendPushNotificationJob::dispatch(
                recipient: $recipient->user,
                payload: $pushPayload,
                deduplicationKey: 'sos_push:'.$incident->id.':'.$recipient->user_id,
                relevanceType: 'sos_incident',
                relevanceId: $incident->id,
            );
        }

        unset($notification);
    }
}
