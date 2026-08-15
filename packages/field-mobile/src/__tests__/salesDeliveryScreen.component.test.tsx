import { cleanup, fireEvent, render } from '@testing-library/react-native/pure';
import React from 'react';
import { SalesDeliveryScreen } from '../screens/SalesDeliveryScreen';

describe('SalesDeliveryScreen', () => {
    afterEach(async () => {
        await cleanup();
        jest.clearAllMocks();
    });

    it('renders VIN verification, accessories checklist, and confirms sales transfer in Philippine context', async () => {
        const onCompleteDelivery = jest.fn();
        const onBack = jest.fn();

        const view = await render(
            <SalesDeliveryScreen
                clientName="San Miguel Infrastructure Corp."
                deliveryAddress="North-South Commuter Railway (NSCR) Project - Depot Area, Bulacan, PH"
                equipmentName="Caterpillar 320 GC Hydraulic Excavator"
                onBack={onBack}
                onCompleteDelivery={onCompleteDelivery}
                orderReference="SO-2026-0091"
                vinNumber="CAT0320GC88912"
            />,
        );

        expect(view.getByText('Equipment Sales Delivery')).toBeTruthy();
        expect(view.getByText('SO-2026-0091')).toBeTruthy();
        expect(
            view.getByText('Caterpillar 320 GC Hydraulic Excavator'),
        ).toBeTruthy();
        expect(view.getByText(/San Miguel Infrastructure/)).toBeTruthy();
        expect(view.getByText('MATCH')).toBeTruthy();

        // Toggle accessory
        fireEvent.press(view.getByTestId('check-coupler'));

        // Confirm Delivery
        fireEvent.press(view.getByTestId('confirm-sales-delivery-button'));
        expect(onCompleteDelivery).toHaveBeenCalledTimes(1);
    });
});
