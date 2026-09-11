<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Enums\SosResolutionCode;
use App\Platform\Safety\Events\SosIncidentChanged;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ResolveSosIncident
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(User $actor, SosIncident $incident, SosResolutionCode $code, string $notes): SosIncident
    {
        $updated = DB::transaction(function () use ($actor, $incident, $code, $notes): SosIncident {
            $incident = SosIncident::query()->whereKey($incident->id)->lockForUpdate()->firstOrFail();
            if (! in_array($incident->status, [SosIncidentStatus::Acknowledged, SosIncidentStatus::Escalated], true)) {
                throw ValidationException::withMessages(['status' => 'An SOS incident must be acknowledged or escalated before resolution.']);
            }

            $before = $incident->auditSnapshot();
            $incident->forceFill([
                'status' => SosIncidentStatus::Resolved,
                'resolved_by' => $actor->id,
                'resolved_at' => now(),
                'resolution_code' => $code,
                'resolution_notes' => $notes,
                'version' => $incident->version + 1,
            ])->save();
            $this->audit->handle($actor, $incident, 'safety.sos_resolved', $before, $incident->auditSnapshot(), $notes);

            return $incident->fresh();
        });

        DB::afterCommit(fn () => SosIncidentChanged::dispatch($updated, 'resolved'));

        return $updated;
    }
}
