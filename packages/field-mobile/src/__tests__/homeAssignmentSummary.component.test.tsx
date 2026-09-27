import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { AssignmentSummaryCard } from '../components/home/assignment-summary-card';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';
import type { DispatchJob } from '../types/index';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const job = {
    id: 7,
    reference: 'JOB-7',
    title: 'Girder Lift',
} as DispatchJob;

type View = Awaited<ReturnType<typeof render>>;

const inTheme = (mode: ThemeMode, node: React.ReactElement) =>
    render(<ThemeProvider initialMode={mode}>{node}</ThemeProvider>);

const flat = (view: View, testID: string) => {
    const style = view.getByTestId(testID).props.style;

    return StyleSheet.flatten(
        typeof style === 'function' ? style({ pressed: false }) : style,
    );
};

const pendingJob = {
    id: 8,
    reference: 'JOB-8',
    title: 'Tower Crane Dismantle',
    status: { value: 'dispatched', label: 'Dispatched' },
    my_assignment: {
        id: 80,
        response_status: 'pending',
        response_status_label: 'Pending',
    },
} as DispatchJob;

const withStatus = (
    id: number,
    status: 'accepted' | 'working',
    scheduledStart: string,
) =>
    ({
        id,
        reference: `JOB-${id}`,
        title: `Lift ${id}`,
        scheduled_start: scheduledStart,
        status: { value: status, label: status },
        my_assignment: {
            id: id * 10,
            response_status: 'accepted',
            response_status_label: 'Accepted',
        },
    }) as DispatchJob;

const baseProps = {
    isLoading: false,
    onViewOrders: jest.fn(),
    onOpenJob: jest.fn(),
};

describe.each(MODES)(
    'Home assignment summary (%s)',
    (mode, theme: ThemeColors) => {
        it('renders nothing on home when there is no work (Dispatch owns the empty state)', async () => {
            const view = await inTheme(
                mode,
                <AssignmentSummaryCard {...baseProps} jobs={[]} />,
            );

            expect(
                view.queryByTestId('home-assignment-summary-card'),
            ).toBeNull();
            expect(view.queryByText('No work assigned yet')).toBeNull();
        });

        it('rests as a bordered card when there is work', async () => {
            const view = await inTheme(
                mode,
                <AssignmentSummaryCard {...baseProps} jobs={[job]} />,
            );
            const card = flat(view, 'home-assignment-summary-card');

            expect(card.backgroundColor).toBe(theme.surface);
            expect(card.borderColor).toBe(theme.border);
            expect(card.elevation).toBeUndefined();
        });

        it('shows loading inside the same card', async () => {
            const view = await inTheme(
                mode,
                <AssignmentSummaryCard {...baseProps} isLoading jobs={[]} />,
            );

            expect(view.getByText('Loading assignments…')).toBeTruthy();
            expect(view.queryByText('No work assigned yet')).toBeNull();
        });

        it('offers View Orders as a neutral 48dp action, not a cobalt link', async () => {
            const onViewOrders = jest.fn();
            const view = await inTheme(
                mode,
                <AssignmentSummaryCard
                    {...baseProps}
                    jobs={[job, pendingJob]}
                    onViewOrders={onViewOrders}
                />,
            );
            const button = flat(view, 'home-view-orders-btn');

            expect(button.backgroundColor).toBe(theme.surface);
            expect(button.borderColor).toBe(theme.borderStrong);
            expect(button.minHeight).toBeGreaterThanOrEqual(48);
            expect(view.getByText('1 active · 1 response needed')).toBeTruthy();

            await fireEvent.press(view.getByTestId('home-view-orders-btn'));
            expect(onViewOrders).toHaveBeenCalled();
            expect(view.getByTestId('home-active-job-pill')).toBeTruthy();
        });

        it('counts like the Dispatch tabs and opens the job under way', async () => {
            const onOpenJob = jest.fn();
            const scheduled = withStatus(1, 'accepted', '2026-09-26T07:00:00Z');
            const working = withStatus(2, 'working', '2026-09-27T07:00:00Z');
            const view = await inTheme(
                mode,
                <AssignmentSummaryCard
                    {...baseProps}
                    jobs={[scheduled, working]}
                    onOpenJob={onOpenJob}
                />,
            );

            expect(view.getByText('1 active · 1 scheduled')).toBeTruthy();
            expect(view.getByText('View Orders (2)')).toBeTruthy();

            await fireEvent.press(view.getByTestId('home-active-job-pill'));
            expect(onOpenJob).toHaveBeenCalledWith(working);
        });
    },
);
