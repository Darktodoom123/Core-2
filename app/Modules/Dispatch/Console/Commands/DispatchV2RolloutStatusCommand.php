<?php

namespace App\Modules\Dispatch\Console\Commands;

use App\Modules\Dispatch\Services\DispatchV2MetricsService;
use Illuminate\Console\Command;

final class DispatchV2RolloutStatusCommand extends Command
{
    protected $signature = 'dispatch:v2:status {--workspace=operations : The workspace key to inspect} {--json : Output status snapshot as JSON}';

    protected $description = 'Display Dispatch V2 rollout telemetry and operational metrics';

    public function handle(DispatchV2MetricsService $metricsService): int
    {
        $workspace = (string) $this->option('workspace');
        $metrics = $metricsService->snapshot($workspace);

        if ($this->option('json')) {
            $this->line((string) json_encode($metrics, JSON_THROW_ON_ERROR));

            return self::SUCCESS;
        }

        $this->info("=== Dispatch V2 Rollout Status [Workspace: {$workspace}] ===");
        $this->table(
            ['Parameter', 'Value'],
            [
                ['Cohort Active', $metrics['cohort_active'] ? 'YES' : 'NO'],
                ['V2 Commands Enabled', $metrics['v2_commands_enabled'] ? 'YES' : 'NO'],
                ['Telemetry Enabled', $metrics['telemetry_enabled'] ? 'YES' : 'NO'],
                ['Sunset Date (V1)', (string) $metrics['sunset_date']],
                ['Total Dispatch Jobs', (string) $metrics['jobs']['total']],
                ['Canonical Handoffs', (string) $metrics['jobs']['handoffs']],
                ['Execution Attempts', (string) $metrics['jobs']['attempts']],
                ['V2 Coverage', "{$metrics['jobs']['v2_coverage_percent']}%"],
                ['Outbox Pending / Failed', "{$metrics['outbox']['pending']} / {$metrics['outbox']['failed']}"],
                ['Unresolved Findings', (string) $metrics['reconciliation']['unresolved_findings']],
            ]
        );

        return self::SUCCESS;
    }
}
