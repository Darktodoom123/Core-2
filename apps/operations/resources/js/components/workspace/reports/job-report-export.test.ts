import { describe, expect, it } from 'vitest';
import type { JobReportViewModel } from '@/types/workspace';
import {
    buildJobReportsCsv,
    JOB_REPORT_PACKET_LIMIT,
    jobReportPdfUrl,
    jobReportsPacketUrl,
    formatDurationMinutes,
    JOB_REPORT_CSV_HEADERS,
    jobReportsExportFilename,
    reportDurationMinutes,
} from './job-report-export';

function report(
    overrides: Partial<JobReportViewModel> = {},
): JobReportViewModel {
    return {
        id: 7,
        dispatch_job_id: 1007,
        job: { id: 1007, reference: 'JOB-1007', title: 'Tower crane lift' },
        author: { id: 3, name: 'Operator Three' },
        status: { value: 'approved', label: 'Approved' },
        work_summary: 'Lifted precast panels',
        remarks: 'Private site note',
        rejection_reason: null,
        started_at: '2026-09-01T08:00:00Z',
        ended_at: '2026-09-01T14:30:00Z',
        submitted_at: '2026-09-01T15:00:00Z',
        ending_meter_value: 4520,
        meter_type: 'engine_hours',
        latitude: 14.5995,
        longitude: 120.9842,
        signer_name: 'Engr. Santos',
        signed_at: '2026-09-01T14:45:00Z',
        attachments: [],
        ...overrides,
    } as JobReportViewModel;
}

describe('job report export helpers', () => {
    it('computes durations and rejects inverted ranges', () => {
        expect(reportDurationMinutes(report())).toBe(390);
        expect(formatDurationMinutes(390)).toBe('6h 30m');
        expect(formatDurationMinutes(45)).toBe('45m');
        expect(
            reportDurationMinutes(
                report({
                    started_at: '2026-09-01T10:00:00Z',
                    ended_at: '2026-09-01T09:00:00Z',
                }),
            ),
        ).toBeNull();
        expect(reportDurationMinutes(report({ ended_at: null }))).toBeNull();
    });

    it('builds a CSV with safe columns, quoting, and formula guards', () => {
        const csv = buildJobReportsCsv([
            report({ work_summary: '=HYPERLINK("x"), then "lift"' }),
        ]);
        const [header, row] = csv.split('\r\n');

        expect(header).toBe(JOB_REPORT_CSV_HEADERS.join(','));
        expect(header.toLowerCase()).not.toMatch(
            /latitude|longitude|remark|reason/,
        );
        expect(row).toContain('JOB-1007');
        expect(row).toContain(',390,');
        expect(row).toContain(',hrs,');
        expect(row).toContain('"\'=HYPERLINK(""x""), then ""lift"""');
        expect(csv).not.toContain('Private site note');
    });

    it('points PDF downloads at the server renderer and caps packets', () => {
        expect(jobReportPdfUrl(7)).toBe('/operations/job-reports/7/pdf');

        const url = jobReportsPacketUrl(
            Array.from(
                { length: JOB_REPORT_PACKET_LIMIT + 5 },
                (_, i) => i + 1,
            ),
        );
        const ids = new URL(url, 'https://app.test').searchParams.getAll(
            'ids[]',
        );

        expect(url.startsWith('/operations/job-reports/packet.pdf?')).toBe(
            true,
        );
        expect(ids).toHaveLength(JOB_REPORT_PACKET_LIMIT);
        expect(ids[0]).toBe('1');
    });

    it('stamps export filenames with the date', () => {
        expect(
            jobReportsExportFilename(
                'approved',
                'csv',
                new Date('2026-09-29T10:00:00Z'),
            ),
        ).toBe('job-reports-approved-2026-09-29.csv');
    });
});
