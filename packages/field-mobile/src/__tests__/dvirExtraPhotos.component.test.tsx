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

    it('offers an optional cab / dashboard photo as one compact card', async () => {
        const view = await renderDvir();
        const cab = view.getByTestId('dvir-cab-photo');

        expect(within(cab).getByText('Cab / dashboard')).toBeTruthy();
        expect(within(cab).getByText('Optional')).toBeTruthy();
        expect(
            within(cab).getByText(
                'Hour meter, warning lights and load moment indicator.',
            ),
        ).toBeTruthy();
        // One label, not a section title plus a repeated slot caption.
        expect(within(cab).queryByText('Cab / Dashboard')).toBeNull();

        const slot = StyleSheet.flatten(
            within(cab).getByTestId('slot-cab').props.style,
        );
        expect(slot.width).toBe(72);
        expect(slot.height).toBe(72);
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
            expect(card.borderColor).toBe(theme.border);
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
