<?php

namespace App\Platform\Reporting\Actions;

use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Models\JobReport;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use Illuminate\Support\Carbon;

class GenerateDailyOperationsSummary
{
    /** @return array<string, mixed> */
    public function execute(User $user, ?Carbon $date = null): array
    {
        $targetDate = $date ?? now();
        $startOfDay = $targetDate->copy()->startOfDay();
        $endOfDay = $targetDate->copy()->endOfDay();

        $jobQuery = DispatchJob::query()->visibleTo($user);
        $reportQuery = JobReport::query()->visibleTo($user);

        $totalDispatchesToday = (clone $jobQuery)
            ->whereBetween('created_at', [$startOfDay, $endOfDay])
            ->count();

        $activeDispatches = (clone $jobQuery)
            ->whereIn('status', [
                DispatchStatus::Dispatched,
                DispatchStatus::Accepted,
                DispatchStatus::EnRoute,
                DispatchStatus::Arrived,
                DispatchStatus::Working,
            ])
            ->count();

        $completedToday = (clone $jobQuery)
            ->where('status', DispatchStatus::Completed)
            ->whereBetween('updated_at', [$startOfDay, $endOfDay])
            ->count();

        $statusCounts = (clone $jobQuery)
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $reportsSubmittedToday = (clone $reportQuery)
            ->whereBetween('submitted_at', [$startOfDay, $endOfDay])
            ->count();

        // Fuel summary scoped if user can view fuel
        $fuelSummary = [];
        if ($user->can(PermissionName::FuelViewAll->value) || $user->can(PermissionName::FuelViewOwn->value)) {
            $fuelQuery = FuelRequest::query()->visibleTo($user);

            $fuelSummary = [
                'submitted_today' => (clone $fuelQuery)->whereBetween('created_at', [$startOfDay, $endOfDay])->count(),
                'approved_today' => (clone $fuelQuery)->where('status', FuelRequestStatus::Approved)->whereBetween('approved_at', [$startOfDay, $endOfDay])->count(),
                'total_litres_requested_today' => (float) (clone $fuelQuery)->whereBetween('created_at', [$startOfDay, $endOfDay])->sum('quantity_litres'),
            ];
        }

        // Maintenance summary if user can view fleet/equipment
        $maintenanceSummary = [];
        if ($user->can(PermissionName::FleetViewAll->value) || $user->can(PermissionName::EquipmentViewAll->value) || $user->can(PermissionName::ReportsViewMaintenance->value)) {
            $maintenanceSummary = [
                'open_orders' => MaintenanceWorkOrder::query()->whereNull('released_at')->count(),
                'blocking_orders' => MaintenanceWorkOrder::query()->whereNull('released_at')->where('dispatch_blocking', true)->count(),
            ];
        }

        return [
            'summary_date' => $targetDate->toDateString(),
            'dispatches' => [
                'created_today' => $totalDispatchesToday,
                'active_count' => $activeDispatches,
                'completed_today' => $completedToday,
                'status_breakdown' => $statusCounts,
            ],
            'reports' => [
                'submitted_today' => $reportsSubmittedToday,
            ],
            'fuel' => $fuelSummary,
            'maintenance' => $maintenanceSummary,
        ];
    }
}
