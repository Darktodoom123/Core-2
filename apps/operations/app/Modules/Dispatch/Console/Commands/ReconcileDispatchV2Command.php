<?php

namespace App\Modules\Dispatch\Console\Commands;

use App\Modules\Dispatch\Services\DispatchV2Reconciliation;
use Illuminate\Console\Command;

final class ReconcileDispatchV2Command extends Command
{
    protected $signature = 'dispatch:reconcile {--limit=100 : Maximum rows per source scope} {--run= : Resume an existing reconciliation run} {--dry-run : Inspect legacy data without creating canonical rows}';

    protected $description = 'Reconcile legacy dispatch rows into the additive Dispatch V2 foundation';

    public function handle(DispatchV2Reconciliation $reconciliation): int
    {
        $run = $reconciliation->run(
            limit: max(1, (int) $this->option('limit')),
            dryRun: (bool) $this->option('dry-run'),
            runId: $this->option('run') !== null ? (int) $this->option('run') : null,
        );

        $this->line(json_encode([
            'run_id' => $run->id,
            'status' => $run->getRawOriginal('status'),
            'dry_run' => $run->dry_run,
            'checkpoint' => $run->checkpoint,
            'scanned' => $run->scanned_count,
            'created' => $run->created_count,
            'findings' => $run->finding_count,
        ], JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
