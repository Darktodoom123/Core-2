@php
    use App\Platform\Reporting\Pdf\ReportFormat as F;
@endphp
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $title }}</title>
@include('reports.partials.pdf-styles')
</head>
<body>
@foreach ($reports as $index => $report)
    @php
        $duration = $report->started_at && $report->ended_at && $report->ended_at->gte($report->started_at)
            ? (int) round($report->started_at->diffInMinutes($report->ended_at))
            : null;
        $unit = match ($report->meter_type) { 'engine_hours' => ' hrs', 'odometer_km' => ' km', default => '' };
    @endphp
    @if ($index > 0)<pagebreak />@endif

    <table>
        <tr>
            <td>
                <div class="eyebrow">Job Report #{{ $report->id }}</div>
                <h1>{{ $report->job?->reference ?? 'Dispatch #'.$report->dispatch_job_id }}</h1>
                @if ($report->job?->title)<div class="subtitle">{{ $report->job->title }}</div>@endif
                @if ($report->job?->client || $report->job?->site)
                    <div class="muted">{{ collect([$report->job?->client, $report->job?->site])->filter()->implode(' · ') }}</div>
                @endif
            </td>
            <td style="text-align:right; vertical-align:top">
                <span class="status">{{ $report->status->label() }}</span><br>
                <span class="muted" style="font-size:7pt">{{ config('app.name') }}</span>
            </td>
        </tr>
    </table>

    <h2>Details</h2>
    <table class="facts">
        <tr>
            <td><div class="label">Filed by</div><div class="value">{{ F::text($report->author?->name) }}</div></td>
            <td><div class="label">Submitted</div><div class="value">{{ $report->submitted_at ? F::dateTime($report->submitted_at) : 'Unsubmitted draft' }}</div></td>
            <td><div class="label">Resubmissions</div><div class="value">{{ (int) $report->resubmitted_count }}</div></td>
        </tr>
        <tr>
            <td><div class="label">Started</div><div class="value">{{ F::dateTime($report->started_at) }}</div></td>
            <td><div class="label">Ended</div><div class="value">{{ F::dateTime($report->ended_at) }}</div></td>
            <td><div class="label">Elapsed</div><div class="value">{{ $duration === null ? F::EMPTY : F::hours($duration) }}</div></td>
        </tr>
        <tr>
            <td><div class="label">Ending meter</div><div class="value">{{ F::number($report->ending_meter_value, 1, $unit) }}</div></td>
            <td><div class="label">Location stamp</div><div class="value">{{ $report->latitude !== null && $report->longitude !== null ? 'Recorded' : F::EMPTY }}</div></td>
            <td><div class="label">Client sign-off</div><div class="value">{{ F::text($report->signer_name) }}</div>
                @if ($report->signer_role || $report->signed_at)<div class="muted">{{ collect([$report->signer_role, $report->signed_at ? F::dateTime($report->signed_at) : null])->filter()->implode(' · ') }}</div>@endif
            </td>
        </tr>
    </table>

    <h2>Work summary</h2>
    <div class="body-text">{!! nl2br(e($report->work_summary)) !!}</div>

    @if ($report->remarks)
        <h2>Remarks &amp; site observations</h2>
        <div class="body-text">{!! nl2br(e($report->remarks)) !!}</div>
    @endif

    @if ($report->status->value === 'rejected' && $report->rejection_reason)
        <h2>Reviewer return note</h2>
        <div class="body-text flag" style="font-weight:normal">{!! nl2br(e($report->rejection_reason)) !!}</div>
    @endif

    <h2>Attachments ({{ $report->attachments->count() }})</h2>
    @if ($report->attachments->isEmpty())
        <div class="empty">No attachments.</div>
    @else
        <table class="data">
            <thead><tr><th>File</th><th>Type</th><th class="num">Size</th><th>SHA-256</th></tr></thead>
            <tbody>
            @foreach ($report->attachments as $i => $file)
                <tr class="{{ $i % 2 ? 'alt' : '' }}">
                    <td>{{ $file->original_filename }}</td>
                    <td>{{ $file->mime_type }}</td>
                    <td class="num">{{ number_format(($file->size_bytes ?? 0) / 1024, 1) }} KB</td>
                    <td style="font-size:6.5pt">{{ $file->checksum_sha256 ? substr($file->checksum_sha256, 0, 16).'…' : F::EMPTY }}</td>
                </tr>
            @endforeach
            </tbody>
        </table>
    @endif

    <table class="signatures">
        <tr>
            <td class="line" style="width:46%">Operator — {{ F::text($report->author?->name) }}</td><td class="gap"></td><td class="line" style="width:46%">Reviewed by (Operations Manager)</td>
        </tr>
    </table>
    <div class="muted" style="margin-top:10pt; font-size:7pt">Generated {{ F::dateTime(now()) }}</div>
@endforeach
</body>
</html>
