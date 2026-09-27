import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { HosClocksCard } from '../screens/hos/hos-clocks-card';
import type { HosClocksCardProps } from '../screens/hos/hos-clocks-card';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

const active: HosClocksCardProps = {
    shiftActive: true,
    startedAt: '07:00 AM',
    limitCounterHours: 3,
    isDoleWarning: false,
    isDoleCapExceeded: false,
    durationBreakdown: [
        ['Operating', 2],
        ['Driving', 1],
        ['Standby', 0.5],
        ['Breaks', null],
    ],
};

const renderCard = (
    mode: ThemeMode,
    overrides: Partial<HosClocksCardProps> = {},
) =>
    render(
        <ThemeProvider initialMode={mode}>
            <HosClocksCard {...active} {...overrides} />
        </ThemeProvider>,
    );

const flat = (node: { props: Record<string, unknown> }) =>
    StyleSheet.flatten(node.props.style as StyleProp<ViewStyle & TextStyle>);

describe.each(MODES)('HoS shift clock (%s)', (mode, theme: ThemeColors) => {
    it('shows one plain empty state when no shift is running, never a wall of Unavailable', async () => {
        const view = await renderCard(mode, {
            shiftActive: false,
            limitCounterHours: null,
            durationBreakdown: [],
        });

        expect(view.getByTestId('hos-clocks-empty')).toHaveTextContent(
            /No shift running/,
        );
        expect(view.queryByText(/Unavailable/)).toBeNull();
        expect(view.queryByTestId('hos-limit-counter')).toBeNull();
    });

    it('measures operating + driving against the DOLE 10h cap, not US trucking limits', async () => {
        const view = await renderCard(mode);

        expect(view.getByTestId('hos-limit-counter-value')).toHaveTextContent(
            '3h 00m',
        );
        expect(view.getByText('of 10h')).toBeTruthy();
        expect(
            view.getByText('DOLE-OSHC: warning at 9h, stop at 10h.'),
        ).toBeTruthy();

        for (const usRule of [/11h/, /14h/, /70-Hr/, /8-Day/, /30m rest/]) {
            expect(view.queryByText(usRule)).toBeNull();
        }

        expect(flat(view.getByTestId('hos-limit-gauge-fill')).width).toBe(
            '30%',
        );
    });

    it('turns orange past the 9h warning, with an icon and text', async () => {
        const view = await renderCard(mode, {
            limitCounterHours: 9.2,
            isDoleWarning: true,
        });

        expect(flat(view.getByTestId('hos-limit-counter-value')).color).toBe(
            theme.warningOrangeText,
        );
        expect(view.getByTestId('hos-limit-counter-alert')).toBeTruthy();
        expect(view.getByText(/Plan your handover before 10h/)).toBeTruthy();
    });

    it('turns red at the 10h cap and says to stop', async () => {
        const view = await renderCard(mode, {
            limitCounterHours: 10,
            isDoleCapExceeded: true,
        });

        expect(flat(view.getByTestId('hos-limit-counter-value')).color).toBe(
            theme.hazardRedText,
        );
        expect(view.getByText(/Limit reached/)).toBeTruthy();
    });

    it('says it is waiting for the server rather than guessing a total', async () => {
        const view = await renderCard(mode, { limitCounterHours: null });

        expect(view.getByTestId('hos-limit-counter-waiting')).toHaveTextContent(
            'Waiting for server totals',
        );
    });

    it('shows time per duty type, with a dash for a total not received yet', async () => {
        const view = await renderCard(mode);
        const breakdown = view.getByTestId('hos-duration-breakdown');

        expect(breakdown).toHaveTextContent(/Operating2h 00m/);
        expect(breakdown).toHaveTextContent(/Breaks—/);
    });
});
