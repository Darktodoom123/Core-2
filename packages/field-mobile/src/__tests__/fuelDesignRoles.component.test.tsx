import { render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import {
    FuelBanner,
    FuelButton,
    FuelConnectionPill,
    FuelFieldError,
} from '../components/fuel/fuel-controls';
import {
    FuelStatusPill,
    QueuedFuelRequestItem,
} from '../components/fuel/fuel-request-detail';
import type { QueuedFuelRequest } from '../hooks/useFuelManagement';
import { ThemeProvider } from '../theme';
import type { ThemeColors, ThemeMode } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';

const MODES = [
    ['light', lightThemeColors],
    ['dark_hud', darkHudThemeColors],
] as const;

type View = Awaited<ReturnType<typeof render>>;

const inTheme = (mode: ThemeMode, node: React.ReactElement) =>
    render(<ThemeProvider initialMode={mode}>{node}</ThemeProvider>);

const flat = (view: View, testID: string) => {
    const style = view.getByTestId(testID).props.style;

    return StyleSheet.flatten(
        typeof style === 'function' ? style({ pressed: false }) : style,
    );
};

const textColor = (view: View, text: string) =>
    StyleSheet.flatten(view.getByText(text).props.style).color;

const queued = (state: QueuedFuelRequest['state']): QueuedFuelRequest => ({
    commandId: `cmd-${state}`,
    state,
    payload: {
        quantity_litres: 40,
        fuel_type: 'diesel',
    } as QueuedFuelRequest['payload'],
    error: state === 'failed' ? 'Rejected by server' : null,
    createdAt: '2026-09-27T00:00:00Z',
});

describe.each(MODES)('Fuel design roles (%s)', (mode, theme: ThemeColors) => {
    it('fills the primary action with gold and dark ink, and danger with readable ink', async () => {
        const view = await inTheme(
            mode,
            <>
                <FuelButton
                    onPress={jest.fn()}
                    primary
                    testID="primary"
                    title="Submit"
                />
                <FuelButton
                    danger
                    onPress={jest.fn()}
                    testID="danger"
                    title="Withdraw"
                />
            </>,
        );

        expect(flat(view, 'primary').backgroundColor).toBe(theme.brandAmber);
        expect(textColor(view, 'Submit')).toBe(theme.surfaceDark);
        expect(flat(view, 'danger').backgroundColor).toBe(theme.hazardRed);
        expect(textColor(view, 'Withdraw')).toBe(theme.textInverse);
    });

    it('draws a warning banner in orange, never gold', async () => {
        const view = await inTheme(
            mode,
            <FuelBanner testID="warn" title="Low tank" tone="warning" />,
        );
        const banner = flat(view, 'warn');

        expect(banner.backgroundColor).toBe(theme.warningOrangeLight);
        expect(banner.borderColor).toBe(theme.warningOrange);
    });

    it('shows offline in orange, matching the home header', async () => {
        const view = await inTheme(mode, <FuelConnectionPill online={false} />);

        expect(flat(view, 'fuel-connection-pill').backgroundColor).toBe(
            theme.warningOrangeLight,
        );
    });

    it('writes field errors in the readable red text role', async () => {
        const view = await inTheme(
            mode,
            <FuelFieldError message="Enter litres" />,
        );

        expect(textColor(view, 'Enter litres')).toBe(theme.hazardRedText);
    });

    it('never shows a request status in brand gold', async () => {
        const view = await inTheme(
            mode,
            <>
                <FuelStatusPill status="forwarded" />
                <FuelStatusPill status="approved" />
                <FuelStatusPill status="verified" />
            </>,
        );

        expect(flat(view, 'fuel-status-forwarded').backgroundColor).toBe(
            theme.surfaceHighlight,
        );
        expect(flat(view, 'fuel-status-approved').backgroundColor).toBe(
            theme.actionCobaltLight,
        );
        expect(textColor(view, 'Ready to refuel')).toBe(
            theme.successEmeraldText,
        );
    });

    it('marks a queued conflict orange and a rejected send red', async () => {
        const conflict = await inTheme(
            mode,
            <QueuedFuelRequestItem queued={queued('conflict')} />,
        );

        expect(flat(conflict, 'fuel-queued-cmd-conflict').borderColor).toBe(
            theme.warningOrange,
        );

        const failed = await inTheme(
            mode,
            <QueuedFuelRequestItem queued={queued('failed')} />,
        );

        expect(flat(failed, 'fuel-queued-cmd-failed').borderColor).toBe(
            theme.hazardRed,
        );
        expect(textColor(failed, 'Not accepted')).toBe(theme.hazardRedText);
    });
});
