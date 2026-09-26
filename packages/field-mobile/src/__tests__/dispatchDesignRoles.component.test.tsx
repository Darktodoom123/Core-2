import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { AssignmentResponseCard } from '../components/cards/AssignmentResponseCard';
import { TileScreenHeader } from '../components/layout/tile-screen-header';
import { DispatchOrdersScreen } from '../screens/DispatchOrdersScreen';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';
import type { DispatchJob } from '../types/index';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const pendingJob: DispatchJob = {
    id: 101,
    reference: 'JOB-2026-0101',
    title: 'Precision Crane Lift',
    client: 'Megawide Construction Corp',
    site: 'Clark International Airport Terminal 2',
    scheduled_start: '2026-09-07T08:00:00Z',
    priority: { value: 'priority', label: 'Priority' },
    capabilities: {
        can_respond: true,
        can_update_status: true,
        can_share_location: true,
    },
    status: { value: 'dispatched', label: 'Dispatched' },
    version: 1,
    my_assignment: {
        id: 55,
        response_status: 'pending',
        response_status_label: 'Pending Response',
        assigned_at: '2026-09-07T07:30:00Z',
    },
    asset_assignments: [],
};

type View = Awaited<ReturnType<typeof render>>;

const flat = (view: View, testID: string) => {
    const style = view.getByTestId(testID).props.style;

    return StyleSheet.flatten(
        typeof style === 'function' ? style({ pressed: false }) : style,
    );
};

const textColor = (view: View, text: string) =>
    StyleSheet.flatten(view.getByText(text).props.style).color;

const inTheme = (mode: ThemeMode, node: React.ReactElement) =>
    render(<ThemeProvider initialMode={mode}>{node}</ThemeProvider>);

describe.each(MODES)(
    'Dispatch design roles (%s)',
    (mode, theme: ThemeColors) => {
        it('keeps the shared screen header neutral: ink eyebrow, resting back button', async () => {
            const view = await inTheme(
                mode,
                <TileScreenHeader
                    category="Central Dispatch"
                    onBack={jest.fn()}
                    title="Dispatch Intake & Orders"
                />,
            );
            const back = flat(view, 'tile-header-back-btn');

            expect(textColor(view, 'Central Dispatch')).toBe(
                theme.textSecondary,
            );
            expect(textColor(view, 'Dispatch Intake & Orders')).toBe(
                theme.textPrimary,
            );
            expect(back.backgroundColor).toBe(theme.surface);
            expect(back.borderColor).toBe(theme.border);
            expect(back.elevation).toBeUndefined();
            expect(back.minHeight ?? back.height).toBeGreaterThanOrEqual(48);
        });

        it('shows pending orders as an orange attention badge and an empty queue as green', async () => {
            const pending = await inTheme(
                mode,
                <DispatchOrdersScreen jobs={[pendingJob]} />,
            );
            const pendingBadge = flat(pending, 'dispatch-header-badge');

            expect(pendingBadge.backgroundColor).toBe(theme.warningOrangeLight);
            expect(pendingBadge.borderColor).toBe(theme.warningOrange);
            expect(textColor(pending, '1 PENDING')).toBe(
                theme.warningOrangeText,
            );

            const clear = await inTheme(
                mode,
                <DispatchOrdersScreen jobs={[]} />,
            );
            const clearBadge = flat(clear, 'dispatch-header-badge');

            expect(clearBadge.backgroundColor).toBe(theme.successEmeraldLight);
            expect(clearBadge.borderColor).toBe(theme.successEmerald);
            expect(textColor(clear, 'ALL CLEAR')).toBe(
                theme.successEmeraldText,
            );
        });

        it('marks the selected filter tab with Signal Gold Soft, not cobalt', async () => {
            const view = await inTheme(
                mode,
                <DispatchOrdersScreen jobs={[]} />,
            );
            const selected = flat(view, 'intake-tab-all');
            const idle = flat(view, 'intake-tab-pending');

            expect(selected.backgroundColor).toBe(theme.brandAmberLight);
            expect(selected.borderColor).toBe(theme.brandAmber);
            expect(textColor(view, 'All Orders (0)')).toBe(theme.textPrimary);
            expect(idle.backgroundColor).not.toBe(theme.actionCobalt);
            expect(textColor(view, 'Needs Response (0)')).toBe(
                theme.textSecondary,
            );
            expect(selected.minHeight).toBeGreaterThanOrEqual(48);
            expect(selected.elevation).toBeUndefined();
        });

        it('draws the empty queue as a neutral resting panel', async () => {
            const view = await inTheme(
                mode,
                <DispatchOrdersScreen jobs={[]} />,
            );
            const panel = flat(view, 'dispatch-intake-empty');

            expect(panel.backgroundColor).toBe(theme.surface);
            expect(panel.borderColor).toBe(theme.border);
            expect(textColor(view, 'No Dispatch Orders Found')).toBe(
                theme.textPrimary,
            );
        });

        it('asks for a response in orange with a gold accept action and a red confirm-reject', async () => {
            const view = await inTheme(
                mode,
                <AssignmentResponseCard
                    job={pendingJob}
                    onAccept={jest.fn()}
                    onReject={jest.fn()}
                />,
            );
            const card = flat(view, 'assignment-response-card');
            const accept = flat(view, 'accept-assignment-btn');
            const reject = flat(view, 'reject-assignment-btn');

            expect(card.backgroundColor).toBe(theme.warningOrangeLight);
            expect(card.borderColor).toBe(theme.warningOrange);
            expect(textColor(view, 'Assignment response required')).toBe(
                theme.warningOrangeText,
            );
            expect(accept.backgroundColor).toBe(theme.brandAmber);
            expect(accept.minHeight).toBeGreaterThanOrEqual(52);
            expect(textColor(view, 'Accept assignment')).toBe(
                theme.surfaceDark,
            );
            expect(reject.backgroundColor).toBe(theme.surface);
            expect(reject.borderColor).toBe(theme.borderStrong);
            expect(textColor(view, 'Reject assignment')).toBe(
                theme.textPrimary,
            );

            await fireEvent.press(view.getByTestId('reject-assignment-btn'));

            expect(flat(view, 'submit-rejection-btn').backgroundColor).toBe(
                theme.hazardRed,
            );
            expect(textColor(view, 'Confirm rejection')).toBe(
                theme.textInverse,
            );
            expect(flat(view, 'rejection-reason-input').color).toBe(
                theme.textPrimary,
            );
        });
    },
);
