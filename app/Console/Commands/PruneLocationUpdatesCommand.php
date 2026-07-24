<?php

namespace App\Console\Commands;

use App\Models\LocationUpdate;
use Illuminate\Console\Command;

class PruneLocationUpdatesCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'location:prune';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Prune precise location coordinates older than 30 days while preserving non-coordinate audit metadata.';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $cutoff = now()->subDays(30);

        $affected = LocationUpdate::query()
            ->where('captured_at', '<', $cutoff)
            ->where(function ($query) {
                $query->whereNotNull('latitude')->orWhereNotNull('longitude');
            })
            ->update([
                'latitude' => null,
                'longitude' => null,
            ]);

        $this->info("Pruned coordinates for {$affected} location updates older than 30 days.");

        return Command::SUCCESS;
    }
}
