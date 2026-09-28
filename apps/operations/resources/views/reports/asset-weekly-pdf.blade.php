@php
    use App\Platform\Reporting\Pdf\ReportFormat as F;
    $asset = $report['asset'];
    $week = $report['week'];
    $s = $report['summary'];
@endphp
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $asset['code'] }} weekly report {{ $week['start'] }}</title>
@include('reports.partials.pdf-styles')
</head>
<body>

<table>
    <tr>
        <td>
            <div class="eyebrow">Asset Weekly Report · {{ $week['label'] }}</div>
            <h1>{{ $asset['code'] }} — {{ $asset['name'] }}</h1>
            <div class="subtitle">
                {{ F::text($asset['kind']) }}
                @if ($asset['registration_number']) · Reg. {{ $asset['registration_number'] }} @endif
                @if ($asset['status']) · {{ $asset['status'] }} @endif
            </div>
        </td>
        <td style="text-align: right; vertical-align: top;" class="muted">
            {{ config('app.name') }}<br>
            Generated {{ F::dateTime($report['generated_at']) }}<br>
            Times in {{ $week['timezone'] }}
        </td>
    </tr>
</table>

<h2>Week at a glance</h2>
<table class="facts">
    <tr>
        <td><div class="label">Jobs</div><div class="value">{{ $s['jobs'] }}</div></td>
        <td><div class="label">Personnel</div><div class="value">{{ $s['personnel'] }}</div></td>
        <td><div class="label">On-duty on asset</div><div class="value">{{ F::hours($s['on_duty_minutes']) }}</div></td>
        <td><div class="label">Reported work</div><div class="value">{{ F::hours($s['reported_work_minutes']) }}</div></td>
        <td><div class="label">Job reports</div><div class="value">{{ $s['job_reports'] }}</div></td>
    </tr>
    <tr>
        <td><div class="label">Fuel dispensed</div><div class="value">{{ F::number($s['fuel_litres'], 2, ' L') }}</div></td>
        <td><div class="label">Fuel cost</div><div class="value">{{ F::peso($s['fuel_cost']) }}</div></td>
        <td><div class="label">Avg burn rate</div><div class="value">{{ F::number($s['average_burn_rate']) }} <span class="muted" style="font-size:7pt">{{ $asset['burn_rate_unit'] }}</span></div></td>
        <td><div class="label">Baseline burn rate</div><div class="value">{{ F::number($asset['baseline_burn_rate']) }}</div></td>
        <td><div class="label">Fuel anomalies</div><div class="value {{ $s['fuel_anomalies'] > 0 ? 'flag' : '' }}">{{ $s['fuel_anomalies'] }}</div></td>
    </tr>
    <tr>
        <td><div class="label">Shifts on asset</div><div class="value">{{ $s['shifts'] }}</div></td>
        <td><div class="label">Recorded operating</div><div class="value">{{ F::hours($s['operating_minutes']) }}</div></td>
        <td><div class="label">Inspections</div><div class="value">{{ $s['inspections'] }}</div></td>
        <td><div class="label">With defects</div><div class="value {{ $s['inspections_with_defects'] > 0 ? 'flag' : '' }}">{{ $s['inspections_with_defects'] }}</div></td>
        <td><div class="label">Work orders</div><div class="value">{{ $s['work_orders'] }}</div></td>
    </tr>
</table>

<h2>Daily schedule</h2>
<table class="data">
    <thead><tr><th style="width:14%">Day</th><th style="width:30%">Jobs</th><th>Operators on shift</th><th class="num" style="width:13%">On-duty</th></tr></thead>
    <tbody>
    @foreach ($report['days'] as $i => $day)
        <tr class="{{ $i % 2 ? 'alt' : '' }}">
            <td>{{ $day['label'] }}</td>
            <td>{{ $day['jobs'] === [] ? F::EMPTY : implode(', ', $day['jobs']) }}</td>
            <td>{{ $day['operators'] === [] ? F::EMPTY : implode(', ', $day['operators']) }}</td>
            <td class="num">{{ $day['on_duty_minutes'] > 0 ? F::hours($day['on_duty_minutes']) : F::EMPTY }}</td>
        </tr>
    @endforeach
    </tbody>
</table>

<h2>Personnel schedule</h2>
@if ($report['personnel'] === [])
    <div class="empty">No personnel assigned or on shift with this asset this week.</div>
@else
<table class="data">
    <thead><tr>
        <th>Name</th><th>Role</th><th>Jobs</th><th>Response</th><th>Assigned</th>
        <th class="num">On asset</th><th class="num">Week on-duty (all assets)</th><th class="num">Operating</th><th class="num">Driving</th><th class="num">Standby</th>
    </tr></thead>
    <tbody>
    @foreach ($report['personnel'] as $i => $p)
        <tr class="{{ $i % 2 ? 'alt' : '' }}">
            <td><strong>{{ $p['name'] }}</strong></td>
            <td>{{ $p['roles'] === [] ? F::EMPTY : ucwords(str_replace('_', ' ', implode(', ', $p['roles']))) }}</td>
            <td>{{ $p['jobs'] === [] ? F::EMPTY : implode(', ', $p['jobs']) }}</td>
            <td>{{ F::text($p['response']) }}</td>
            <td>{{ $p['assigned_from'] ? F::shortDateTime($p['assigned_from']) : F::EMPTY }}@if ($p['assigned_until']) → {{ F::shortDateTime($p['assigned_until']) }}@endif</td>
            <td class="num">{{ F::hours($p['minutes_on_asset']) }} <span class="muted">({{ $p['shifts_on_asset'] }})</span></td>
            <td class="num">{{ F::hours($p['week_on_duty_minutes']) }} <span class="muted">({{ $p['week_shifts'] }})</span></td>
            <td class="num">{{ F::hours($p['week_operating_minutes']) }}</td>
            <td class="num">{{ F::hours($p['week_driving_minutes']) }}</td>
            <td class="num">{{ F::hours($p['week_standby_minutes']) }}</td>
        </tr>
    @endforeach
    </tbody>
</table>
<div class="muted" style="font-size:7pt; margin-top:2pt">Counts in parentheses are shifts. Operating, driving and standby are the week totals recorded on each person's shifts.</div>
@endif

<h2>Fuel</h2>
@if ($report['fuel'] === [])
    <div class="empty">No fuel dispensed to this asset this week.</div>
@else
<table class="data">
    <thead><tr>
        <th>Recorded</th><th>Job</th><th>Type</th><th class="num">Requested</th><th class="num">Dispensed</th><th class="num">Variance</th>
        <th class="num">₱ / L</th><th class="num">Cost</th><th class="num">Burn rate</th><th>Station</th><th>Recorded by</th>
    </tr></thead>
    <tbody>
    @foreach ($report['fuel'] as $i => $f)
        <tr class="{{ $i % 2 ? 'alt' : '' }}">
            <td>{{ F::shortDateTime($f['recorded_at']) }}</td>
            <td>{{ F::text($f['job_reference']) }}</td>
            <td>{{ F::text($f['fuel_type']) }}</td>
            <td class="num">{{ F::number($f['requested_litres'], 2, ' L') }}</td>
            <td class="num">{{ F::number($f['actual_litres'], 2, ' L') }}</td>
            <td class="num">{{ F::number($f['variance_litres'], 2, ' L') }}</td>
            <td class="num">{{ F::peso($f['price_per_litre']) }}</td>
            <td class="num">{{ F::peso($f['total_cost']) }}</td>
            <td class="num {{ $f['is_anomaly'] ? 'flag' : '' }}">{{ F::number($f['burn_rate']) }}@if ($f['is_anomaly']) (!)@endif</td>
            <td>{{ F::text($f['station']) }}</td>
            <td>{{ F::text($f['recorded_by']) }}</td>
        </tr>
        @if ($f['is_anomaly'] && $f['anomaly_reason'])
            <tr><td></td><td colspan="10" class="flag" style="font-weight:normal">Anomaly: {{ $f['anomaly_reason'] }}</td></tr>
        @endif
    @endforeach
        <tr>
            <td colspan="4"><strong>Total</strong></td>
            <td class="num"><strong>{{ F::number($s['fuel_litres'], 2, ' L') }}</strong></td>
            <td></td><td></td>
            <td class="num"><strong>{{ F::peso($s['fuel_cost']) }}</strong></td>
            <td class="num"><strong>{{ F::number($s['average_burn_rate']) }}</strong></td>
            <td colspan="2"></td>
        </tr>
    </tbody>
</table>
@endif

<h2>Shifts on this asset</h2>
@if ($report['shifts'] === [])
    <div class="empty">No shifts were logged on this asset this week.</div>
@else
<table class="data">
    <thead><tr><th>Operator</th><th>Job</th><th>Status</th><th>Started</th><th>Ended</th><th class="num">On-duty (this week)</th><th class="num">Operating</th><th>Certified</th></tr></thead>
    <tbody>
    @foreach ($report['shifts'] as $i => $shift)
        <tr class="{{ $i % 2 ? 'alt' : '' }}">
            <td>{{ F::text($shift['operator']) }}</td>
            <td>{{ F::text($shift['job_reference']) }}</td>
            <td>{{ F::text($shift['status']) }}</td>
            <td>{{ F::shortDateTime($shift['started_at']) }}</td>
            <td>{{ $shift['ended_at'] ? F::shortDateTime($shift['ended_at']) : 'Open' }}</td>
            <td class="num">{{ F::hours($shift['on_duty_minutes']) }}</td>
            <td class="num">{{ F::hours($shift['operating_minutes']) }}</td>
            <td>{{ $shift['is_certified'] ? 'Yes' : 'No' }}</td>
        </tr>
    @endforeach
    </tbody>
</table>
@endif

<h2>Jobs</h2>
@if ($report['jobs'] === [])
    <div class="empty">This asset was not assigned to any job this week.</div>
@else
<table class="data">
    <thead><tr><th>Reference</th><th>Title</th><th>Client</th><th>Site</th><th>Status</th><th>Scheduled</th></tr></thead>
    <tbody>
    @foreach ($report['jobs'] as $i => $job)
        <tr class="{{ $i % 2 ? 'alt' : '' }}">
            <td><strong>{{ $job['reference'] }}</strong></td>
            <td>{{ F::text($job['title']) }}</td>
            <td>{{ F::text($job['client']) }}</td>
            <td>{{ F::text($job['site']) }}</td>
            <td>{{ F::text($job['status']) }}</td>
            <td>{{ F::shortDateTime($job['scheduled_start']) }}@if ($job['scheduled_end']) → {{ F::shortDateTime($job['scheduled_end']) }}@endif</td>
        </tr>
    @endforeach
    </tbody>
</table>
@endif

<h2>Job reports</h2>
@if ($report['job_reports'] === [])
    <div class="empty">No job reports filed for this asset's jobs this week.</div>
@else
<table class="data">
    <thead><tr><th>#</th><th>Job</th><th>Author</th><th>Status</th><th class="num">Duration</th><th class="num">Ending meter</th><th>Sign-off</th><th style="width:34%">Work summary</th></tr></thead>
    <tbody>
    @foreach ($report['job_reports'] as $i => $r)
        <tr class="{{ $i % 2 ? 'alt' : '' }}">
            <td>{{ $r['id'] }}</td>
            <td>{{ F::text($r['job_reference']) }}</td>
            <td>{{ F::text($r['author']) }}</td>
            <td>{{ $r['status'] }}</td>
            <td class="num">{{ $r['duration_minutes'] === null ? F::EMPTY : F::hours($r['duration_minutes']) }}</td>
            <td class="num">{{ F::number($r['ending_meter_value'], 1, $r['meter_unit'] ? ' '.$r['meter_unit'] : '') }}</td>
            <td>{{ F::text($r['signer_name']) }}</td>
            <td>{{ $r['work_summary'] }}</td>
        </tr>
    @endforeach
    </tbody>
</table>
@endif

<h2>Condition</h2>
<table>
    <tr>
        <td style="width:50%; vertical-align:top; padding-right:6pt">
            <div class="label" style="margin-bottom:3pt">Inspections (DVIR)</div>
            @if ($report['inspections'] === [])
                <div class="empty">No inspections completed this week.</div>
            @else
            <table class="data">
                <thead><tr><th>Ref</th><th>Type</th><th>Inspector</th><th>Completed</th><th>Result</th></tr></thead>
                <tbody>
                @foreach ($report['inspections'] as $i => $insp)
                    <tr class="{{ $i % 2 ? 'alt' : '' }}">
                        <td>{{ $insp['reference'] }}</td>
                        <td>{{ F::text($insp['type']) }}</td>
                        <td>{{ F::text($insp['inspector']) }}</td>
                        <td>{{ F::shortDateTime($insp['completed_at']) }}</td>
                        <td class="{{ $insp['has_defects'] ? 'flag' : 'ok' }}">{{ $insp['has_defects'] ? 'Defects ('.$insp['critical_defects_count'].' critical)' : 'No defects' }}</td>
                    </tr>
                @endforeach
                </tbody>
            </table>
            @endif
        </td>
        <td style="width:50%; vertical-align:top; padding-left:6pt">
            <div class="label" style="margin-bottom:3pt">Maintenance work orders</div>
            @if ($report['work_orders'] === [])
                <div class="empty">No work orders this week.</div>
            @else
            <table class="data">
                <thead><tr><th>#</th><th>Defect</th><th>Status</th><th>Blocks</th><th>Completed</th></tr></thead>
                <tbody>
                @foreach ($report['work_orders'] as $i => $wo)
                    <tr class="{{ $i % 2 ? 'alt' : '' }}">
                        <td>{{ $wo['id'] }}</td>
                        <td>{{ F::text($wo['defect']) }}</td>
                        <td>{{ F::text($wo['status']) }}</td>
                        <td class="{{ $wo['dispatch_blocking'] ? 'flag' : '' }}">{{ $wo['dispatch_blocking'] ? 'Yes' : 'No' }}</td>
                        <td>{{ F::shortDateTime($wo['completed_at']) }}</td>
                    </tr>
                @endforeach
                </tbody>
            </table>
            @endif
        </td>
    </tr>
</table>

<table class="signatures">
    <tr>
        <td class="line" style="width:46%">Prepared by</td><td class="gap"></td><td class="line" style="width:46%">Reviewed by (Operations Manager)</td>
    </tr>
</table>

</body>
</html>
