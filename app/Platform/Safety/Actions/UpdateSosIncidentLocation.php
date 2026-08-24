<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class UpdateSosIncidentLocation
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(User $actor, SosIncident $incident, float $latitude, float $longitude, ?float $accuracy = null): SosIncident
    {
        return DB::transaction(function () use ($actor, $incident, $latitude, $longitude, $accuracy): SosIncident {
            $incident = SosIncident::query()->whereKey($incident->id)->lockForUpdate()->firstOrFail();
            if ($incident->location_captured_at !== null || $incident->location_pruned_at !== null) {
                throw ValidationException::withMessages(['location' => 'This SOS incident already has a location snapshot.']);
            }
            $before = $incident->auditSnapshot();
            $incident->forceFill([
                'latitude' => $latitude,
                'longitude' => $longitude,
                'accuracy_metres' => $accuracy,
                'location_captured_at' => now(),
                'version' => $incident->version + 1,
            ])->save();
            $this->audit->handle($actor, $incident, 'safety.sos_location_updated', $before, $incident->auditSnapshot());

            return $incident->fresh();
        });
    }
}
