import { fireEvent, render, within } from '@testing-library/react-native';
import React from 'react';
import { DvirScreen } from '../screens/DvirScreen';

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

    it('offers an optional cab / dashboard photo next to the walkaround', async () => {
        const view = await renderDvir();
        const cab = view.getByTestId('dvir-cab-photo');

        expect(within(cab).getByText(/optional/i)).toBeTruthy();
        expect(within(cab).getByTestId('slot-cab')).toBeTruthy();
        expect(within(cab).getByText('Cab / Dashboard')).toBeTruthy();
    });

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
