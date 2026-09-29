<?php

namespace App\Platform\Reporting\AssetWeekly;

/**
 * Writes the asset weekly report as one CSV with titled sections, so it opens
 * cleanly in Excel or Sheets. Money columns are plain numbers labelled PHP.
 */
final class AssetWeeklyReportCsvWriter
{
    /** @param array<string, mixed> $report */
    public function write(array $report): string
    {
        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            throw new \RuntimeException('Unable to open temporary stream for asset weekly CSV export.');
        }

        fwrite($handle, "\xEF\xBB\xBF");

        $asset = $report['asset'];
        $week = $report['week'];
        $summary = $report['summary'];

        $this->section($handle, 'Asset Weekly Report', ['Field', 'Value'], [
            ['Asset', $asset['code'].' — '.$asset['name']],
            ['Registration', $asset['registration_number']],
            ['Week', $week['start'].' to '.$week['end'].' ('.$week['timezone'].')'],
            ['Generated At', $report['generated_at']],
        ]);

        $this->section($handle, 'Summary', ['Metric', 'Value'], [
            ['Jobs', $summary['jobs']],
            ['Personnel', $summary['personnel']],
            ['Shifts on Asset', $summary['shifts']],
            ['On-Duty Hours on Asset', $this->hours($summary['on_duty_minutes'])],
            ['Recorded Operating Hours', $this->hours($summary['operating_minutes'])],
            ['Job Reports', $summary['job_reports']],
            ['Reported Work Hours', $this->hours($summary['reported_work_minutes'])],
            ['Fuel Logs', $summary['fuel_logs']],
            ['Fuel Dispensed (L)', $summary['fuel_litres']],
            ['Fuel Cost (PHP)', $summary['fuel_cost']],
            ['Average Burn Rate', $summary['average_burn_rate']],
            ['Baseline Burn Rate', $asset['baseline_burn_rate']],
            ['Fuel Anomalies', $summary['fuel_anomalies']],
            ['Inspections', $summary['inspections']],
            ['Inspections With Defects', $summary['inspections_with_defects']],
            ['Work Orders', $summary['work_orders']],
        ]);

        $this->section($handle, 'Daily Schedule', ['Date', 'Jobs', 'Operators on Shift', 'On-Duty Hours'], array_map(fn (array $day) => [
            $day['date'],
            implode('; ', $day['jobs']),
            implode('; ', $day['operators']),
            $this->hours($day['on_duty_minutes']),
        ], $report['days']));

        $this->section($handle, 'Personnel', [
            'Name', 'Roles', 'Jobs', 'Response', 'Assigned From', 'Assigned Until',
            'Shifts on Asset', 'Hours on Asset', 'Shifts This Week (All Assets)', 'On-Duty Hours This Week',
            'Operating Hours', 'Driving Hours', 'Standby Hours', 'Break Hours',
        ], array_map(fn (array $person) => [
            $person['name'],
            implode('; ', $person['roles']),
            implode('; ', $person['jobs']),
            $person['response'],
            $person['assigned_from'],
            $person['assigned_until'],
            $person['shifts_on_asset'],
            $this->hours($person['minutes_on_asset']),
            $person['week_shifts'],
            $this->hours($person['week_on_duty_minutes']),
            $this->hours($person['week_operating_minutes']),
            $this->hours($person['week_driving_minutes']),
            $this->hours($person['week_standby_minutes']),
            $this->hours($person['week_break_minutes']),
        ], $report['personnel']));

        $this->section($handle, 'Shifts on Asset', ['Operator', 'Job', 'Status', 'Started At', 'Ended At', 'On-Duty Hours (This Week)', 'Operating Hours', 'Certified'], array_map(fn (array $shift) => [
            $shift['operator'],
            $shift['job_reference'],
            $shift['status'],
            $shift['started_at'],
            $shift['ended_at'],
            $this->hours($shift['on_duty_minutes']),
            $this->hours($shift['operating_minutes']),
            $shift['is_certified'] ? 'Yes' : 'No',
        ], $report['shifts']));

        $this->section($handle, 'Fuel', [
            'Recorded At', 'Job', 'Fuel Type', 'Requested (L)', 'Dispensed (L)', 'Variance (L)',
            'Price per Litre (PHP)', 'Total Cost (PHP)', 'Burn Rate', 'Burn Rate Unit', 'Anomaly', 'Station', 'Recorded By',
        ], array_map(fn (array $log) => [
            $log['recorded_at'],
            $log['job_reference'],
            $log['fuel_type'],
            $log['requested_litres'],
            $log['actual_litres'],
            $log['variance_litres'],
            $log['price_per_litre'],
            $log['total_cost'],
            $log['burn_rate'],
            $log['burn_rate_unit'],
            $log['is_anomaly'] ? 'Yes' : 'No',
            $log['station'],
            $log['recorded_by'],
        ], $report['fuel']));

        $this->section($handle, 'Jobs', ['Reference', 'Title', 'Client', 'Site', 'Status', 'Scheduled Start', 'Scheduled End'], array_map(fn (array $job) => [
            $job['reference'], $job['title'], $job['client'], $job['site'], $job['status'], $job['scheduled_start'], $job['scheduled_end'],
        ], $report['jobs']));

        $this->section($handle, 'Job Reports', ['Report ID', 'Job', 'Author', 'Status', 'Started At', 'Ended At', 'Duration (Minutes)', 'Ending Meter', 'Meter Unit', 'Client Sign-Off', 'Submitted At', 'Work Summary'], array_map(fn (array $r) => [
            $r['id'], $r['job_reference'], $r['author'], $r['status'], $r['started_at'], $r['ended_at'], $r['duration_minutes'],
            $r['ending_meter_value'], $r['meter_unit'], $r['signer_name'], $r['submitted_at'], $r['work_summary'],
        ], $report['job_reports']));

        $this->section($handle, 'Inspections (DVIR)', ['Reference', 'Type', 'Inspector', 'Completed At', 'Defects', 'Critical Defects'], array_map(fn (array $i) => [
            $i['reference'], $i['type'], $i['inspector'], $i['completed_at'], $i['has_defects'] ? 'Yes' : 'No', $i['critical_defects_count'],
        ], $report['inspections']));

        $this->section($handle, 'Work Orders', ['Work Order ID', 'Defect', 'Status', 'Blocks Dispatch', 'Scheduled At', 'Completed At'], array_map(fn (array $o) => [
            $o['id'], $o['defect'], $o['status'], $o['dispatch_blocking'] ? 'Yes' : 'No', $o['scheduled_at'], $o['completed_at'],
        ], $report['work_orders']));

        rewind($handle);
        $csv = (string) stream_get_contents($handle);
        fclose($handle);

        return $csv;
    }

    /**
     * @param  resource  $handle
     * @param  list<string>  $headers
     * @param  array<int, list<mixed>>  $rows
     */
    private function section($handle, string $title, array $headers, array $rows): void
    {
        fputcsv($handle, [$title], escape: '');
        fputcsv($handle, $headers, escape: '');

        if ($rows === []) {
            fputcsv($handle, ['No records this week'], escape: '');
        }

        foreach ($rows as $row) {
            fputcsv($handle, array_map(fn ($value) => $this->cell($value), $row), escape: '');
        }

        fwrite($handle, "\r\n");
    }

    private function cell(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_int($value) || is_float($value)) {
            return (string) $value;
        }

        $text = (string) $value;

        // Spreadsheet formula injection guard (matches the export job writer).
        return $text !== '' && in_array($text[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'".$text : $text;
    }

    private function hours(int|float|null $minutes): ?float
    {
        return $minutes === null ? null : round($minutes / 60, 2);
    }
}
