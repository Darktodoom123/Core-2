<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Support\Facades\DB;

final class PruneSosIncidentCoordinates
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    public function handle(): void
    {
        SosIncident::query()
            ->whereNull('location_pruned_at')
            ->whereNotNull('location_captured_at')
            ->where('location_captured_at', '<=', now()->subDays((int) config('sos.coordinate_retention_days', 30)))
            ->orderBy('id')
            ->limit((int) config('sos.sweep_batch_size', 1000))
            ->pluck('id')
            ->each(function (string $id): void {
                DB::transaction(function () use ($id): void {
                    $incident = SosIncident::query()->whereKey($id)->lockForUpdate()->first();
                    if ($incident === null || $incident->location_pruned_at !== null) {
                        return;
                    }
                    $incident->forceFill([
                        'latitude' => null,
                        'longitude' => null,
                        'accuracy_metres' => null,
                        'location_pruned_at' => now(),
                        'version' => $incident->version + 1,
                    ])->save();
                    $this->audit->handle(
                        $incident->reporter()->firstOrFail(),
                        $incident,
                        'safety.sos_coordinates_pruned',
                        ['has_location' => true, 'version' => $incident->version - 1],
                        $incident->auditSnapshot(),
                        'Coordinate retention window elapsed.',
                    );
                });
            });
    }
}
