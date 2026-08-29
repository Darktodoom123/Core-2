<?php

namespace App\Platform\Reporting\Enums;

enum ReportExportType: string
{
    case JobReports = 'job_reports';
    case Dispatches = 'dispatches';
    case FuelLogs = 'fuel_logs';
    case WeeklyFuelConsumption = 'weekly_fuel_consumption';
    case MaintenanceLogs = 'maintenance_logs';
    case LocationAudit = 'location_audit';
    case SystemAudit = 'system_audit';
    case DoleWair = 'dole_wair';
    case CshpSafeManHours = 'cshp_safe_man_hours';
    case DailyAccomplishment = 'daily_accomplishment';

    /** @return list<string> */
    public static function requestableValues(): array
    {
        return [
            self::JobReports->value,
            self::Dispatches->value,
            self::FuelLogs->value,
            self::WeeklyFuelConsumption->value,
            self::MaintenanceLogs->value,
            self::LocationAudit->value,
            self::SystemAudit->value,
            self::DoleWair->value,
            self::CshpSafeManHours->value,
            self::DailyAccomplishment->value,
        ];
    }

    public function label(): string
    {
        return match ($this) {
            self::JobReports => 'Job Reports Export',
            self::Dispatches => 'Dispatch Lifecycle Export',
            self::FuelLogs => 'Fuel Logs Export',
            self::WeeklyFuelConsumption => 'Weekly Fuel Consumption Summary',
            self::MaintenanceLogs => 'Fleet Maintenance Export',
            self::LocationAudit => 'Location Audit Export',
            self::SystemAudit => 'System Audit Export',
            self::DoleWair => 'DOLE WAIR (Work Accident & Incident Report)',
            self::CshpSafeManHours => 'DOLE D.O. 13 CSHP Safe Man-Hours Report',
            self::DailyAccomplishment => 'Daily Accomplishment Report (DAR)',
        };
    }

    public function filenamePrefix(): string
    {
        return match ($this) {
            self::JobReports => 'job-reports-export',
            self::Dispatches => 'dispatches-export',
            self::FuelLogs => 'fuel-logs-export',
            self::WeeklyFuelConsumption => 'weekly-fuel-consumption-export',
            self::MaintenanceLogs => 'maintenance-logs-export',
            self::LocationAudit => 'location-audit-export',
            self::SystemAudit => 'system-audit-export',
            self::DoleWair => 'dole-wair-report-export',
            self::CshpSafeManHours => 'cshp-safe-man-hours-export',
            self::DailyAccomplishment => 'daily-accomplishment-report-export',
        };
    }
}
