import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { NoUnitCard } from '../components/home/no-unit-card';
import { ReliefClaimButton } from '../components/home/relief-claim-button';
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

describe.each(MODES)('Home no-unit state (%s)', (mode, theme: ThemeColors) => {
    it('states plainly that no unit is assigned, as a neutral resting card', async () => {
        const view = await inTheme(
            mode,
            <NoUnitCard onClaimRelief={jest.fn()} />,
        );
        const card = flat(view, 'no-unit-card');

        expect(card.backgroundColor).toBe(theme.surface);
        expect(card.borderColor).toBe(theme.border);
        expect(card.elevation).toBeUndefined();
        expect(textColor(view, 'No unit assigned')).toBe(theme.textPrimary);
        expect(view.getByText(/Pull down to refresh/)).toBeTruthy();

        // No warning colors, no inspection claim, no duty-status wording.
        expect(view.queryByText(/DVIR Cleared/)).toBeNull();
        expect(view.queryByText(/Standby/)).toBeNull();
    });

    it('offers the relief claim as a neutral secondary action inside the card', async () => {
        const onClaim = jest.fn();
        const view = await inTheme(
            mode,
            <NoUnitCard onClaimRelief={onClaim} />,
        );
        const button = flat(view, 'incoming-handover-claim-btn');

        expect(button.backgroundColor).toBe(theme.surface);
        expect(button.borderColor).toBe(theme.borderStrong);
        expect(button.minHeight).toBeGreaterThanOrEqual(48);
        expect(textColor(view, 'Relief handover — claim a unit')).toBe(
            theme.textPrimary,
        );

        await fireEvent.press(view.getByTestId('incoming-handover-claim-btn'));
        expect(onClaim).toHaveBeenCalled();
    });

    it('never draws the relief claim in cobalt', async () => {
        const view = await inTheme(
            mode,
            <ReliefClaimButton onPress={jest.fn()} />,
        );
        const button = flat(view, 'incoming-handover-claim-btn');

        expect(button.backgroundColor).not.toBe(theme.actionCobaltLight);
        expect(button.borderColor).not.toBe(theme.actionCobalt);
    });
});
