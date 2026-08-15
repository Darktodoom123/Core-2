import { cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import React from 'react';
import { RentalHandoverScreen } from '../screens/RentalHandoverScreen';

describe('RentalHandoverScreen', () => {
    afterEach(async () => {
        await cleanup();
        jest.clearAllMocks();
    });

    it('renders checkout tabs and confirms outbound handover in Philippine context', async () => {
        const onCompleteCheckout = jest.fn();
        const onBack = jest.fn();

        const view = await render(
            <RentalHandoverScreen
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
                clientName="DMCI Construction & Power Inc."
                mode="checkout"
                onBack={onBack}
                onCompleteCheckout={onCompleteCheckout}
                reservationReference="REN-2026-0412"
            />,
        );

        expect(view.getByText('Rental Checkout')).toBeTruthy();
        expect(view.getByText('ALB-CRN-050')).toBeTruthy();
        expect(view.getByText('50T Tadano All-Terrain Crane')).toBeTruthy();
        expect(view.getByText(/DMCI Construction/)).toBeTruthy();
        expect(view.getByText('DOLE-OSHC CERTIFIED')).toBeTruthy();

        // Confirm Checkout
        fireEvent.press(view.getByTestId('confirm-handover-button'));
        expect(onCompleteCheckout).toHaveBeenCalledTimes(1);
    });

    it('renders return check-in mode with condition diff damage inspection in Philippine context', async () => {
        const onCompleteReturn = jest.fn();
        const onBack = jest.fn();

        const view = await render(
            <RentalHandoverScreen
                assetCode="ALB-CRN-050"
                assetName="50T Tadano All-Terrain Crane"
                clientName="EEI Corporation Philippines"
                mode="return"
                onBack={onBack}
                onCompleteReturn={onCompleteReturn}
                reservationReference="REN-2026-0412"
            />,
        );

        expect(view.getByText('Return Check-in')).toBeTruthy();
        expect(
            view.getByText('CONDITION DIFF & DAMAGE INSPECTION'),
        ).toBeTruthy();

        // Trigger damage diff toggle
        fireEvent.press(view.getByTestId('toggle-damage-diff'));

        // Confirm Return
        fireEvent.press(view.getByTestId('confirm-handover-button'));
        expect(onCompleteReturn).toHaveBeenCalledTimes(1);
    });
});
