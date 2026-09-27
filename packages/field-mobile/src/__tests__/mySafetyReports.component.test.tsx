import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { FieldSafetyScreen } from '../screens/FieldSafetyScreen';
import type { FieldApiClient } from '../services/apiClient';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';
import type { MySafetyReports } from '../types/index';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const reports: MySafetyReports = {
    hazards: [
        {
            id: 1,
            ticket_code: 'HZ-001',
            project_site: 'Pier 4',
            category: 'electrical',
            severity: 'high',
            status: 'rectified',
            work_stoppage_issued: false,
            reported_at: '2026-09-26T12:00:00Z',
            rectified_at: '2026-09-26T14:00:00Z',
            rectification_notes: 'Line de-energised',
        },
        {
            id: 2,
            ticket_code: 'HZ-002',
            project_site: 'Pier 4',
            category: 'rigging_tackle',
            severity: 'medium',
            status: 'open',
            work_stoppage_issued: false,
            reported_at: '2026-09-25T12:00:00Z',
            rectified_at: null,
            rectification_notes: null,
        },
    ],
    work_stoppages: [
        {
            id: 7,
            notice_number: 'WS-007',
            project_site: 'Pier 4',
            reason: 'Unsafe ground',
            affected_area: 'Pad 2',
            is_active: true,
            issued_at: '2026-09-24T12:00:00Z',
            lifted_at: null,
            lift_reason: null,
        },
    ],
};

const apiReturning = (...results: Array<MySafetyReports | Error>) => {
    const fetchMySafetyReports = jest.fn(async () => {
        const next = results.shift() ?? { hazards: [], work_stoppages: [] };

        if (next instanceof Error) {
            throw next;
        }

        return next;
    });

    return {
        api: { fetchMySafetyReports } as unknown as FieldApiClient,
        fetchMySafetyReports,
    };
};

const renderSafety = (mode: ThemeMode, apiClient?: FieldApiClient) =>
    render(
        <ThemeProvider initialMode={mode}>
            <FieldSafetyScreen
                apiClient={apiClient}
                commands={[]}
                isOnline
                onBack={jest.fn()}
                onIssueWorkStoppage={jest.fn()}
                onReportHazard={jest.fn()}
            />
        </ThemeProvider>,
    );

describe.each(MODES)('Your safety reports (%s)', (mode, theme: ThemeColors) => {
    it('shows each report with what became of it', async () => {
        const { api, fetchMySafetyReports } = apiReturning(reports);
        const view = await renderSafety(mode, api);

        const list = await view.findByTestId('my-safety-reports');
        expect(fetchMySafetyReports).toHaveBeenCalled();
        expect(within(list).getByText('Last 30 days')).toBeTruthy();

        const fixed = within(list).getByTestId('my-hazard-1');
        expect(within(fixed).getByText('Fixed')).toBeTruthy();
        expect(within(fixed).getByText(/Line de-energised/)).toBeTruthy();

        const open = within(list).getByTestId('my-hazard-2');
        expect(within(open).getByText('Open')).toBeTruthy();

        const stop = within(list).getByTestId('my-stoppage-7');
        expect(within(stop).getByText('Stop-work active')).toBeTruthy();
    });

    it('colours fixed as success, open as warning and an active stop-work as critical', async () => {
        const { api } = apiReturning(reports);
        const view = await renderSafety(mode, api);

        await view.findByTestId('my-safety-reports');

        const bg = (id: string) =>
            StyleSheet.flatten(view.getByTestId(id).props.style)
                .backgroundColor;

        expect(bg('my-hazard-status-1')).toBe(theme.successEmeraldLight);
        expect(bg('my-hazard-status-2')).toBe(theme.warningOrangeLight);
        expect(bg('my-stoppage-status-7')).toBe(theme.hazardRedLight);
    });

    it('says the reports did not load, never that there are none, and retries', async () => {
        const { api, fetchMySafetyReports } = apiReturning(
            new Error('offline'),
            reports,
        );
        const view = await renderSafety(mode, api);

        expect(
            await view.findByText("Your safety reports didn't load"),
        ).toBeTruthy();
        expect(view.queryByText(/No safety reports from you/)).toBeNull();

        await fireEvent.press(view.getByTestId('my-safety-reports-retry'));
        expect(await view.findByTestId('my-hazard-1')).toBeTruthy();
        expect(fetchMySafetyReports).toHaveBeenCalledTimes(2);
    });

    it('says plainly when there are no reports in the window', async () => {
        const { api } = apiReturning({ hazards: [], work_stoppages: [] });
        const view = await renderSafety(mode, api);

        expect(
            await view.findByText(
                'No safety reports from you in the last 30 days',
            ),
        ).toBeTruthy();
    });
});
