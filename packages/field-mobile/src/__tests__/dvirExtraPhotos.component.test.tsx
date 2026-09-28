import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';
import { DvirScreen } from '../screens/DvirScreen';
import { ThemeProvider } from '../theme';
import { darkHudThemeColors, lightThemeColors } from '../theme/tokens';

const renderDvir = () =>
    render(
        <DvirScreen
            assetCode="CRN-501"
            initialMode="pre_trip"
            inspectorName="BJ Bello"
        />,
    );

describe('DVIR cab and defect photos', () => {
    jest.setTimeout(15000);

    it('makes the whole cab card an obvious button to add the photo', async () => {
        const view = await renderDvir();
        const card = view.getByTestId('dvir-cab-photo');

        expect(card.props.accessibilityRole).toBe('button');
        expect(card.props.accessibilityLabel).toBe(
            'Add cab / dashboard photo, optional',
        );
        expect(within(card).getByText('Cab / dashboard')).toBeTruthy();
        expect(within(card).getByText('Optional')).toBeTruthy();
        expect(
            within(card).getByText(
                'Hour meter, warning lights and load moment indicator.',
            ),
        ).toBeTruthy();
        // A visible call to action, not just an empty box.
        expect(within(card).getByText('Add photo')).toBeTruthy();
        expect(within(card).queryByText('Cab / Dashboard')).toBeNull();

        const style = StyleSheet.flatten(card.props.style);
        expect(style.minHeight).toBeGreaterThanOrEqual(72);
    });

    it.each([
        ['light', lightThemeColors],
        ['dark_hud', darkHudThemeColors],
    ] as const)(
        'draws the cab card on theme roles (%s)',
        async (mode, theme) => {
            const view = await render(
                <ThemeProvider initialMode={mode}>
                    <DvirScreen assetCode="CRN-501" inspectorName="BJ Bello" />
                </ThemeProvider>,
            );
            const card = StyleSheet.flatten(
                view.getByTestId('dvir-cab-photo').props.style,
            );

            expect(card.backgroundColor).toBe(theme.surface);
            // A tappable card uses the secondary-button border, not a resting one.
            expect(card.borderColor).toBe(theme.borderStrong);
            expect(card.backgroundColor).not.toBe(theme.brandAmber);
        },
    );

    it('asks for defect close-ups only once the unit is marked unsafe or has defects', async () => {
        const view = await renderDvir();

        expect(view.queryByTestId('dvir-defect-photos')).toBeNull();

        await fireEvent.press(view.getByTestId('safety-status-unsafe'));

        const section = view.getByTestId('dvir-defect-photos');

        for (const slot of [
            'slot-defect-1',
            'slot-defect-2',
            'slot-defect-3',
        ]) {
            expect(within(section).getByTestId(slot)).toBeTruthy();
        }

        await fireEvent.press(view.getByTestId('safety-status-safe'));
        expect(view.queryByTestId('dvir-defect-photos')).toBeNull();
    });
});
