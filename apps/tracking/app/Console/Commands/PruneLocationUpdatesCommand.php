<?php

namespace Tracking\Console\Commands;

use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Tracking\Models\LatestLocation;
use Tracking\Models\LocationSample;

final class PruneLocationUpdatesCommand extends Command
{
    protected $signature = 'location:prune';

    protected $description = 'Prune precise location coordinates older than 30 days while preserving non-coordinate audit metadata.';

    public function handle(): int
    {
        $cutoff = CarbonImmutable::now()->subDays(30);

        $affected = LocationSample::query()
            ->where(function ($query) use ($cutoff): void {
                $query->where('captured_at', '<', $cutoff)
                    ->orWhere(function ($q) use ($cutoff): void {
                        $q->whereNull('captured_at')->where('created_at', '<', $cutoff);
                    });
            })
            ->where(function ($query): void {
                $query->whereNotNull('latitude')->orWhereNotNull('longitude');
            })
            ->update([
                'latitude' => null,
                'longitude' => null,
            ]);

        $latestAffected = LatestLocation::query()
            ->where(function ($query) use ($cutoff): void {
                $query->where('captured_at', '<', $cutoff)
                    ->orWhere(function ($q) use ($cutoff): void {
                        $q->whereNull('captured_at')->where('created_at', '<', $cutoff);
                    });
            })
            ->where(function ($query): void {
                $query->whereNotNull('latitude')->orWhereNotNull('longitude');
            })
            ->update([
                'latitude' => null,
                'longitude' => null,
            ]);

        $this->info("Pruned coordinates for {$affected} location samples older than 30 days ({$latestAffected} projections pruned).");

        return self::SUCCESS;
    }
}
