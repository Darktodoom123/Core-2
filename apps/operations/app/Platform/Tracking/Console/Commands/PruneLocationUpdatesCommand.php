<?php

namespace App\Platform\Tracking\Console\Commands;

use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Platform\Tracking\Models\LocationUpdate;
use Illuminate\Console\Command;

final class PruneLocationUpdatesCommand extends Command
{
    protected $signature = 'location:prune';

    protected $description = 'Prune precise location coordinates older than 30 days while preserving non-coordinate audit metadata.';

    public function handle(): int
    {
        $cutoff = now()->subDays((int) config('hours_of_service.location_retention_days', 30));

        $affected = LocationUpdate::query()
            ->where('captured_at', '<', $cutoff)
            ->where(function ($query): void {
                $query->whereNotNull('latitude')->orWhereNotNull('longitude');
            })
            ->update([
                'latitude' => null,
                'longitude' => null,
            ]);

        $this->info("Pruned coordinates for {$affected} location updates older than 30 days.");

        $dutyAffected = OperatorDutyLog::query()
            // Retention follows the captured observation/event, not the
            // delayed server receipt time. This prevents offline replay from
            // extending precise-coordinate retention beyond the existing
            // tracking policy.
            ->whereRaw('COALESCE(location_observed_at, occurred_at, created_at) < ?', [$cutoff])
            ->where(function ($query): void {
                $query->whereNotNull('latitude')->orWhereNotNull('longitude');
            })
            ->update([
                'latitude' => null,
                'longitude' => null,
                'accuracy_metres' => null,
                'location_freshness' => 'unavailable',
                'location_source' => 'retention_pruned',
            ]);

        $this->info("Pruned coordinates for {$dutyAffected} duty event snapshots older than the retention period.");

        return self::SUCCESS;
    }
}
