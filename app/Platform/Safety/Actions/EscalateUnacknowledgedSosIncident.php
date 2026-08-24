<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Events\SosIncidentChanged;
use App\Platform\Safety\Jobs\DeliverSosEscalationJob;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Support\Facades\DB;

final class EscalateUnacknowledgedSosIncident
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(string $incidentId): SosIncident
    {
        $didEscalate = false;
        $escalated = DB::transaction(function () use ($incidentId, &$didEscalate): SosIncident {
            $incident = SosIncident::query()->whereKey($incidentId)->lockForUpdate()->firstOrFail();
            if ($incident->status !== SosIncidentStatus::Active || $incident->escalation_due_at->isFuture()) {
                return $incident;
            }

            $before = $incident->auditSnapshot();
            $incident->forceFill([
                'status' => SosIncidentStatus::Escalated,
                'escalated_at' => now(),
                'version' => $incident->version + 1,
            ])->save();
            $didEscalate = true;
            $this->audit->handle($incident->reporter()->firstOrFail(), $incident, 'safety.sos_escalated', $before, $incident->auditSnapshot(), 'Acknowledgement deadline elapsed.');

            return $incident->fresh();
        });

        if ($didEscalate) {
            DB::afterCommit(function () use ($escalated): void {
                DeliverSosEscalationJob::dispatch($escalated->id);
                SosIncidentChanged::dispatch($escalated, 'escalated');
            });
        }

        return $escalated;
    }
}
