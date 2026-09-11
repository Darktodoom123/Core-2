<?php

namespace App\Platform\Tracking\Console\Commands;

use App\Platform\Tracking\Models\LocationUpdate;
use Illuminate\Console\Command;

final class PruneLocationUpdatesCommand extends Command
{
    protected $signature = 'location:prune';

    protected $description = 'Prune precise location coordinates older than 30 days while preserving non-coordinate audit metadata.';

    public function handle(): int
    {
        $cutoff = now()->subDays(30);

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

        return self::SUCCESS;
    }
}
