<?php

namespace App\Platform\Notifications\Jobs;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\Data\PushPayload;
use App\Platform\Notifications\Models\PushDelivery;
use App\Platform\Notifications\Services\PushNotificationService;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendPushNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [5, 15, 30];

    public function __construct(
        public readonly User $recipient,
        public readonly PushPayload $payload,
        public readonly ?string $deduplicationKey = null,
        public readonly ?string $relevanceType = null,
        public readonly string|int|null $relevanceId = null,
    ) {
        $this->queue = (string) config('push.queue', 'default');
        $this->onQueue($this->queue);
    }

    public function handle(PushNotificationService $pushService): void
    {
        if (! $this->recipient->exists || ! $this->recipient->is_active) {
            return;
        }

        // Deduplication check: prevent re-sending push if every active device of the recipient has already received it
        if ($this->deduplicationKey !== null) {
            $activeTokenIds = $this->recipient->deviceTokens()
                ->where('is_active', true)
                ->whereNull('revoked_at')
                ->pluck('id');

            if ($activeTokenIds->isNotEmpty()) {
                $processedTokenIds = PushDelivery::query()
                    ->where('deduplication_key', $this->deduplicationKey)
                    ->whereIn('user_device_token_id', $activeTokenIds)
                    ->whereIn('status', [
                        PushDelivery::STATUS_ACCEPTED,
                        PushDelivery::STATUS_DELIVERED,
                        PushDelivery::STATUS_OPENED,
                    ])
                    ->pluck('user_device_token_id');

                if ($processedTokenIds->count() >= $activeTokenIds->count() && $activeTokenIds->diff($processedTokenIds)->isEmpty()) {
                    Log::info('Push notification job skipped due to deduplicationKey match across all active devices', [
                        'recipient_id' => $this->recipient->id,
                        'deduplication_key' => $this->deduplicationKey,
                    ]);

                    return;
                }
            }
        }

        // Relevance check for delayed queue execution
        if (! $this->isStillRelevant()) {
            return;
        }

        try {
            $result = $pushService->sendToUser(
                user: $this->recipient,
                payload: $this->payload,
                deduplicationKey: $this->deduplicationKey,
                relevanceType: $this->relevanceType,
                relevanceId: $this->relevanceId,
            );

            Log::info('Push notification job processed', [
                'recipient_id' => $this->recipient->id,
                'event' => $this->payload->data['event'] ?? 'unknown',
                'attempted' => $result['attempted'],
                'accepted' => $result['accepted'],
                'failed' => $result['failed'],
            ]);
        } catch (\Throwable $e) {
            Log::warning('Push notification delivery attempt failed, retrying if allowed', [
                'recipient_id' => $this->recipient->id,
                'event' => $this->payload->data['event'] ?? 'unknown',
                'error' => $e->getMessage(),
                'attempt' => $this->attempts(),
            ]);

            throw $e;
        }
    }

    private function isStillRelevant(): bool
    {
        $event = $this->payload->data['event'] ?? '';

        if ($this->relevanceType === 'dispatch_job' && $this->relevanceId !== null) {
            $job = DispatchJob::query()->find($this->relevanceId);
            if (! $job instanceof DispatchJob) {
                Log::info('Skipping push; dispatch job no longer exists', ['job_id' => $this->relevanceId]);

                return false;
            }

            // Case 1: Assignment offers / new assignments
            if ($event === 'dispatch.assigned') {
                if ($job->status === DispatchStatus::Cancelled || $job->status === DispatchStatus::Completed) {
                    Log::info('Skipping assignment push; job is cancelled/completed', [
                        'job_id' => $this->relevanceId,
                        'status' => $job->status->value,
                    ]);

                    return false;
                }

                $hasActiveAssignment = $job->personnelAssignments()
                    ->where('user_id', $this->recipient->id)
                    ->whereNull('active_until')
                    ->exists();

                if (! $hasActiveAssignment) {
                    Log::info('Skipping assignment push; user is no longer assigned to job', [
                        'recipient_id' => $this->recipient->id,
                        'job_id' => $this->relevanceId,
                    ]);

                    return false;
                }
            }

            // Case 2: Cancellations - cancelled-job check must NOT suppress cancellation notifications
            if ($event === 'dispatch.cancelled') {
                $wasAssigned = $job->personnelAssignments()
                    ->where('user_id', $this->recipient->id)
                    ->exists();

                if (! $wasAssigned) {
                    Log::info('Skipping cancellation push; user was never assigned to job', [
                        'recipient_id' => $this->recipient->id,
                        'job_id' => $this->relevanceId,
                    ]);

                    return false;
                }

                return true;
            }

            // Case 3: Reassignment notifications
            if ($event === 'dispatch.reassigned') {
                $action = $this->payload->data['action'] ?? null;

                if ($action === 'released') {
                    // Removal notice: must NOT be suppressed by active assignment check
                    $wasAssigned = $job->personnelAssignments()
                        ->where('user_id', $this->recipient->id)
                        ->exists();

                    if (! $wasAssigned) {
                        Log::info('Skipping reassignment release push; user was never assigned to job', [
                            'recipient_id' => $this->recipient->id,
                            'job_id' => $this->relevanceId,
                        ]);

                        return false;
                    }

                    return true;
                }

                // New assignment via reassignment
                if ($job->status === DispatchStatus::Cancelled || $job->status === DispatchStatus::Completed) {
                    Log::info('Skipping reassignment addition push; job is cancelled/completed', [
                        'job_id' => $this->relevanceId,
                        'status' => $job->status->value,
                    ]);

                    return false;
                }

                $hasActiveAssignment = $job->personnelAssignments()
                    ->where('user_id', $this->recipient->id)
                    ->whereNull('active_until')
                    ->exists();

                if (! $hasActiveAssignment) {
                    Log::info('Skipping reassignment addition push; user is no longer assigned to job', [
                        'recipient_id' => $this->recipient->id,
                        'job_id' => $this->relevanceId,
                    ]);

                    return false;
                }
            }

            // Case 4: Schedule changes
            if ($event === 'dispatch.schedule_changed') {
                if ($job->status === DispatchStatus::Cancelled || $job->status === DispatchStatus::Completed) {
                    Log::info('Skipping schedule change push; job is cancelled/completed', [
                        'job_id' => $this->relevanceId,
                        'status' => $job->status->value,
                    ]);

                    return false;
                }

                $hasActiveAssignment = $job->personnelAssignments()
                    ->where('user_id', $this->recipient->id)
                    ->whereNull('active_until')
                    ->exists();

                if (! $hasActiveAssignment) {
                    Log::info('Skipping schedule change push; user is no longer assigned to job', [
                        'recipient_id' => $this->recipient->id,
                        'job_id' => $this->relevanceId,
                    ]);

                    return false;
                }

                // Check for obsolete schedule update superseded by newer schedule
                $payloadStart = $this->payload->data['scheduled_start'] ?? null;
                $currentStart = $job->scheduled_start?->toIso8601String();
                if ($payloadStart !== null && $currentStart !== null && $payloadStart !== $currentStart) {
                    Log::info('Skipping obsolete schedule update push; job schedule has changed again', [
                        'job_id' => $this->relevanceId,
                        'payload_start' => $payloadStart,
                        'current_start' => $currentStart,
                    ]);

                    return false;
                }
            }
        }

        if ($this->relevanceType === 'sos_incident') {
            $incidentId = $this->relevanceId !== null ? (string) $this->relevanceId : ($this->payload->data['incident_id'] ?? null);
            if (empty($incidentId)) {
                return true;
            }
            $incident = SosIncident::query()->find($incidentId);
            if (! $incident instanceof SosIncident) {
                return false;
            }

            if ($incident->status === SosIncidentStatus::Resolved || $incident->status === SosIncidentStatus::Cancelled) {
                Log::info('Skipping SOS push; incident already resolved/cancelled', ['incident_id' => $incidentId]);

                return false;
            }
        }

        return true;
    }
}
