<?php

namespace App\Platform\Reporting\Enums;

enum ReportExportType: string
{
    case JobReports = 'job_reports';
    case Dispatches = 'dispatches';
    case FuelLogs = 'fuel_logs';
    case MaintenanceLogs = 'maintenance_logs';

    public function label(): string
    {
        return match ($this) {
            self::JobReports => 'Job Reports Export',
            self::Dispatches => 'Dispatch Lifecycle Export',
            self::FuelLogs => 'Fuel Logs Export',
            self::MaintenanceLogs => 'Fleet Maintenance Export',
        };
    }

    public function filenamePrefix(): string
    {
        return match ($this) {
            self::JobReports => 'job-reports-export',
            self::Dispatches => 'dispatches-export',
            self::FuelLogs => 'fuel-logs-export',
            self::MaintenanceLogs => 'maintenance-logs-export',
        };
    }
}
