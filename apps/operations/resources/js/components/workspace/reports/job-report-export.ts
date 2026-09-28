import type { JobReportViewModel } from '@/types/workspace';

/**
 * Job report exports. CSVs are built client-side from the reports already
 * loaded in the workspace (column choices mirror the server export policy:
 * no raw coordinates, remarks, or rejection reasons); PDFs are rendered by the server.
 */

export function reportDurationMinutes(
    report: Pick<JobReportViewModel, 'started_at' | 'ended_at'>,
): number | null {
    if (!report.started_at || !report.ended_at) {
        return null;
    }

    const start = new Date(report.started_at).getTime();
    const end = new Date(report.ended_at).getTime();

    if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
        return null;
    }

    return Math.round((end - start) / 60000);
}

export function formatDurationMinutes(minutes: number | null): string {
    if (minutes === null) {
        return '';
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return hours === 0 ? `${mins}m` : `${hours}h ${mins}m`;
}

export function meterUnit(meterType: string | null | undefined): string {
    if (meterType === 'engine_hours') {
        return 'hrs';
    }

    if (meterType === 'odometer_km') {
        return 'km';
    }

    return '';
}

export const JOB_REPORT_CSV_HEADERS = [
    'Report ID',
    'Dispatch Reference',
    'Job Title',
    'Author',
    'Status',
    'Started At',
    'Ended At',
    'Duration (Minutes)',
    'Ending Meter',
    'Meter Unit',
    'Client Sign-Off',
    'Signed At',
    'Attachments',
    'Resubmissions',
    'Submitted At',
    'Work Summary',
] as const;

function jobReportCsvRow(report: JobReportViewModel): Array<string | number> {
    return [
        report.id,
        report.job?.reference ?? `Job #${report.dispatch_job_id}`,
        report.job?.title ?? '',
        report.author?.name ?? '',
        report.status.label,
        report.started_at ?? '',
        report.ended_at ?? '',
        reportDurationMinutes(report) ?? '',
        report.ending_meter_value ?? '',
        meterUnit(report.meter_type),
        report.signer_name ?? '',
        report.signed_at ?? '',
        report.attachments?.length ?? 0,
        report.resubmitted_count ?? 0,
        report.submitted_at ?? '',
        report.work_summary ?? '',
    ];
}

function csvCell(value: string | number): string {
    let text = String(value);

    // Guard spreadsheet formula injection, matching the server CSV writer.
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
        text = `'${text}`;
    }

    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildJobReportsCsv(reports: JobReportViewModel[]): string {
    const lines = [
        JOB_REPORT_CSV_HEADERS.map(csvCell).join(','),
        ...reports.map((report) =>
            jobReportCsvRow(report).map(csvCell).join(','),
        ),
    ];

    return lines.join('\r\n');
}

export function jobReportsExportFilename(
    suffix: string,
    extension: string,
    now: Date = new Date(),
): string {
    const stamp = now.toISOString().slice(0, 10);

    return `job-reports-${suffix}-${stamp}.${extension}`;
}

export function downloadJobReportsCsv(
    reports: JobReportViewModel[],
    filename: string,
): void {
    // BOM keeps Excel from mangling UTF-8 names and summaries.
    const blob = new Blob(['﻿', buildJobReportsCsv(reports)], {
        type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Server-rendered PDF (mPDF) for one job report. */
export function jobReportPdfUrl(reportId: number): string {
    return `/operations/job-reports/${reportId}/pdf`;
}

/** Maximum reports the server renders into one packet PDF. */
export const JOB_REPORT_PACKET_LIMIT = 50;

/** Server-rendered multi-page PDF, one report per page, in the given order. */
export function jobReportsPacketUrl(reportIds: number[]): string {
    const params = new URLSearchParams();

    for (const id of reportIds.slice(0, JOB_REPORT_PACKET_LIMIT)) {
        params.append('ids[]', String(id));
    }

    return `/operations/job-reports/packet.pdf?${params.toString()}`;
}
