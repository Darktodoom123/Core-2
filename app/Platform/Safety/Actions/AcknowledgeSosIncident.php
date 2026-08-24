<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Events\SosIncidentChanged;
use App\Platform\Safety\Jobs\DeliverSosEscalationJob;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AcknowledgeSosIncident
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(User $actor, SosIncident $incident): SosIncident
    {
        $escalate = false;
        $updated = DB::transaction(function () use ($actor, $incident, &$escalate): SosIncident {
            $incident = SosIncident::query()->whereKey($incident->id)->lockForUpdate()->firstOrFail();
            if ($incident->status === SosIncidentStatus::Acknowledged) {
                return $incident;
            }
            if (! in_array($incident->status, [SosIncidentStatus::Active, SosIncidentStatus::Escalated], true)) {
                throw ValidationException::withMessages(['status' => 'Only active or escalated SOS incidents can be acknowledged.']);
            }

            $before = $incident->auditSnapshot();
            if ($incident->status === SosIncidentStatus::Active && now()->greaterThanOrEqualTo($incident->escalation_due_at)) {
                $incident->forceFill(['status' => SosIncidentStatus::Escalated, 'escalated_at' => now(), 'version' => $incident->version + 1])->save();
                $this->audit->handle($actor, $incident, 'safety.sos_escalated', $before, $incident->auditSnapshot(), 'Acknowledgement arrived at or after the server deadline.');
                $escalate = true;
                $before = $incident->auditSnapshot();
            }

            $incident->forceFill([
                'status' => SosIncidentStatus::Acknowledged,
                'acknowledged_by' => $actor->id,
                'acknowledged_at' => now(),
                'version' => $incident->version + 1,
            ])->save();
            $this->audit->handle($actor, $incident, 'safety.sos_acknowledged', $before, $incident->auditSnapshot());

            return $incident->fresh();
        });

        DB::afterCommit(function () use ($updated, $escalate): void {
            if ($escalate) {
                DeliverSosEscalationJob::dispatch($updated->id);
            }
            SosIncidentChanged::dispatch($updated, 'acknowledged');
        });

        return $updated;
    }
}
