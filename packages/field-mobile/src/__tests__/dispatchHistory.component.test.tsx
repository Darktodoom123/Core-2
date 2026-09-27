import {
    fireEvent,
    render,
    waitFor,
    within,
} from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { DispatchOrdersScreen } from '../screens/DispatchOrdersScreen';
import type { FieldApiClient } from '../services/apiClient';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';
import type {
    DispatchJob,
    DispatchStatus,
    JobHistoryPage,
} from '../types/index';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const jobWith = (
    id: number,
    status: DispatchStatus,
    extra: Partial<DispatchJob> = {},
): DispatchJob => ({
    id,
    reference: `JOB-${id}`,
    title: `Lift ${id}`,
    client: 'DMCI',
    site: 'Pier 4',
    scheduled_start: '2026-09-20T12:00:00Z',
    priority: { value: 'routine', label: 'Routine' },
    status: { value: status, label: status },
    version: 1,
    capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
    },
    my_assignment: {
        id: id * 10,
        response_status: 'accepted',
        response_status_label: 'Accepted',
    },
    asset_assignments: [],
    ...extra,
});

const completed = jobWith(21, 'completed', {
    completed_at: '2026-09-26T12:00:00Z',
});
const cancelled = jobWith(22, 'cancelled', {
    cancelled_at: '2026-09-25T12:00:00Z',
});
const pending = jobWith(1, 'dispatched', {
    my_assignment: {
        id: 10,
        response_status: 'pending',
        response_status_label: 'Pending',
    },
});

const fakeApi = (pages: Array<JobHistoryPage | Error>) => {
    const fetchJobHistory = jest.fn<Promise<JobHistoryPage>, [number]>(
        async () => {
            const next = pages.shift() ?? { items: [], nextPage: null };

            if (next instanceof Error) {
                throw next;
            }

            return next;
        },
    );

    return {
        api: { fetchJobHistory } as unknown as FieldApiClient,
        fetchJobHistory,
    };
};

const renderScreen = (
    mode: ThemeMode,
    jobs: DispatchJob[],
    api?: FieldApiClient,
) =>
    render(
        <ThemeProvider initialMode={mode}>
            <DispatchOrdersScreen
                apiClient={api}
                jobs={jobs}
                onReportDelay={jest.fn()}
                onTransitionStatus={jest.fn()}
            />
        </ThemeProvider>,
    );

type View = Awaited<ReturnType<typeof renderScreen>>;

const openHistory = (view: View) =>
    fireEvent.press(view.getByTestId('intake-tab-history'));

describe.each(MODES)('Dispatch history (%s)', (mode, theme: ThemeColors) => {
    it('splits work into Needs Response, Active and History', async () => {
        const view = await renderScreen(mode, [
            pending,
            jobWith(2, 'accepted'),
            jobWith(3, 'en_route'),
        ]);

        expect(view.getByText('Needs Response (1)')).toBeTruthy();
        expect(view.getByText('Active (3)')).toBeTruthy();
        expect(view.getByText('History')).toBeTruthy();
        expect(view.queryByText(/All Orders/)).toBeNull();
    });

    it('never lists a finished job under Active', async () => {
        const view = await renderScreen(mode, [
            jobWith(2, 'accepted'),
            completed,
        ]);

        await fireEvent.press(view.getByTestId('intake-tab-active'));

        expect(view.getByText('Active (1)')).toBeTruthy();
        expect(view.queryByText('JOB-21')).toBeNull();
    });

    it('loads finished jobs from the server as read-only cards with real finish times', async () => {
        const { api, fetchJobHistory } = fakeApi([
            { items: [completed, cancelled], nextPage: null },
        ]);
        const view = await renderScreen(mode, [], api);

        await openHistory(view);

        const done = await view.findByTestId('job-history-card-21');
        expect(fetchJobHistory).toHaveBeenCalledWith(1);
        expect(within(done).getByText('Completed')).toBeTruthy();
        expect(within(done).getByText(/^Completed Sep 26/)).toBeTruthy();
        expect(
            within(view.getByTestId('job-history-card-22')).getByText(
                /^Cancelled Sep 25/,
            ),
        ).toBeTruthy();
        expect(view.getByText('Last 30 days')).toBeTruthy();

        for (const id of [
            'job-directions-btn-21',
            'report-delay-btn-21',
            'action-complete-btn-21',
        ]) {
            expect(view.queryByTestId(id)).toBeNull();
        }
    });

    it('colours Completed as success and Cancelled as neutral, never gold', async () => {
        const { api } = fakeApi([
            { items: [completed, cancelled], nextPage: null },
        ]);
        const view = await renderScreen(mode, [], api);

        await openHistory(view);
        await view.findByTestId('job-history-card-21');

        const pill = (id: number) =>
            StyleSheet.flatten(
                view.getByTestId(`job-history-status-${id}`).props.style,
            );

        expect(pill(21).backgroundColor).toBe(theme.successEmeraldLight);
        expect(pill(22).backgroundColor).toBe(theme.surfaceHighlight);
        expect(pill(22).backgroundColor).not.toBe(theme.brandAmber);
    });

    it('labels a missing finish time as the schedule, never as the finish', async () => {
        const { api } = fakeApi([
            { items: [jobWith(23, 'completed')], nextPage: null },
        ]);
        const view = await renderScreen(mode, [], api);

        await openHistory(view);
        const card = await view.findByTestId('job-history-card-23');

        expect(within(card).getByText(/^Scheduled Sep 20/)).toBeTruthy();
        expect(within(card).queryByText(/^Completed Sep/)).toBeNull();
    });

    it('loads older jobs page by page until the server has no more', async () => {
        const { api, fetchJobHistory } = fakeApi([
            { items: [completed], nextPage: 2 },
            { items: [cancelled], nextPage: null },
        ]);
        const view = await renderScreen(mode, [], api);

        await openHistory(view);
        await view.findByTestId('job-history-card-21');
        await fireEvent.press(view.getByTestId('job-history-load-more'));

        await view.findByTestId('job-history-card-22');
        expect(fetchJobHistory).toHaveBeenLastCalledWith(2);
        expect(view.queryByTestId('job-history-load-more')).toBeNull();
    });

    it('says history did not load, never that there is none, when the server fails', async () => {
        const { api, fetchJobHistory } = fakeApi([
            new Error('offline'),
            { items: [completed], nextPage: null },
        ]);
        const view = await renderScreen(mode, [], api);

        await openHistory(view);

        expect(await view.findByText("Job history didn't load")).toBeTruthy();
        expect(view.queryByText(/No finished jobs/)).toBeNull();

        await fireEvent.press(view.getByTestId('job-history-retry'));
        await view.findByTestId('job-history-card-21');
        expect(fetchJobHistory).toHaveBeenCalledTimes(2);
    });

    it('shows a plain empty state when the server has no finished jobs', async () => {
        const { api } = fakeApi([{ items: [], nextPage: null }]);
        const view = await renderScreen(mode, [], api);

        await openHistory(view);

        await waitFor(() =>
            expect(
                view.getByText('No finished jobs in the last 30 days'),
            ).toBeTruthy(),
        );
    });
});
