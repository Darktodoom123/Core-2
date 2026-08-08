<?php

namespace App\Platform\Reporting\Enums;

enum ReportExportType: string
{
    case JobReports = 'job_reports';
    case Dispatches = 'dispatches';
    case FuelLogs = 'fuel_logs';
    case MaintenanceLogs = 'maintenance_logs';
    case LocationAudit = 'location_audit';
    case SystemAudit = 'system_audit';

    /** @return list<string> */
    public static function requestableValues(): array
    {
        return [
            self::JobReports->value,
            self::Dispatches->value,
            self::FuelLogs->value,
            self::MaintenanceLogs->value,
            self::LocationAudit->value,
            self::SystemAudit->value,
        ];
    }

    public function label(): string
    {
        return match ($this) {
            self::JobReports => 'Job Reports Export',
            self::Dispatches => 'Dispatch Lifecycle Export',
            self::FuelLogs => 'Fuel Logs Export',
            self::MaintenanceLogs => 'Fleet Maintenance Export',
            self::LocationAudit => 'Location Audit Export',
            self::SystemAudit => 'System Audit Export',
        };
    }

    public function filenamePrefix(): string
    {
        return match ($this) {
            self::JobReports => 'job-reports-export',
            self::Dispatches => 'dispatches-export',
            self::FuelLogs => 'fuel-logs-export',
            self::MaintenanceLogs => 'maintenance-logs-export',
            self::LocationAudit => 'location-audit-export',
            self::SystemAudit => 'system-audit-export',
        };
    }
}
