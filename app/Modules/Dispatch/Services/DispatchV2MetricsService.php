<?php

namespace App\Modules\Dispatch\Services;

use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchOutboxMessage;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Modules\Dispatch\Models\DispatchReconciliationFinding;
use App\Modules\Dispatch\Models\DispatchReconciliationRun;

final class DispatchV2MetricsService
{
    /**
     * @return array<string, mixed>
     */
    public function snapshot(string $workspaceKey = 'operations'): array
    {
        $totalJobs = DispatchJob::query()->count();
        $totalHandoffs = DispatchHandoff::query()->where('workspace_key', $workspaceKey)->count();
        $totalAttempts = DispatchExecutionAttempt::query()->where('workspace_key', $workspaceKey)->count();
        $dispatchedAttempts = DispatchExecutionAttempt::query()
            ->where('workspace_key', $workspaceKey)
            ->whereIn('status', [
                DispatchAttemptStatus::Dispatched->value,
                DispatchAttemptStatus::EnRoute->value,
                DispatchAttemptStatus::Arrived->value,
                DispatchAttemptStatus::Working->value,
                DispatchAttemptStatus::Completed->value,
            ])
            ->count();

        $v2CoveragePercent = $totalJobs > 0 ? round(($totalHandoffs / $totalJobs) * 100, 2) : 100.0;

        $totalOffers = DispatchAssignmentOffer::query()->where('workspace_key', $workspaceKey)->count();
        $acceptedOffers = DispatchAssignmentOffer::query()
            ->where('workspace_key', $workspaceKey)
            ->where('status', 'accepted')
            ->count();

        $designatedLeads = DispatchExecutionAttempt::query()
            ->where('workspace_key', $workspaceKey)
            ->whereNotNull('designated_lead_offer_id')
            ->count();

        $planVersions = DispatchPlanVersion::query()->where('workspace_key', $workspaceKey)->count();

        // Outbox delivery stats
        $outboxPending = DispatchOutboxMessage::query()->where('workspace_key', $workspaceKey)->where('status', 'pending')->count();
        $outboxDelivered = DispatchOutboxMessage::query()->where('workspace_key', $workspaceKey)->where('status', 'delivered')->count();
        $outboxFailed = DispatchOutboxMessage::query()->where('workspace_key', $workspaceKey)->where('status', 'failed')->count();

        // Reconciliation stats
        $latestRun = DispatchReconciliationRun::query()->where('workspace_key', $workspaceKey)->latest('id')->first();
        $unresolvedFindings = DispatchReconciliationFinding::query()
            ->where('workspace_key', $workspaceKey)
            ->whereNull('resolved_at')
            ->count();

        $enabledCohorts = config('dispatch.rollout_cohorts', ['operations']);
        $isCohortActive = in_array($workspaceKey, $enabledCohorts, true);

        return [
            'workspace_key' => $workspaceKey,
            'cohort_active' => $isCohortActive,
            'v2_commands_enabled' => (bool) config('dispatch.v2_commands_enabled'),
            'telemetry_enabled' => (bool) config('dispatch.telemetry_enabled'),
            'sunset_date' => config('dispatch.sunset_date'),
            'jobs' => [
                'total' => $totalJobs,
                'handoffs' => $totalHandoffs,
                'attempts' => $totalAttempts,
                'active_attempts' => $dispatchedAttempts,
                'v2_coverage_percent' => $v2CoveragePercent,
            ],
            'planning' => [
                'plan_versions' => $planVersions,
                'offers_total' => $totalOffers,
                'offers_accepted' => $acceptedOffers,
                'designated_leads' => $designatedLeads,
            ],
            'outbox' => [
                'pending' => $outboxPending,
                'delivered' => $outboxDelivered,
                'failed' => $outboxFailed,
            ],
            'reconciliation' => [
                'latest_run_id' => $latestRun?->id,
                'latest_run_status' => $latestRun?->getRawOriginal('status'),
                'unresolved_findings' => $unresolvedFindings,
            ],
        ];
    }
}
