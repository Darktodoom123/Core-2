import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AssetWeeklyReport } from '@/components/workspace/reports/asset-weekly-report';
import { AssetWeeklyReportView } from '@/components/workspace/reports/asset-weekly-report';

const assets = [
    { id: 7, code: 'CRN-77', name: '70T Mobile Crane', kind: 'crane' },
];

function makeReport(
    overrides: Partial<AssetWeeklyReport> = {},
): AssetWeeklyReport {
    return {
        asset: {
            id: 7,
            code: 'CRN-77',
            name: '70T Mobile Crane',
            kind: 'crane',
            registration_number: null,
            status: 'Working',
            baseline_burn_rate: 12,
            burn_rate_unit: 'litres_per_hour',
        },
        week: {
            start: '2026-09-21',
            end: '2026-09-27',
            previous: '2026-09-14',
            next: '2026-09-28',
            label: 'Sep 21 – Sep 27, 2026',
            timezone: 'Asia/Manila',
        },
        generated_at: '2026-09-23T10:00:00+08:00',
        currency: 'PHP',
        summary: {
            jobs: 1,
            personnel: 1,
            shifts: 1,
            on_duty_minutes: 360,
            operating_minutes: 300,
            job_reports: 1,
            reported_work_minutes: 270,
            fuel_logs: 1,
            fuel_litres: 75.5,
            fuel_cost: 4711.2,
            average_burn_rate: 12.6,
            fuel_anomalies: 0,
            inspections: 0,
            inspections_with_defects: 0,
            work_orders: 0,
        },
        days: [
            {
                date: '2026-09-22',
                label: 'Tue, Sep 22',
                jobs: ['DSP-WK-1'],
                operators: ['Oscar Operator'],
                on_duty_minutes: 360,
            },
        ],
        personnel: [
            {
                user_id: 2,
                name: 'Oscar Operator',
                roles: ['operator'],
                jobs: ['DSP-WK-1'],
                response: 'Accepted',
                assigned_from: '2026-09-22T08:00:00+08:00',
                assigned_until: null,
                shifts_on_asset: 1,
                minutes_on_asset: 360,
                week_shifts: 2,
                week_on_duty_minutes: 480,
                week_operating_minutes: 300,
                week_driving_minutes: 0,
                week_standby_minutes: 0,
                week_break_minutes: 0,
            },
        ],
        jobs: [],
        fuel: [],
        shifts: [],
        job_reports: [],
        inspections: [],
        work_orders: [],
        ...overrides,
    };
}

function mockFetch(report: AssetWeeklyReport | null) {
    const fetchMock = vi.fn(
        async () =>
            new Response(JSON.stringify({ assets, report }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }),
    );
    vi.stubGlobal('fetch', fetchMock);

    return fetchMock;
}

describe('AssetWeeklyReportView', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('asks for an asset before showing a report', async () => {
        mockFetch(null);
        render(<AssetWeeklyReportView />);

        expect(await screen.findByText('Choose an asset')).toBeInTheDocument();
        expect(
            screen.getByRole('option', { name: 'CRN-77 — 70T Mobile Crane' }),
        ).toBeInTheDocument();
    });

    it('renders recorded totals in pesos with real server download links', async () => {
        const fetchMock = mockFetch(makeReport());
        render(<AssetWeeklyReportView initialAssetId={7} />);

        expect(await screen.findByText('₱4,711.20')).toBeInTheDocument();
        expect(screen.getAllByText('Oscar Operator').length).toBeGreaterThan(0);
        expect(screen.getByText('8h 0m (2)')).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('asset_id=7'),
            expect.anything(),
        );

        expect(
            screen.getByRole('link', { name: /download pdf/i }),
        ).toHaveAttribute(
            'href',
            '/operations/reports/asset-weekly/7/download?format=pdf&week=2026-09-21',
        );
        expect(
            screen.getByRole('link', { name: /download csv/i }),
        ).toHaveAttribute(
            'href',
            '/operations/reports/asset-weekly/7/download?format=csv&week=2026-09-21',
        );
    });

    it('shows a dash instead of ₱0 when no fuel cost was recorded', async () => {
        mockFetch(
            makeReport({
                summary: {
                    ...makeReport().summary,
                    fuel_cost: null,
                    fuel_logs: 0,
                    fuel_litres: 0,
                },
            }),
        );
        render(<AssetWeeklyReportView initialAssetId={7} />);

        await screen.findByText('8h 0m (2)');
        expect(screen.queryByText('₱0.00')).not.toBeInTheDocument();
    });

    it('requests the previous week when navigating back', async () => {
        const fetchMock = mockFetch(makeReport());
        render(<AssetWeeklyReportView initialAssetId={7} />);

        await screen.findByText('8h 0m (2)');
        fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));

        await waitFor(() =>
            expect(fetchMock).toHaveBeenLastCalledWith(
                expect.stringContaining('week=2026-09-14'),
                expect.anything(),
            ),
        );
    });
});
