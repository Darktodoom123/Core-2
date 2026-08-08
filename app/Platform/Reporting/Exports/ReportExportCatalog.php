<?php

namespace App\Platform\Reporting\Exports;

use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Enums\ReportExportType;
use DomainException;
use Illuminate\Auth\Access\AuthorizationException;

final class ReportExportCatalog
{
    /** @var array<string, ReportExportDataset> */
    private array $datasets;

    public function __construct(
        JobReportsExportDataset $jobReports,
        DispatchesExportDataset $dispatches,
        FuelLogsExportDataset $fuelLogs,
        MaintenanceLogsExportDataset $maintenanceLogs,
        LocationAuditExportDataset $locationAudit,
        SystemAuditExportDataset $systemAudit,
    ) {
        $this->datasets = [
            $jobReports->type()->value => $jobReports,
            $dispatches->type()->value => $dispatches,
            $fuelLogs->type()->value => $fuelLogs,
            $maintenanceLogs->type()->value => $maintenanceLogs,
            $locationAudit->type()->value => $locationAudit,
            $systemAudit->type()->value => $systemAudit,
        ];
    }

    public function dataset(ReportExportType $type): ReportExportDataset
    {
        return $this->datasets[$type->value] ?? throw new DomainException('Unsupported report export dataset.');
    }

    public function authorize(User $actor, ReportExportType $type): void
    {
        if (! $actor->is_active || $actor->suspended_at !== null || ! $this->dataset($type)->authorize($actor)) {
            throw new AuthorizationException('You are not authorized to export this dataset.');
        }
    }
}
