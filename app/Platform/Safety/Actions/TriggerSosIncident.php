<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Data\SosTriggerResult;
use App\Platform\Safety\Enums\SosIncidentCategory;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Events\SosIncidentChanged;
use App\Platform\Safety\Jobs\DeliverSosEscalationJob;
use App\Platform\Safety\Jobs\DeliverSosResponderNotificationsJob;
use App\Platform\Safety\Jobs\EscalateSosIncidentJob;
use App\Platform\Safety\Models\SosIncident;
use App\Platform\Safety\Models\SosIncidentRecipient;
use App\Platform\Safety\Services\SosIncidentContextResolver;
use App\Platform\Safety\Services\SosRecipientResolver;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final class TriggerSosIncident
{
    public function __construct(
        private readonly SosIncidentContextResolver $context,
        private readonly SosRecipientResolver $recipients,
        private readonly RecordAuditEvent $audit,
    ) {}

    /** @param array<string, mixed> $data */
    public function handle(User $worker, array $data, string $commandId): SosTriggerResult
    {
        if (! (bool) config('sos.enabled')) {
            throw ValidationException::withMessages(['sos' => 'Emergency SOS is not enabled.']);
        }

        $existing = SosIncident::query()->where('command_id', $commandId)->first();
        if ($existing !== null) {
            abort_unless($existing->reporter_id === $worker->id, 404);

            return new SosTriggerResult($existing, false);
        }

        $result = DB::transaction(function () use ($worker, $data, $commandId): SosTriggerResult {
            User::query()->whereKey($worker->id)->lockForUpdate()->firstOrFail();
            $existing = SosIncident::query()
                ->where('command_id', $commandId)
                ->lockForUpdate()
                ->first();
            if ($existing !== null) {
                abort_unless($existing->reporter_id === $worker->id, 404);

                return new SosTriggerResult($existing, false);
            }

            $active = SosIncident::query()
                ->where('reporter_id', $worker->id)
                ->unresolved()
                ->latest('received_at')
                ->lockForUpdate()
                ->first();
            if ($active !== null) {
                return new SosTriggerResult($active, false, true);
            }

            $context = $this->context->resolve($worker, $data['dispatch_job_id'] ?? null, $data['operational_asset_id'] ?? null);
            $deviceActivatedAt = isset($data['device_activated_at'])
                ? CarbonImmutable::parse((string) $data['device_activated_at'])
                : now();
            if ($deviceActivatedAt->lt(now()->subSeconds((int) config('sos.mobile_freshness_seconds', 900)))) {
                throw ValidationException::withMessages(['device_activated_at' => 'This SOS activation is outside the emergency retry window.']);
            }

            $receivedAt = now();
            $incident = SosIncident::query()->create([
                'id' => (string) Str::uuid(),
                'command_id' => $commandId,
                'reporter_id' => $worker->id,
                'dispatch_job_id' => $context['job']?->id,
                'operational_asset_id' => $context['asset']?->id,
                'category' => $data['category'] ?? SosIncidentCategory::Unclassified,
                'status' => SosIncidentStatus::Active,
                'worker_note' => $data['worker_note'] ?? null,
                'device_activated_at' => $deviceActivatedAt,
                'received_at' => $receivedAt,
                'escalation_due_at' => $receivedAt->addSeconds((int) config('sos.acknowledgement_deadline_seconds', 180)),
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'accuracy_metres' => $data['accuracy_metres'] ?? null,
                'location_captured_at' => ($data['latitude'] ?? null) !== null && ($data['longitude'] ?? null) !== null ? $receivedAt : null,
                'version' => 1,
            ]);

            $this->audit->handle($worker, $incident, 'safety.sos_triggered', null, $incident->auditSnapshot());

            $resolvedRecipients = $this->recipients->resolve($worker, $context['job']);
            foreach ($resolvedRecipients as $resolvedRecipient) {
                SosIncidentRecipient::query()->create([
                    'sos_incident_id' => $incident->id,
                    'user_id' => $resolvedRecipient['user']->id,
                    'role_at_alert' => $resolvedRecipient['role_at_alert'],
                    'resolution_reason' => $resolvedRecipient['resolution_reason'],
                ]);
            }

            if ($resolvedRecipients->isEmpty()) {
                $before = $incident->auditSnapshot();
                $incident->forceFill([
                    'status' => SosIncidentStatus::Escalated,
                    'escalated_at' => $receivedAt,
                    'version' => $incident->version + 1,
                ])->save();
                $this->audit->handle($worker, $incident, 'safety.sos_escalated', $before, $incident->auditSnapshot(), 'No active Core 2 responders were resolvable.');
                Log::critical('SOS incident has no resolved Core 2 responders.', ['incident_id' => $incident->id]);
            }

            return new SosTriggerResult($incident->fresh(), true);
        });

        if (! $result->created) {
            return $result;
        }

        DB::afterCommit(function () use ($result): void {
            SosIncidentChanged::dispatch($result->incident, 'triggered');
            if ($result->incident->status === SosIncidentStatus::Escalated) {
                DeliverSosEscalationJob::dispatch($result->incident->id);

                return;
            }

            DeliverSosResponderNotificationsJob::dispatch($result->incident->id);
            if (config('queue.default') !== 'sync') {
                EscalateSosIncidentJob::dispatch($result->incident->id)->delay($result->incident->escalation_due_at);
            }
        });

        return $result;
    }
}
