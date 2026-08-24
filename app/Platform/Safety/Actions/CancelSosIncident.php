<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Events\SosIncidentChanged;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class CancelSosIncident
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(User $actor, SosIncident $incident, string $reason): SosIncident
    {
        $updated = DB::transaction(function () use ($actor, $incident, $reason): SosIncident {
            $incident = SosIncident::query()->whereKey($incident->id)->lockForUpdate()->firstOrFail();
            if ($incident->status->isTerminal()) {
                throw ValidationException::withMessages(['status' => 'A terminal SOS incident cannot be cancelled again.']);
            }

            $before = $incident->auditSnapshot();
            $incident->forceFill([
                'status' => SosIncidentStatus::Cancelled,
                'cancelled_by' => $actor->id,
                'cancelled_at' => now(),
                'cancellation_reason' => $reason,
                'version' => $incident->version + 1,
            ])->save();
            $this->audit->handle($actor, $incident, 'safety.sos_cancelled', $before, $incident->auditSnapshot(), $reason);

            return $incident->fresh();
        });

        DB::afterCommit(fn () => SosIncidentChanged::dispatch($updated, 'cancelled'));

        return $updated;
    }
}
